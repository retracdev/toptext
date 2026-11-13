// IndexedDB: the working draft and the Stack of finished pictures. Everything stays on this device.
const DB_NAME = 'toptext';
const STACK_LIMIT = 60;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('No IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('stack')) db.createObjectStore('stack', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const saveDraft = (project) => run('kv', 'readwrite', (s) => s.put(project, 'draft')).catch(() => {});
export const loadDraft = () => run('kv', 'readonly', (s) => s.get('draft')).catch(() => null);
export const clearDraft = () => run('kv', 'readwrite', (s) => s.delete('draft')).catch(() => {});

export async function listStack() {
  try {
    const items = await run('stack', 'readonly', (s) => s.getAll());
    return (items || []).sort((a, b) => b.ts - a.ts);
  } catch { return []; }
}

export async function addToStack(item) {
  await run('stack', 'readwrite', (s) => s.put(item));
  const items = await listStack();
  if (items.length > STACK_LIMIT) {
    const extra = items.slice(STACK_LIMIT);
    await run('stack', 'readwrite', (s) => extra.forEach((i) => s.delete(i.id)));
  }
}

export const removeFromStack = (id) => run('stack', 'readwrite', (s) => s.delete(id));
