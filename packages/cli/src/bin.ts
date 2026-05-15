#!/usr/bin/env node
import { runBibleCoderCli } from "./index.js";

process.exitCode = await runBibleCoderCli(process.argv.slice(2));
