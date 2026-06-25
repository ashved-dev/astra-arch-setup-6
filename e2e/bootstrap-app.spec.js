import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const projectRoot = process.cwd();

test('Bootstrap render: root route shows app shell without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Todo App' })).toBeVisible();
  await expect(
    page.getByText('React runtime shell is bootstrapped and ready for upcoming task-driven todo behavior.'),
  ).toBeVisible();
  expect(errors).toHaveLength(0);
});

test('Build path: production build completes successfully', async () => {
  const result = execSync('npm run build', {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  expect(result).toContain('dist/index.html');
});

test('Mobile path: app remains visible at 390px viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Todo App' })).toBeVisible();
  const shell = page.locator('.app-shell__frame');
  await expect(shell).toBeVisible();
});
