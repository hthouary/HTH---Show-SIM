/**
 * Persist the imported audio file per project in IndexedDB, so a saved project
 * plays back with its track after a reload — without bloating the exported JSON
 * (localStorage couldn't hold audio blobs anyway). Keyed by project id.
 *
 * Every call is best-effort: private mode, quota errors or a missing IndexedDB
 * simply resolve to a no-op / null so audio persistence can never break loading.
 */

const DB_NAME = 'showforge-audio';
const STORE = 'tracks';

export interface StoredAudio {
  name: string;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putAudio(projectId: string, file: File): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ name: file.name, blob: file } as StoredAudio, projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore — audio persistence is a bonus, never a requirement */
  }
}

export async function getAudio(projectId: string): Promise<StoredAudio | null> {
  try {
    const db = await openDb();
    const value = await new Promise<StoredAudio | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(projectId);
      r.onsuccess = () => resolve(r.result as StoredAudio | undefined);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return value ?? null;
  } catch {
    return null;
  }
}

export async function deleteAudio(projectId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}
