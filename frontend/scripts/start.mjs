import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const standalone = path.resolve(".next/standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Run pnpm build before starting the production frontend");
}
cpSync(".next/static", path.join(standalone, ".next/static"), {
  recursive: true,
});
if (existsSync("public")) {
  cpSync("public", path.join(standalone, "public"), { recursive: true });
}
process.env.HOSTNAME = process.env.FRONTEND_HOST || "127.0.0.1";
await import(pathToFileURL(path.join(standalone, "server.js")).href);
