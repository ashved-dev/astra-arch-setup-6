import { expect, test } from '@playwright/test';

async function addTodo(page, title) {
  await page.getByRole('textbox', { name: 'Task title' }).fill(title);
  await page.getByRole('button', { name: 'Add task' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Planned edit use case 1: happy path saves inline title updates', async ({ page }) => {
  await addTodo(page, 'Write tests');
  await page.getByRole('button', { name: 'Edit task Write tests' }).click();
  await page.getByRole('textbox', { name: 'Edit title for task Write tests' }).fill('Ship inline todo');
  await page.getByRole('button', { name: 'Save task Write tests' }).click();

  await expect(page.getByText('Ship inline todo')).toBeVisible();
  await expect(page.getByText('Write tests')).toHaveCount(0);
  await expect(page.locator('.todo-row')).toHaveCount(1);
});

test('Planned edit use case 2: validation path rejects whitespace-only edit titles', async ({ page }) => {
  await addTodo(page, 'Review docs');
  await page.getByRole('button', { name: 'Edit task Review docs' }).click();
  await page.getByRole('textbox', { name: 'Edit title for task Review docs' }).fill('   ');
  await page.getByRole('button', { name: 'Save task Review docs' }).click();

  await expect(page.getByText('Task title is required')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel editing Review docs' }).click();
  await expect(page.getByText('Review docs')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Edit title for task Review docs' })).toHaveCount(0);
});

test('Planned edit use case 3: cancel path keeps original title', async ({ page }) => {
  await addTodo(page, 'Draft API');
  await page.getByRole('button', { name: 'Edit task Draft API' }).click();
  await page.getByRole('textbox', { name: 'Edit title for task Draft API' }).fill('Modified API');
  await page.getByRole('button', { name: 'Cancel editing Draft API' }).click();

  await expect(page.getByText('Draft API')).toBeVisible();
  await expect(page.getByText('Modified API')).toHaveCount(0);
});

test('Planned edit use case 4: persistence keeps edited title after reload', async ({ page }) => {
  await addTodo(page, 'Persist todo');
  await page.getByRole('button', { name: 'Edit task Persist todo' }).click();
  await page.getByRole('textbox', { name: 'Edit title for task Persist todo' }).fill('Persisted todo');
  await page.getByRole('button', { name: 'Save task Persist todo' }).click();

  await page.reload();
  await expect(page.getByText('Persisted todo')).toBeVisible();
  await expect(page.getByText('Persist todo')).toHaveCount(0);
});

test('Planned edit use case 5: completed-filter edit flow keeps filtered item visible', async ({ page }) => {
  await addTodo(page, 'Active task');
  await addTodo(page, 'Completed task');
  await page.getByRole('button', { name: 'Mark task Completed task as completed' }).click();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();

  await expect(page.locator('.todo-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit task Completed task' }).click();
  await page.getByRole('textbox', { name: 'Edit title for task Completed task' }).fill('Completed task edited');
  await page.getByRole('button', { name: 'Save task Completed task' }).click();

  await expect(page.getByText('Completed task edited')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark task Completed task edited as active' })).toBeVisible();
  await expect(page.getByText('Active task')).toHaveCount(0);
});

test('Planned edit use case 6: responsive edit-save flow at 390px has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  await addTodo(page, 'Mobile flow');
  await page.getByRole('button', { name: 'Edit task Mobile flow' }).click();
  await page.getByRole('textbox', { name: 'Edit title for task Mobile flow' }).fill('Mobile flow updated');
  await page.getByRole('button', { name: 'Save task Mobile flow' }).click();
  await expect(page.getByText('Mobile flow updated')).toBeVisible();

  const overflow = await page.evaluate(() => {
    return (
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
      document.documentElement.clientWidth
    );
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
