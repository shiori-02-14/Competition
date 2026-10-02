import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const updater = spawn(process.execPath, [path.join(root, "scripts", "schedule.mjs")], {
  cwd: root,
  stdio: "inherit",
});
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const vite = spawn(process.execPath, [viteBin], {
  cwd: root,
  stdio: "inherit",
});

function stop() {
  updater.kill();
  vite.kill();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", (code) => {
  updater.kill();
  process.exit(code ?? 0);
});
