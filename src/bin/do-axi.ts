#!/usr/bin/env node
import { tryFastPath } from "axi-sdk-js/fast-path";
import { VERSION } from "../version.js";

if (tryFastPath(process.argv.slice(2), { version: VERSION })) {
  // handled
} else {
  const { main } = await import("../cli.js");
  await main();
}
