#!/usr/bin/env node
// Headless test runner for tests/t**.html and tests/s**.html.
// Starts an HTTP server, opens each test in Chromium via Playwright,
// waits for the result table to populate, and exits non-zero on any FAIL.
//
// Usage: node tests/run-headless.mjs [--port 8765]

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = Number(process.argv.find((a, i) => process.argv[i - 1] === '--port')) || 8765;

async function startServer() {
  const server = spawn('npx', ['--yes', 'http-server', ROOT, '-p', String(PORT), '-s', '-c-1'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/index.html`);
      if (r.ok) return server;
    } catch {}
    await delay(200);
  }
  server.kill();
  throw new Error('HTTP server did not start');
}

async function discoverTests() {
  const files = await readdir(join(ROOT, 'tests'));
  return files.filter(f => /^(t|s)\d\d-.*\.html$/.test(f)).sort();
}

async function runTest(page, file) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  // Pre-clear localStorage from a same-origin context
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://localhost:${PORT}/tests/${file}`, { waitUntil: 'networkidle' });
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('#results tr').length >= 3,
      { timeout: 20000 }
    );
  } catch {}
  await page.waitForTimeout(800);
  const status = (await page.locator('#status').textContent()).trim();
  const rows = await page.$$eval('#results tr', trs => trs.map(tr => {
    const tds = tr.querySelectorAll('td');
    const cell = tds[1]?.textContent?.trim() || '';
    return {
      name: tds[0]?.textContent?.trim() || '',
      pass: cell === 'PASS',
      details: (tds[2]?.textContent || '').slice(0, 200)
    };
  }));
  return { file, status, rows, errors };
}

(async () => {
  console.log(`Starting http-server on :${PORT}…`);
  const server = await startServer();
  let exitCode = 0;
  try {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const tests = await discoverTests();
    if (!tests.length) throw new Error('No tests found under tests/');
    console.log(`Found ${tests.length} test pages.`);

    let totalChecks = 0, totalPass = 0;
    for (const file of tests) {
      const page = await ctx.newPage();
      const { status, rows, errors } = await runTest(page, file);
      const pass = rows.filter(r => r.pass).length;
      totalChecks += rows.length;
      totalPass += pass;
      const allPass = rows.length > 0 && rows.every(r => r.pass);
      const tag = allPass ? 'PASS' : 'FAIL';
      console.log(`\n[${tag}] ${file}  ${pass}/${rows.length}  ${status.slice(0, 60)}`);
      if (!allPass) {
        exitCode = 1;
        rows.filter(r => !r.pass).forEach(r => console.log(`   - FAIL: ${r.name}\n     ${r.details.replace(/\n/g, ' ').slice(0, 200)}`));
        errors.forEach(e => console.log(`   ! ${e}`));
      }
      await page.close();
    }
    await browser.close();

    console.log(`\n=========================\nTOTAL: ${totalPass}/${totalChecks} checks pass`);
    if (totalChecks === 0) exitCode = 1;
  } finally {
    server.kill('SIGTERM');
  }
  process.exit(exitCode);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
