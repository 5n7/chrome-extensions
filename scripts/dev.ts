import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const extensionsDir = join(import.meta.dir, "..", "extensions");

const [name] = Bun.argv.slice(2);
const dir = name ? join(extensionsDir, name) : undefined;

if (!dir || !existsSync(join(dir, "package.json"))) {
  const entries = await readdir(extensionsDir, { withFileTypes: true });
  const available = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  console.error("Usage: bun dev <name>");
  console.error(`Available: ${available.join(", ") || "(none)"}`);
  process.exit(1);
}

const proc = Bun.spawn(["bun", "run", "dev"], {
  cwd: dir,
  stdio: ["inherit", "inherit", "inherit"],
});
process.exitCode = await proc.exited;
