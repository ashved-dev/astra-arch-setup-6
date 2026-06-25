import { test, expect } from '@playwright/test';

const rowSelector = 'li.todo-row';

function expectWithinViewport(page, rect) {
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  if (!viewport) {
    return;
  }

  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 8);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 8);
}

test('Desktop visual path: populated todo layout matches panel structure', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Simple Todo' })).toBeVisible();
  await expect(page.getByText('3 total, 2 active, 1 completed')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Task title' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add task' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Active' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();

  await expect(page.locator(rowSelector)).toHaveCount(3);
  await expect(page.getByText('Draft the first task')).toBeVisible();
  await expect(page.getByText('Create project shell')).toBeVisible();
  await expect(page.getByText('Verify mobile layout')).toBeVisible();

  const pageRoot = page.locator('.todo-page');
  const panel = page.locator('.todo-panel');
  const rootBox = await pageRoot.boundingBox();
  const panelBox = await panel.boundingBox();
  const viewport = page.viewportSize();

  expect(rootBox).toBeTruthy();
  expect(panelBox).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(panelBox.width).toBeLessThanOrEqual(720);
  expect(rootBox.x).toBeGreaterThan(0);
  expect(Math.abs(panelBox.x + panelBox.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(8);
  expect(panelBox.x).toBeGreaterThanOrEqual(0);
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width);

  const completedRow = page.locator('.todo-row.is-complete');
  await expect(completedRow).toHaveCount(1);
});

test('Mobile visual path: stacked add form and in-viewport controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const todoForm = page.locator('.todo-form');
  await expect(todoForm).toBeVisible();

  const titleInput = page.getByRole('textbox', { name: 'Task title' });
  const addButton = page.getByRole('button', { name: 'Add task' });
  const panel = page.locator('.todo-panel');
  const viewport = page.viewportSize();

  await expect(titleInput).toBeVisible();
  await expect(addButton).toBeVisible();
  await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Active' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();

  const formRect = await todoForm.boundingBox();
  const inputRect = await titleInput.boundingBox();
  const buttonRect = await addButton.boundingBox();
  expect(formRect).toBeTruthy();
  expect(inputRect).toBeTruthy();
  expect(buttonRect).toBeTruthy();

  expect(inputRect.width).toBeLessThanOrEqual(formRect.width + 1);
  expect(buttonRect.width).toBeLessThanOrEqual(formRect.width + 1);
  expect(buttonRect.y).toBeGreaterThan(inputRect.y + inputRect.height - 4);

  const deleteButtons = page.getByRole('button', { name: /^Delete task/ });
  await expect(deleteButtons).toHaveCount(3);
  const deleteCount = await deleteButtons.count();
  for (let i = 0; i < deleteCount; i += 1) {
    const rect = await deleteButtons.nth(i).boundingBox();
    expect(rect).toBeTruthy();
    expectWithinViewport(page, rect);
  }

  const panelRect = await panel.boundingBox();
  expect(panelRect).toBeTruthy();
  expect(panelRect.width).toBeLessThanOrEqual(viewport.width + 1);
  expectWithinViewport(page, panelRect);
});

test('Empty-state path: panel displays empty message when no todos exist', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?state=empty');

  await expect(page.getByRole('heading', { name: 'Simple Todo' })).toBeVisible();
  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.locator(rowSelector)).toHaveCount(0);
});

test('Accessibility path: controls expose usable role or labels', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('textbox', { name: 'Task title' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add task' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Active' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible();

  const firstDelete = page.getByRole('button', { name: /^Delete task/ }).first();
  await expect(firstDelete).toBeVisible();
});
