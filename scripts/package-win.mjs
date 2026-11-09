import { execFileSync } from "node:child_process";
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error("Build the Windows x64 ZIP with 64-bit Node.js on Windows.");
}

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = async name => JSON.parse(await readFile(path.join(root, name), "utf8"));
const { name, productName, version, main } = await readJson("package.json");
const files = await readJson("desktop-files.json");
const electron = createRequire(import.meta.url)("electron");
const output = path.join(root, "dist");
const folderName = "Idle-Exiles";
const archiveName = `${folderName}-${version}-windows-x64.zip`;
const scratch = await mkdtemp(path.join(tmpdir(), "idle-exiles-package-"));

async function uninstallCommands(folder, relative = "") {
  const commands = [];
  for (const entry of await readdir(path.join(folder, relative), { withFileTypes: true })) {
    const target = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      commands.push(...await uninstallCommands(folder, target), 'RMDir "$INSTDIR\\' + target + '"');
    } else commands.push('Delete "$INSTDIR\\' + target + '"');
  }
  return commands;
}

try {
  const folder = path.join(scratch, folderName);
  const runtime = path.join(folder, "resources", "app");
  await cp(path.dirname(electron), folder, { recursive: true });
  await rename(path.join(folder, path.basename(electron)), path.join(folder, `${folderName}.exe`));
  for (const file of [main, "desktop-files.json", "README.md", "node_modules/phaser/LICENSE.md", ...files]) {
    const destination = path.join(runtime, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(root, file), destination);
  }
  await writeFile(path.join(runtime, "package.json"), JSON.stringify({ name, productName, version, main }));
  await mkdir(output, { recursive: true });
  const archive = path.join(output, archiveName);
  execFileSync("tar.exe", ["-a", "-cf", archive, "-C", scratch, folderName], { stdio: "inherit" });
  process.stdout.write(`Built ${archive}\n`);
  if (process.argv.includes("--installer")) {
    const cleanup = path.join(scratch, "uninstall-files.nsh");
    await writeFile(cleanup, (await uninstallCommands(folder)).join("\r\n") + "\r\n");
    const installer = path.join(output, `${folderName}-Setup-${version}-windows-x64.exe`);
    execFileSync(process.env.MAKENSIS || "makensis.exe", [
      "/V2", "/DPAYLOAD=" + folder, "/DOUTPUT=" + installer, "/DVERSION=" + version,
      "/DCLEANUP=" + cleanup, path.join(root, "scripts", "installer.nsi"),
    ], { stdio: "inherit" });
    process.stdout.write(`Built ${installer}\n`);
  }
} finally {
  // Only remove the freshly created direct child of the system temporary directory.
  const relative = path.relative(path.resolve(tmpdir()), path.resolve(scratch));
  if (/^idle-exiles-package-[a-z0-9]+$/i.test(relative)) {
    await rm(scratch, { recursive: true, force: true });
  }
}
