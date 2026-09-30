import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PropertyTaxPayment } from './taxSummary';

const KEY = 'staywell.taxPayments.v1';

export async function readTaxPayments(): Promise<PropertyTaxPayment[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw == null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Unreadable tax payment records');
  for (const row of parsed) {
    if (!row || typeof row.id !== 'string' || typeof row.date !== 'string' || typeof row.label !== 'string' || typeof row.amountCents !== 'number' || typeof row.notes !== 'string' || !['property', 'lodging', 'other'].includes(row.kind)) {
      throw new Error('Unreadable tax payment records');
    }
  }
  return parsed as PropertyTaxPayment[];
}

export async function writeTaxPayments(payments: PropertyTaxPayment[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(payments));
}
