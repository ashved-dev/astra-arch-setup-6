import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = process.cwd();
const appPath = path.join(projectRoot, 'src', 'App.tsx');
const cssPath = path.join(projectRoot, 'src', 'App.css');

const appText = fs.readFileSync(appPath, 'utf8');
const cssText = fs.readFileSync(cssPath, 'utf8');

test('todo ui has the reference-driven structure and sample states', () => {
  assert.match(appText, /Simple Todo/);
  assert.match(appText, /3 total, 2 active, 1 completed/);
  assert.match(appText, /Draft the first task/);
  assert.match(appText, /Create project shell/);
  assert.match(appText, /Verify mobile layout/);
  assert.match(appText, /is-empty|is-complete|todo-empty|todo-row/);
  assert.match(appText, /aria-label="Todo filters"/);
});

test('todo css has desktop and mobile responsive constraints', () => {
  assert.match(cssText, /width:\s*min\(100%\s*-\s*32px,\s*720px\)/);
  assert.match(cssText, /@media \(max-width: 520px\)/);
  assert.match(cssText, /grid-template-columns:\s*1fr\s+auto/);
  assert.match(cssText, /width:\s*calc\(100%\s*-\s*24px\)/);
});
