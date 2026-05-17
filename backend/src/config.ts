import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Resolve workspace root: walk up from cwd until we find .env (reliable root marker)
function findRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, ".env"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export const ROOT = findRoot();

// Load .env from the workspace root
dotenv.config({ path: path.join(ROOT, ".env") });

export const DATA_DIR = process.env.DATA_DIR ?? path.join(ROOT, "data");
