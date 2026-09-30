import { Image, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import type { PickedFile } from '../receipts/files';

export type ReceiptFixture = {
  id: string;
  name: string;
  mimeType: string;
  /** Bundled image module for Metro / Expo. */
  module: number;
  /** Known on-device OCR text for this fixture (used when native OCR is unavailable). */
  text: string;
  expenseType: 'house' | 'operating';
  /** When seeding, mark as approved so dashboard expense/tax totals are non-empty. */
  seedApproved?: boolean;
};

export const RECEIPT_FIXTURES: ReceiptFixture[] = [
  {
    id: 'home-depot-supplies',
    name: 'home-depot-supplies.png',
    mimeType: 'image/png',
    module: require('../../assets/demo-receipts/home-depot-supplies.png'),
    expenseType: 'house',
    seedApproved: true,
    text: `HOME DEPOT #412
Bentonville, AR 72712
09/18/2026
Receipt # HD-88421
2x Lumber 2x4 8.97
Paint Roller 6.48
Cleaning Supplies 12.50
Subtotal 27.95
State Tax 2.00
City Tax 0.61
Total 30.56
VISA 30.56`,
  },
  {
    id: 'walmart-restock',
    name: 'walmart-restock.png',
    mimeType: 'image/png',
    module: require('../../assets/demo-receipts/walmart-restock.png'),
    expenseType: 'operating',
    seedApproved: true,
    text: `WALMART SUPERCENTER
Rogers, AR 72756
2026-09-12
Invoice # WM-55210
Paper Towels 9.98
Toilet Paper 14.47
Dish Soap 3.24
Trash Bags 7.86
Subtotal 35.55
Sales tax 2.84
Total 38.39
DEBIT 38.39`,
  },
  {
    id: 'lowes-maintenance',
    name: 'lowes-maintenance.png',
    mimeType: 'image/png',
    module: require('../../assets/demo-receipts/lowes-maintenance.png'),
    expenseType: 'house',
    seedApproved: false,
    text: `LOWE'S OF BENTONVILLE
09/05/2026
Receipt # LW-11903
1x Hot Tub Filter 24.99
Water Test Kit 11.50
Chlorine Tablets 18.75
Subtotal 55.24
Tax 4.42
Total 59.66
MASTERCARD 59.66`,
  },
  {
    id: 'costco-household',
    name: 'costco-household.jpg',
    mimeType: 'image/jpeg',
    module: require('../../assets/demo-receipts/costco-household.jpg'),
    expenseType: 'operating',
    seedApproved: false,
    text: `COSTCO WHOLESALE
2026-08-28
Transaction # CS-44012
2x Laundry Detergent 19.99
Guest Towels 29.99
Snack Variety Pack 16.49
Subtotal 66.47
Tax 5.32
Total 71.79
VISA 71.79`,
  },
];

export function matchReceiptFixture(name: string): ReceiptFixture | undefined {
  const base = name.split('/').pop()?.toLowerCase() ?? '';
  return RECEIPT_FIXTURES.find((f) => f.name.toLowerCase() === base || base.includes(f.id));
}

function isFileUri(uri: string | null | undefined): uri is string {
  return typeof uri === 'string' && /^file:\/\//i.test(uri);
}

/**
 * Materialize a Metro/http asset into the cache as a real file:// URI when needed.
 * Expo Go often leaves Asset.localUri as an http(s) Metro URL, which expo-file-system
 * File.validatePath rejects (requires file://).
 */
async function materializeRemoteAsset(uri: string, fileName: string): Promise<string | null> {
  try {
    const cacheRoot = Paths.cache?.uri;
    if (!cacheRoot || !isFileUri(cacheRoot)) return null;
    const directory = new Directory(Paths.cache, 'demo-receipts');
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, fileName);
    const downloaded = await File.downloadFileAsync(uri, destination, { idempotent: true });
    return isFileUri(downloaded.uri) ? downloaded.uri : isFileUri(destination.uri) ? destination.uri : null;
  } catch {
    return null;
  }
}

/** Resolve a Metro asset module to a usable URI on native, web, and Expo Go. */
export async function uriFromAssetModule(moduleId: number, fileName = 'sample-receipt.bin'): Promise<string> {
  try {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    if (isFileUri(asset.localUri)) return asset.localUri;
    // Expo Go: downloadAsync may leave localUri null or as http(s) — materialize to cache.
    const remote = asset.localUri || asset.uri;
    if (remote && /^https?:\/\//i.test(remote)) {
      const materialized = await materializeRemoteAsset(remote, fileName);
      if (materialized) return materialized;
      return remote; // preserveOriginal will fetch+write
    }
    if (remote) return remote;
  } catch {
    /* fall through */
  }
  const resolve = typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource.bind(Image) : null;
  const resolved = resolve?.(moduleId);
  if (resolved?.uri) {
    if (isFileUri(resolved.uri)) return resolved.uri;
    if (/^https?:\/\//i.test(resolved.uri)) {
      const materialized = await materializeRemoteAsset(resolved.uri, fileName);
      if (materialized) return materialized;
    }
    return resolved.uri;
  }
  throw new Error(`Sample receipt image could not be loaded on this device (${Platform.OS}).`);
}

export async function pickedFileFromFixture(fixture: ReceiptFixture): Promise<PickedFile> {
  const uri = await uriFromAssetModule(fixture.module, fixture.name);
  return { uri, name: fixture.name, mimeType: fixture.mimeType };
}
