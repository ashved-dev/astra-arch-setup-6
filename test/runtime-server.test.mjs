import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { getContentType, toAbsoluteStaticPath } from '../src/runtime/server.js';

test('runtime serves JavaScript and HTML with explicit MIME types', () => {
  assert.equal(getContentType('/foo/app.js'), 'application/javascript; charset=utf-8');
  assert.equal(getContentType('/foo/index.html'), 'text/html; charset=utf-8');
});

test('runtime falls back to octet-stream for unknown extensions', () => {
  assert.equal(getContentType('/foo/random.bin'), 'application/octet-stream');
});

test('runtime resolves index and nested static paths into dist directory', () => {
  const rootPath = toAbsoluteStaticPath('/');
  const assetPath = toAbsoluteStaticPath('/assets/main.css');

  assert.equal(rootPath, path.join(process.cwd(), 'dist', 'index.html'));
  assert.equal(assetPath, path.join(process.cwd(), 'dist', 'assets', 'main.css'));
});

test('runtime blocks path traversal attempts', () => {
  assert.equal(toAbsoluteStaticPath('/../secrets.txt'), null);
  assert.equal(toAbsoluteStaticPath('/%2e%2e%2fsecrets.txt'), null);
});
