import { File, Paths, Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { OriginalFile } from './domain';

export type PickedFile = { uri: string; name: string; mimeType: string; size?: number; file?: Blob };

const MAX_BYTES = 20 * 1024 * 1024;

function isFileUri(uri: string): boolean {
  return /^file:\/\//i.test(uri);
}

function receiptsDirectory(): Directory {
  const rootUri = Paths.document?.uri;
  if (!rootUri || typeof rootUri !== 'string' || !isFileUri(rootUri)) {
    throw new Error('Document storage is unavailable on this device.');
  }
  const directory = new Directory(Paths.document, 'receipts');
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

async function readPickedBytes(picked: PickedFile): Promise<Uint8Array> {
  if (picked.file && typeof picked.file.arrayBuffer === 'function') {
    return new Uint8Array(await picked.file.arrayBuffer());
  }
  const response = await fetch(picked.uri);
  // Some React Native local schemes report status 0 even on success.
  if (!response.ok && response.status !== 0) {
    throw new Error('Could not read the receipt file.');
  }
  return new Uint8Array(await response.arrayBuffer());
}

function writeBytes(destination: File, bytes: Uint8Array): void {
  if (destination.exists) destination.delete();
  destination.write(bytes);
}

/**
 * Persist a picked receipt into the app documents directory.
 * Expo Go sample assets often resolve to Metro http(s) URIs — `new File(httpUri)`
 * fails native validatePath (requires file://). Non-file schemes are fetched and written.
 */
export async function preserveOriginal(id: string, picked: PickedFile): Promise<OriginalFile> {
  if (!picked?.uri || typeof picked.uri !== 'string') {
    throw new Error('Receipt file path is missing.');
  }

  const directory = receiptsDirectory();
  const extension = picked.name.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] ?? '.jpg';
  const storageKey = `${id}${extension}`;
  const destination = new File(directory, storageKey);

  if (!isFileUri(picked.uri)) {
    const bytes = await readPickedBytes(picked);
    if (bytes.byteLength > MAX_BYTES) throw new Error('Choose a receipt smaller than 20 MB.');
    if (bytes.byteLength === 0) throw new Error('Receipt file is empty or could not be read.');
    writeBytes(destination, bytes);
    return { storageKey, name: picked.name, mimeType: picked.mimeType, size: bytes.byteLength };
  }

  try {
    const source = new File(picked.uri);
    const size = typeof source.size === 'number' ? source.size : 0;
    if (size > MAX_BYTES) throw new Error('Choose a receipt smaller than 20 MB.');
    if (destination.exists) destination.delete();
    source.copySync(destination, { overwrite: true });
    return { storageKey, name: picked.name, mimeType: picked.mimeType, size: size || destination.size };
  } catch (error) {
    if (error instanceof Error && /20 MB/.test(error.message)) throw error;
    // Fall back when File rejects the URI or copy fails (e.g. odd cache paths).
    const bytes = await readPickedBytes(picked);
    if (bytes.byteLength > MAX_BYTES) throw new Error('Choose a receipt smaller than 20 MB.');
    if (bytes.byteLength === 0) throw new Error('Receipt file is empty or could not be read.');
    writeBytes(destination, bytes);
    return { storageKey, name: picked.name, mimeType: picked.mimeType, size: bytes.byteLength };
  }
}

export async function originalUri(original: OriginalFile) {
  const file = new File(Paths.document, 'receipts', original.storageKey);
  if (!file.exists) throw new Error('Original receipt file is missing from this device.');
  return file.uri;
}

export function releaseOriginalUri(_uri: string) {
  /* Native document paths are persistent, not object URLs. */
}

export async function openOriginal(original: OriginalFile) {
  const uri = await originalUri(original);
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
  await Sharing.shareAsync(uri, { mimeType: original.mimeType, dialogTitle: 'Original receipt' });
}
