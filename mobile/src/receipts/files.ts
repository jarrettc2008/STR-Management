import { File, Paths, Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { OriginalFile } from './domain';
export type PickedFile = { uri: string; name: string; mimeType: string; size?: number; file?: Blob };
export async function preserveOriginal(id: string, picked: PickedFile): Promise<OriginalFile> {
  const directory = new Directory(Paths.document, 'receipts');
  directory.create({ idempotent: true, intermediates: true });
  const extension = picked.name.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] ?? '.jpg';
  const storageKey = `${id}${extension}`;
  const source = new File(picked.uri);
  if (source.size > 20 * 1024 * 1024) throw new Error('Choose a receipt smaller than 20 MB.');
  source.copy(new File(directory, storageKey));
  return { storageKey, name: picked.name, mimeType: picked.mimeType, size: source.size };
}
export async function originalUri(original: OriginalFile) { const file = new File(Paths.document, 'receipts', original.storageKey); if (!file.exists) throw new Error('Original receipt file is missing from this device.'); return file.uri; }
export function releaseOriginalUri(_uri: string) { /* Native document paths are persistent, not object URLs. */ }
export async function openOriginal(original: OriginalFile) { const uri = await originalUri(original); if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.'); await Sharing.shareAsync(uri, { mimeType: original.mimeType, dialogTitle: 'Original receipt' }); }
