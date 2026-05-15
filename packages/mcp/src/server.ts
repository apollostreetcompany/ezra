#!/usr/bin/env node
import { createInterface } from "node:readline";
import { handleJsonRpcMessage } from "./index.js";

const input = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });

input.on("line", (line) => {
  void handleLine(line);
});

async function handleLine(line: string): Promise<void> {
  if (!line.trim()) {
    return;
  }
  try {
    const response = await handleJsonRpcMessage(JSON.parse(line));
    if (response !== undefined) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message } })}\n`);
  }
}
