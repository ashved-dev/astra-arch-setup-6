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

test('workflow includes Dockerfile image validation step', async () => {
  expect(workflowText).toMatch(/- name:\s*Validate Dockerfile image/);
  expect(workflowText).toMatch(/run:\s+docker build -t astra-arch-setup-6-ci \./);
});

test('workflow quality gates still include install, lint, build, test, and e2e', async ({ page }) => {
  await page.setContent(`<pre>${workflowText}</pre>`);
  await expect(page.getByText('Install dependencies')).toBeVisible();
  await expect(page.getByText('Install Playwright browsers')).toBeVisible();
  await expect(page.getByText('Apply todo schema')).toBeVisible();
  await expect(page.getByText('Run CI quality gates')).toBeVisible();
  expect(workflowText).toContain('node scripts/ci-gates.mjs');

  const gateScriptText = fs.readFileSync(scriptPath, 'utf8');
  expect(gateScriptText).toContain("'lint'");
  expect(gateScriptText).toContain("'build'");
  expect(gateScriptText).toContain("'test'");
  expect(gateScriptText).toContain("'e2e'");
});

test('docker validation command does not include embedded credentials', () => {
  const dockerCommandMatch = workflowText.match(
    /- name:\s*Validate Dockerfile image[\s\S]*?run:\s+docker build -t .*?$/m
  );
  const dockerCommandBlock = dockerCommandMatch?.[0] ?? '';

  expect(dockerCommandMatch).not.toBeNull();
  expect(dockerCommandBlock).not.toMatch(/postgres:[^\s]+@/i);
  expect(dockerCommandBlock).not.toMatch(/postgres:\/\/[^\s]+:[^\s]+@/i);
  expect(dockerCommandBlock).not.toMatch(/password|secret|apikey|api[_-]?key/i);
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
