import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTodosFromStorage, saveTodosToStorage, TODO_STORAGE_KEY } from '../src/todoStorage.js';

function createStorageStub() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    dump() {
      return store;
    },
  };
}

test('loadTodosFromStorage returns an empty list for missing storage', () => {
  const storage = createStorageStub();
  assert.deepEqual(loadTodosFromStorage(storage), []);
});

test('loadTodosFromStorage returns an empty list for malformed JSON', () => {
  const storage = createStorageStub();
  storage.setItem(TODO_STORAGE_KEY, '{bad json]');
  assert.deepEqual(loadTodosFromStorage(storage), []);
});

test('loadTodosFromStorage ignores malformed todo shapes and returns only valid rows', () => {
  const storage = createStorageStub();
  storage.setItem(
    TODO_STORAGE_KEY,
    JSON.stringify([
      { id: 1, title: 'Valid', complete: false },
      { id: 'bad-id', title: 'Bad id', complete: false },
      { title: '', complete: false },
      { id: 2, title: 'Another valid', complete: 'oops' },
    ]),
  );

  assert.deepEqual(loadTodosFromStorage(storage), [
    { id: 1, title: 'Valid', complete: false },
    { id: 2, title: 'Another valid', complete: false },
  ]);
});

test('saveTodosToStorage serializes todos and can be reloaded', () => {
  const storage = createStorageStub();
  saveTodosToStorage([{ id: 1, title: 'Persist', complete: true }], storage);

  assert.equal(storage.getItem(TODO_STORAGE_KEY), '[{"id":1,"title":"Persist","complete":true}]');
  assert.deepEqual(loadTodosFromStorage(storage), [{ id: 1, title: 'Persist', complete: true }]);
});

