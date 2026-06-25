import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = process.cwd();
const packagePath = path.join(projectRoot, 'package.json');

test('package scripts and vite frontend dependencies are configured', () => {
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const scripts = packageData.scripts ?? {};
  const deps = packageData.devDependencies ?? {};

  assert.equal(scripts.dev, 'vite');
  assert.equal(scripts.build, 'vite build');
  assert.equal(scripts.preview, 'vite preview --host 0.0.0.0');
  assert.equal(scripts.lint, 'tsc --noEmit');
  assert.equal(scripts.test, 'node --test test/**/*.test.mjs');
  assert.equal(scripts.e2e, 'playwright test');

  assert.ok(deps.vite, 'vite is required');
  assert.ok(deps.react, 'react is required');
  assert.ok(deps['react-dom'], 'react-dom is required');
  assert.ok(deps['@vitejs/plugin-react'], 'react plugin is required');
  assert.ok(deps.typescript, 'typescript is required');
});

test('frontend entry files are present', () => {
  assert.ok(fs.existsSync(path.join(projectRoot, 'vite.config.ts')));
  assert.ok(fs.existsSync(path.join(projectRoot, 'index.html')));
  assert.ok(fs.existsSync(path.join(projectRoot, 'src', 'main.tsx')));
  assert.ok(fs.existsSync(path.join(projectRoot, 'src', 'App.tsx')));
});
