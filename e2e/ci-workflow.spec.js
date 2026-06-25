import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'astra-ci.yml');
const workflowText = fs.readFileSync(workflowPath, 'utf8');
const scriptPath = path.resolve(__dirname, '..', 'scripts', 'ci-gates.mjs');

test('workflow file is configured for pull_request and astra branches', async ({ page }) => {
  await page.setContent(`<pre>${workflowText}</pre>`);
  await expect(page.getByText('on:')).toBeVisible();
  await expect(page.getByText('pull_request:')).toBeVisible();
  await expect(page.getByText('main')).toBeVisible();
  await expect(page.getByText('astra/**')).toBeVisible();
});

test('bootstrap use case: missing package.json skips quality gates', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ci-playwright-no-package-'));
  try {
    const output = execSync(`node ${scriptPath}`, {
      cwd: tempDir,
      encoding: 'utf8',
    });
    expect(output).toContain('No package.json found. Skipping CI quality gates.');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('application path use case: lockfile switches dependency install to npm ci', async ({ page }) => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ci-playwright-with-package-'));
  try {
    const packageJson = {
      name: 'ci-bootstrap',
      scripts: {
        lint: 'echo lint',
      },
    };
    writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');

    const command = `node --input-type=module -e "import { getCiConfiguration } from 'file://${
      scriptPath.replace(/\\/g, '/') }'; const config = getCiConfiguration('${tempDir.replace(/\\/g, '\\\\')}'); console.log(config.installCommand.join(' ')); console.log(config.commands.join(','));"`;
    const output = execSync(command, {
      env: { ...process.env, CI: '1' },
      encoding: 'utf8',
    });

    expect(output).toContain('npm ci');
    expect(output).toContain('lint');
    await page.setContent(`<pre>${output}</pre>`);
    await expect(page.getByText('npm ci')).toBeVisible();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
