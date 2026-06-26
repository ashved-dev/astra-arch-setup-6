import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import test from 'node:test';
import { getCiConfiguration } from '../scripts/ci-gates.mjs';

test('returns skip configuration when package.json is missing', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'astra-ci-no-package-'));
  try {
    const config = getCiConfiguration(tempDir);
    assert.equal(config.hasPackage, false);
    assert.equal(config.commands.length, 0);
    assert.equal(config.installCommand, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('detects npm ci when lockfile is present and selects available scripts', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'astra-ci-with-package-'));
  try {
    const packageJson = {
      name: 'ci-bootstrap',
      scripts: {
        lint: 'echo lint',
        build: 'echo build',
        test: 'echo test',
        e2e: 'echo e2e',
      },
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');

    const config = getCiConfiguration(tempDir);
    assert.equal(config.hasPackage, true);
    assert.deepEqual(config.commands, ['lint', 'build', 'test', 'e2e']);
    assert.deepEqual(config.installCommand, ['npm', 'ci']);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('prefers npm install when lockfile is missing and keeps only supported scripts', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'astra-ci-no-lockfile-'));
  try {
    const packageJson = {
      name: 'ci-bootstrap',
      scripts: {
        lint: 'echo lint',
        build: 'echo build',
        test: '',
        e2e: 'echo e2e',
        deploy: 'echo deploy',
      },
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const config = getCiConfiguration(tempDir);
    assert.equal(config.hasPackage, true);
    assert.deepEqual(config.commands, ['lint', 'build', 'e2e']);
    assert.deepEqual(config.installCommand, ['npm', 'install']);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('workflow contains a Dockerfile validation step in CI config', () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'astra-ci.yml');
  const workflowText = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflowText, /- name:\s*Validate Dockerfile image/);
  assert.match(workflowText, /run:\s+docker build -t astra-arch-setup-6-ci \./);
});

test('QA compose contract exists and includes required app + Postgres services', () => {
  const composePath = path.join(process.cwd(), 'docker-compose.qa.yml');
  const composeText = fs.readFileSync(composePath, 'utf8');

  assert.ok(composeText.includes('services:'));
  assert.ok(/^\s+postgres:\s*$/m.test(composeText));
  assert.ok(/^\s+todo-app:\s*$/m.test(composeText));
  assert.match(composeText, /target:\s*runtime/);
});

test('QA compose contract requires a generated Postgres password and uses it in DATABASE_URL', () => {
  const composePath = path.join(process.cwd(), 'docker-compose.qa.yml');
  const composeText = fs.readFileSync(composePath, 'utf8');

  assert.match(composeText, /\$\{POSTGRES_PASSWORD:\?POSTGRES_PASSWORD is required\}/);
  assert.match(
    composeText,
    /DATABASE_URL:\s*postgres:\/\/postgres:\$\{POSTGRES_PASSWORD:\?POSTGRES_PASSWORD is required\}@postgres:5432\/astra_arch_setup_6/,
  );
});

test('QA compose contract persists Postgres data to a named volume', () => {
  const composePath = path.join(process.cwd(), 'docker-compose.qa.yml');
  const composeText = fs.readFileSync(composePath, 'utf8');

  assert.match(composeText, /- qa_postgres_data:\/var\/lib\/postgresql\/data/);
  assert.match(composeText, /^\s*qa_postgres_data:\s*$/m);
});

test('QA compose contract validates in workflow without real credentials', () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'astra-ci.yml');
  const workflowText = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflowText, /- name:\s*Validate QA compose contract/);
  assert.match(workflowText, /docker compose -f docker-compose\.qa\.yml config/);
  assert.match(workflowText, /POSTGRES_PASSWORD:\s+ci_qa_db_password_non_default/);
});
