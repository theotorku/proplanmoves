import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Runs the E2E suite against a production server.
 *
 * The suite used to drive `next dev` with a freshly deleted .next, which meant
 * the first navigation to each route paid for compilation. That is invisible
 * locally on a warm cache and shows up in CI as an intermittent timeout on
 * whichever assertion happens to land first — a release failure that says
 * nothing about the product. A built server also matches what operators run.
 */
const port = 3000;
const baseUrl = `http://127.0.0.1:${port}`;
const buildId = join(process.cwd(), ".next", "BUILD_ID");
const forceRebuild = process.argv.includes("--rebuild");

freePort();

if (forceRebuild || !existsSync(buildId)) {
  console.log("Building the application for the end-to-end run...");
  const build = spawnSync("npx next build", {
    shell: true,
    stdio: "inherit",
    windowsHide: true
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
} else {
  console.log("Reusing the existing production build.");
}

const server = spawn(`npx next start -H 127.0.0.1 -p ${port}`, {
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

async function waitForServer() {
  const started = Date.now();

  while (Date.now() - started < 120000) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next server did not become ready.\n${serverOutput}`);
}

function stopServer() {
  if (server.killed || server.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    // next start runs under a shell, so the tree has to go, not just the shell.
    spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  server.kill("SIGTERM");
}

// A server left behind by an interrupted run holds the port and fails the next
// one with EADDRINUSE, which reads like a product failure rather than leftover
// state.
function freePort() {
  if (process.platform === "win32") {
    const found = spawnSync("cmd", ["/c", `netstat -ano | findstr :${port} | findstr LISTENING`], {
      encoding: "utf8",
      windowsHide: true
    });

    const pids = new Set(
      (found.stdout ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/).pop())
        .filter((pid) => pid && /^\d+$/.test(pid) && pid !== "0")
    );

    for (const pid of pids) {
      spawnSync("taskkill", ["/pid", pid, "/t", "/f"], { stdio: "ignore", windowsHide: true });
    }

    return;
  }

  spawnSync("sh", ["-c", `lsof -ti tcp:${port} | xargs -r kill -9`], { stdio: "ignore" });
}

try {
  await waitForServer();

  const test = spawn("npx playwright test --reporter=line", {
    shell: true,
    stdio: "inherit",
    windowsHide: true
  });

  const exitCode = await new Promise((resolve) => {
    test.on("exit", (code) => resolve(code ?? 1));
  });

  stopServer();
  process.exit(exitCode);
} catch (error) {
  stopServer();
  console.error(error);
  process.exit(1);
}
