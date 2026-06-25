import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = process.cwd();
const appPath = path.join(projectRoot, 'src', 'App.tsx');
const cssPath = path.join(projectRoot, 'src', 'App.css');

const appText = fs.readFileSync(appPath, 'utf8');
const cssText = fs.readFileSync(cssPath, 'utf8');

test('todo app has interactive state handling and accessibility hooks', () => {
  assert.match(appText, /Simple Todo/);
  assert.match(appText, /useState<Filter/);
  assert.match(appText, /newTodoTitle|handleSubmit|filter/);
  assert.match(appText, /editingTodoId/);
  assert.match(appText, /startEditingTodo|saveEditingTodo|cancelEditingTodo/);
  assert.match(appText, /aria-label={`Mark task /);
  assert.match(appText, /aria-label={`Delete task /);
  assert.match(appText, /aria-label={`Edit task /);
  assert.match(appText, /aria-label={`Save task /);
  assert.match(appText, /aria-label={`Cancel editing /);
});

test('todo css has edit row support and responsive constraints', () => {
  assert.match(cssText, /width:\s*min\(100%\s*-\s*32px,\s*720px\)/);
  assert.match(cssText, /@media \(max-width: 520px\)/);
  assert.match(cssText, /grid-template-columns:\s*1fr\s+auto/);
  assert.match(cssText, /width:\s*calc\(100%\s*-\s*24px\)/);
  assert.match(cssText, /appearance:\s*none/);
  assert.match(cssText, /todo-row\.is-editing/);
  assert.match(cssText, /todo-edit-input/);
  assert.match(cssText, /todo-edit-save|todo-edit-cancel/);
  assert.match(cssText, /edit-validation/);
});
