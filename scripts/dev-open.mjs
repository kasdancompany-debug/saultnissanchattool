/**
 * Starts `next dev` (webpack; avoids Turbopack + Sentry Edge middleware issues on Windows)
 * and opens the default browser once localhost responds.
 * For Turbopack: `npm run dev:turbo` then open the URL manually.
 */
import { spawn, exec } from "child_process";
import http from "http";

const port = process.env.PORT || "3042";
const url = `http://localhost:${port}`;
let opened = false;

function openBrowser() {
  if (opened) return;
  opened = true;
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.error("[dev-open] Could not open browser:", err.message);
  });
}

function poll() {
  const req = http.get(url, (res) => {
    res.resume();
    req.destroy();
    openBrowser();
  });
  req.on("error", () => setTimeout(poll, 400));
}

setTimeout(poll, 500);

const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
