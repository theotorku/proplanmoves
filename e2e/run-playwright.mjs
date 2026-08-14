import { spawn, spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const port = 3000;
const baseUrl = `http://127.0.0.1:${port}`;

await rm(join(process.cwd(), ".next"), { force: true, recursive: true });
freePort();

const server = spawn(`npx next dev -H 127.0.0.1 -p ${port}`, {
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
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Next dev server did not become ready.\n${serverOutput}`);
}

function stopServer() {
  if (server.killed || server.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    // next dev runs under a shell, so the tree has to go, not just the shell.
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
