import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const label = "com.challenge-zukan.daily-update";
const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
const updateScript = path.join(root, "scripts", "update.mjs");
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${updateScript}</string>
    <string>--once-per-day</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${root}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>7</integer>
    <key>Minute</key>
    <integer>10</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${path.join(root, "data", "update.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(root, "data", "update.err.log")}</string>
</dict>
</plist>
`;

await mkdir(path.dirname(plistPath), { recursive: true });
await mkdir(path.join(root, "data"), { recursive: true });
await writeFile(plistPath, plist);
const uid = process.getuid?.();
if (uid === undefined) {
  console.log(`登録ファイルを書きました: ${plistPath}`);
  process.exit(0);
}
const domain = `gui/${uid}`;
spawnSync("launchctl", ["bootout", domain, plistPath], { stdio: "ignore" });
const loaded = spawnSync("launchctl", ["bootstrap", domain, plistPath], { stdio: "inherit" });
if (loaded.status !== 0) {
  console.error("毎日の自動更新を登録できませんでした");
  process.exit(loaded.status ?? 1);
}
console.log(`毎日 7:10 に更新します: ${plistPath}`);
