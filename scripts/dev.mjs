// Run the extension in the editor it's built for, from a throwaway profile.
// `npm run check` proves the code; this proves the extension — this manifest,
// these bundles, in a window that carries nothing else: no published Patchbay
// beside the dev copy, no other extension, no trust prompt in the way.
//
//     node scripts/dev.mjs                 # build once, open a window
//     node scripts/dev.mjs --watch         # rebuild on change; Reload Window takes them
//     node scripts/dev.mjs --code <path>   # the editor at a path nothing standard names
//     node scripts/dev.mjs <folder>…       # what the window opens on (default: here)
//
// Any other flag goes to the editor as-is (`--prof-startup`, `--log`, …).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
/** Flags this script owns; everything else is the editor's. */
const known = new Set(["--watch", "--code", "--help", "-h"]);
let code = process.env.PATCHBAY_CODE;
let watch = false;
const passThrough = [];
const folders = [];
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--code") {
    code = argv[i + 1];
    i += 1;
  } else if (arg === "--watch") {
    watch = true;
  } else if (known.has(arg)) {
    console.log("usage: node scripts/dev.mjs [--watch] [--code <editor path>] [folder…] [editor flag…]");
    process.exit(0);
  } else if (arg.startsWith("-")) {
    passThrough.push(arg);
  } else {
    folders.push(resolve(arg));
  }
}

const app = findEditorApp(code);
if (app === null) {
  console.error("No VS Code found. Pass --code <path to Code.exe/the editor app>, or set PATCHBAY_CODE.");
  console.error("(The `code` shim on PATH isn't enough: it hands the window to a running instance and exits.)");
  process.exit(1);
}

// The editor loads out/ the moment the window opens, so the bundles are built
// before it — in watch mode too, whose first build would otherwise race it.
if (!existsSync(join(repo, "node_modules"))) {
  console.error("Dependencies aren't installed here — run `npm ci` first.");
  process.exit(1);
}
const built = spawnSync(process.execPath, ["esbuild.mjs"], { cwd: repo, stdio: "inherit" });
if (built.status !== 0) process.exit(built.status ?? 1);

// Disposable on purpose: the window says where it is, and deleting it later
// costs nothing the real profile would have missed.
const scratch = mkdtempSync(join(tmpdir(), "patchbay-dev-"));
const flags = [
  `--extensionDevelopmentPath=${repo}`,
  // Own user-data and extensions dirs: the standard-profile Patchbay can't
  // load beside this one, and workspace trust is decided by us, not prompted.
  `--user-data-dir=${join(scratch, "user-data")}`,
  `--extensions-dir=${join(scratch, "extensions")}`,
  "--disable-workspace-trust",
  ...passThrough,
  ...(folders.length > 0 ? folders : [process.cwd()]),
];
mkdirSync(join(scratch, "user-data"), { recursive: true });

console.log(`editor:   ${app}`);
console.log(`load from: ${repo}`);
console.log(`profile:  ${scratch} (disposable)`);

if (!watch) process.exit(spawnSync(app, flags, { stdio: "inherit" }).status ?? 0);

const builder = spawn(process.execPath, ["esbuild.mjs", "--watch"], { cwd: repo, stdio: "inherit" });
const editor = spawn(app, flags, { stdio: "inherit" });
console.log("\nedits rebuild out/ — the running window keeps the old bundles until Command Palette → Reload Window");
editor.on("close", (status) => {
  builder.kill();
  process.exit(status ?? 0);
});

/** The editor's own app binary — not the CLI shim, which forwards to a running
 * window and exits, ending a watch run with nothing watching. */
function findEditorApp(explicit) {
  const standard = [
    explicit,
    ...(process.platform === "win32"
      ? [
          join(process.env.LOCALAPPDATA ?? "", "Programs", "Microsoft VS Code", "Code.exe"),
          join(process.env.ProgramFiles ?? "C:\\Program Files", "Microsoft VS Code", "Code.exe"),
        ]
      : process.platform === "darwin"
        ? ["/Applications/Visual Studio Code.app/Contents/MacOS/Electron"]
        : ["/usr/share/code/code", "/usr/bin/code"]),
  ].filter((path) => path !== undefined && path !== "");
  for (const path of standard) if (existsSync(path)) return path;
  // A `code` on PATH still names the app: bin/code sits one level below it.
  const shim = spawnSync(process.platform === "win32" ? "where" : "which", ["code"], { encoding: "utf8" })
    .stdout.split(/\r?\n/)[0];
  if (shim === undefined || shim === "") return null;
  const beside = process.platform === "win32"
    ? join(dirname(dirname(shim)), "Code.exe")
    : safeRealpath(shim);
  return existsSync(beside) ? beside : null;
}

function safeRealpath(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
