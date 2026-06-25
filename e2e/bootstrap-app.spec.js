import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { createMockTodoApi } from './utils/todoApiMock.js';

const projectRoot = process.cwd();

function withCleanBuildWorkspace(fn) {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'astra-as6-bootstrap-'));
  const skipPaths = new Set(['node_modules', 'dist', '.git', 'test-results', '.github/workflows']);

  cpSync(projectRoot, workspace, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(projectRoot, source);
      const topLevel = relative.split(path.sep)[0];
      return !skipPaths.has(topLevel) && !relative.startsWith('.vite');
    },
  });

  try {
    return fn(workspace);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

test('Bootstrap render: root route shows app shell without runtime errors', async ({ page }) => {
  const todoApi = await createMockTodoApi(page);
  await todoApi.clear();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Simple Todo' })).toBeVisible();
  await expect(page.getByText('0 total, 0 active, 0 completed')).toBeVisible();
  expect(errors).toHaveLength(0);
});

test('Build path: production build completes successfully', async () => {
  const output = withCleanBuildWorkspace((workspace) => {
    return execSync('npm ci && npm run build', {
      cwd: workspace,
      encoding: 'utf8',
      stdio: 'pipe',
      shell: true,
    });
  });

  expect(output).toContain('dist/index.html');
});

test('Mobile path: app remains visible at 390px viewport width', async ({ page }) => {
  const todoApi = await createMockTodoApi(page);
  await todoApi.clear();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Simple Todo' })).toBeVisible();
  const shell = page.locator('.todo-page');
  await expect(shell).toBeVisible();
});
