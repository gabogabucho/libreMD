import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

const logoPath = resolve(projectRoot, "public/icons/256x256.png");
const iconsDir = resolve(projectRoot, "src-tauri/icons");
const requiredPngSizes = [16, 32, 48, 64, 128, 256];

const ensurePathExists = async (path) => {
  await access(path, constants.F_OK);
};

const run = (command, args, cwd) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`Command failed with exit code ${code}`));
    });

    child.on("error", rejectPromise);
  });

try {
  await ensurePathExists(logoPath);
  await ensurePathExists(iconsDir);

  const pngArgs = ["run", "tauri", "--", "icon", logoPath, "--output", iconsDir];
  for (const size of requiredPngSizes) {
    pngArgs.push("--png", String(size));
  }

  await run("npm", pngArgs, projectRoot);
  await run("npm", ["run", "tauri", "--", "icon", logoPath, "--output", iconsDir], projectRoot);

  for (const size of requiredPngSizes) {
    await ensurePathExists(resolve(iconsDir, `${size}x${size}.png`));
  }
  await ensurePathExists(resolve(iconsDir, "icon.ico"));

  console.log("All icons regenerated!");
} catch (error) {
  console.error(`Failed to regenerate icons: ${error.message}`);
  process.exit(1);
}
