import * as schema from "./schema.js";

const requiredTables = [
  "users",
  "deviceTokens",
  "plans",
  "planItems",
  "progressEvents",
  "reviewEvents",
  "auditLog"
] as const;

for (const table of requiredTables) {
  if (!(table in schema)) {
    throw new Error(`Missing Drizzle schema export: ${table}`);
  }
}

console.log("Drizzle schema check passed.");
