import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["ls-files", "--others", "--cached", "--exclude-standard"], {
  encoding: "utf8"
})
  .split("\n")
  .filter(Boolean)
  .filter((file) => !file.endsWith("pnpm-lock.yaml"));

const patterns = [
  /sk_live_[A-Za-z0-9]+/,
  /whsec_[A-Za-z0-9]+/,
  /AIza[0-9A-Za-z_-]{35}/,
  /bc_live_[A-Za-z0-9_-]+_[A-Za-z0-9_-]{32,}/
];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      throw new Error(`Potential secret matched in ${file}`);
    }
  }
}

console.log("Secret scan passed.");
