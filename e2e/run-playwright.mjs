import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const port = 3000;
const baseUrl = `http://127.0.0.1:${port}`;

await rm(join(process.cwd(), ".next"), { force: true, recursive: true });

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
    spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  server.kill("SIGTERM");
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
