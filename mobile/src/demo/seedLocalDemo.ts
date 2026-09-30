import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENT_PROPERTY } from '../property';
import { allocateReceipt, type Receipt } from '../receipts/domain';
import { parseReceipt } from '../receipts/extract';
import { preserveOriginal } from '../receipts/files';
import { updateMileage, readMileage } from '../mileageStore';
import { RECEIPT_FIXTURES, pickedFileFromFixture } from './receiptFixtures';
import { demoMileageTrips, demoTaxPayments } from './demoLocalSamples';
import { readTaxPayments, writeTaxPayments } from '../tax/taxStore';

export { demoMileageTrips, demoTaxPayments } from './demoLocalSamples';

const RECEIPT_PREFIX = 'staywell.receipt.v1:';
const SEED_FLAG = 'staywell.demoLocalSeed.v1';

export async function seedDemoMileage() {
  const samples = demoMileageTrips();
  await updateMileage((state) => {
    const kept = state.trips.filter((t) => !t.id.startsWith('demo-trip-'));
    return { ...state, trips: [...kept, ...samples].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) };
  });
  return (await readMileage()).trips.filter((t) => t.id.startsWith('demo-trip-')).length;
}

export async function seedDemoReceipts(options?: { replace?: boolean }) {
  let created = 0;
  for (const fixture of RECEIPT_FIXTURES) {
    const id = `demo-receipt-${fixture.id}`;
    const key = `${RECEIPT_PREFIX}${id}`;
    if (!options?.replace && (await AsyncStorage.getItem(key))) continue;
    const picked = await pickedFileFromFixture(fixture);
    const original = await preserveOriginal(id, picked);
    const extracted = parseReceipt(fixture.text, CURRENT_PROPERTY.id);
    extracted.expenseType = fixture.expenseType;
    extracted.notes = 'Demo sample receipt · autofilled from on-device fixture text. Verify before approving.';
    const now = new Date().toISOString();
    const approved = !!fixture.seedApproved;
    const calculated = approved ? allocateReceipt(extracted) : undefined;
    const receipt: Receipt = {
      id,
      ownerId: CURRENT_PROPERTY.ownerId,
      original,
      extraction: {
        rawText: fixture.text,
        fields: extracted,
        engine: 'Demo fixture text (on-device · OCR bypass for samples)',
        capturedAt: now,
      },
      reviewed: extracted,
      status: approved ? 'approved' : 'draft',
      createdAt: now,
      updatedAt: now,
      approvedAt: approved ? now : undefined,
      calculated,
      revisions: [],
    };
    await AsyncStorage.setItem(key, JSON.stringify({ version: 1, receipt }));
    created += 1;
  }
  await AsyncStorage.setItem(SEED_FLAG, new Date().toISOString());
  return created;
}

export async function seedDemoTaxPayments(_options?: { replace?: boolean }) {
  const samples = demoTaxPayments();
  const existing = await readTaxPayments();
  const kept = existing.filter(p => !p.id.startsWith('demo-tax-'));
  await writeTaxPayments([...kept, ...samples]);
  return samples.length;
}

/** Seeds mileage + receipt samples + tax payments into local device storage (not cloud). */
export async function seedOnDeviceDemoData(options?: { replace?: boolean }) {
  const trips = await seedDemoMileage();
  const receipts = await seedDemoReceipts(options);
  const taxPayments = await seedDemoTaxPayments(options);
  return { trips, receipts, taxPayments };
}
