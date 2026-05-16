#!/usr/bin/env node
import { runEzraCli } from "./index.js";

const code = await runEzraCli(process.argv.slice(2));
process.exitCode = code;
