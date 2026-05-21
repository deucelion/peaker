#!/usr/bin/env node
/**
 * Faz 15 — "use server" dosyalarında yalnızca async function export kontrolü.
 * `export type` ve `export async function` dışındaki export'lar build/runtime hatası üretir.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");
const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) checkFile(p);
  }
}

function checkFile(path) {
  const src = readFileSync(path, "utf8");
  if (!/^["']use server["'];?\s*$/m.test(src.split("\n").slice(0, 3).join("\n"))) {
    if (!src.startsWith('"use server"') && !src.startsWith("'use server'")) return;
  }
  const re = /^export\s+(?!async\s+function)(?!type\s)(\w+)/gm;
  let m;
  while ((m = re.exec(src))) {
    violations.push({ file: relative(process.cwd(), path), kind: m[1] });
  }
}

walk(ROOT);

if (violations.length > 0) {
  console.error("use server export violations (only async functions and export type allowed):\n");
  for (const v of violations) {
    console.error(`  ${v.file}: export ${v.kind}`);
  }
  process.exit(1);
}
console.log("OK: no invalid use server runtime exports in src/");
