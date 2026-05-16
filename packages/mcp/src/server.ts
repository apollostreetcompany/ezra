#!/usr/bin/env node
import readline from "node:readline";
import { handleBridgeRequest } from "./index.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", (line) => {
  void handleLine(line);
});

async function handleLine(line: string): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  try {
    const payload = JSON.parse(trimmed);
    const response = await handleBridgeRequest(payload);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: error instanceof SyntaxError ? "Parse error" : "Ezra MCP bridge error"
      }
    })}\n`);
  }
}
