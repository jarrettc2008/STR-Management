import type { OriginalFile } from './domain';
export type PickedFile = { uri: string; name: string; mimeType: string; size?: number; file?: Blob };
function database(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open('staywell-receipt-files', 1); request.onupgradeneeded = () => request.result.createObjectStore('originals'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Receipt file storage is unavailable in this browser.')); }); }
export async function preserveOriginal(id: string, picked: PickedFile): Promise<OriginalFile> {
  const blob = picked.file ?? await (await fetch(picked.uri)).blob();
  if (blob.size > 20 * 1024 * 1024) throw new Error('Choose a receipt smaller than 20 MB.');
  const db = await database();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('originals', 'readwrite'); tx.objectStore('originals').put(blob, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error('Could not preserve the original receipt. Browser storage may be full.')); tx.onabort = () => reject(new Error('Receipt file save was interrupted.')); }); } finally { db.close(); }
  return { storageKey: id, name: picked.name, mimeType: picked.mimeType || blob.type, size: blob.size };
}
export async function originalUri(original: OriginalFile) {
  const db = await database();
  try { const blob = await new Promise<Blob>((resolve, reject) => { const request = db.transaction('originals', 'readonly').objectStore('originals').get(original.storageKey); request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error('Original file is missing from browser storage.')); request.onerror = () => reject(new Error('Could not read the original receipt.')); }); return URL.createObjectURL(blob); } finally { db.close(); }
}
export function releaseOriginalUri(uri: string) { URL.revokeObjectURL(uri); }
export async function openOriginal(original: OriginalFile) { const uri = await originalUri(original); const link = document.createElement('a'); link.href = uri; link.download = original.name; link.click(); setTimeout(() => releaseOriginalUri(uri), 30000); }
