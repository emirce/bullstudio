import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cliDistDir = join(repoRoot, "packages/cli/dist");
const cliClientDir = join(cliDistDir, "client");
const cliServerDir = join(cliDistDir, "server");
const frontendClientDir = join(repoRoot, "apps/frontend/dist/client");
const standaloneServerFile = join(
  repoRoot,
  "apps/standalone/dist/server/production.js",
);
const cliServerFile = join(cliServerDir, "production.js");

await rm(cliClientDir, { force: true, recursive: true });
await rm(cliServerDir, { force: true, recursive: true });
await mkdir(cliClientDir, { recursive: true });
await mkdir(cliServerDir, { recursive: true });
await cp(frontendClientDir, cliClientDir, { recursive: true });
await cp(standaloneServerFile, cliServerFile);
