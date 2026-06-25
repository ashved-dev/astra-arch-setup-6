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
      },
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');

    const config = getCiConfiguration(tempDir);
    assert.equal(config.hasPackage, true);
    assert.deepEqual(config.commands, ['lint', 'build', 'test']);
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
        deploy: 'echo deploy',
      },
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const config = getCiConfiguration(tempDir);
    assert.equal(config.hasPackage, true);
    assert.deepEqual(config.commands, ['lint', 'build']);
    assert.deepEqual(config.installCommand, ['npm', 'install']);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
