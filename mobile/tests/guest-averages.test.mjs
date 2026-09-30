import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptDemoData } from '../src/demo/adaptDemoData.ts';
import { guestAverages } from '../src/reservations/guestAnalytics.ts';
import { parseReceipt } from '../src/receipts/extract.ts';
import { approvalIssues } from '../src/receipts/domain.ts';

test('guest averages use on-device demo demographics by period', () => {
  const demo = adaptDemoData(new Date(2026, 8, 28));
  const month = guestAverages(demo.reservations, 'month', demo.currentProperty.id, new Date(2026, 8, 28));
  assert.equal(month.stays, 5);
  assert.ok(month.averageAge !== null && month.averageAge > 20);
  assert.ok(month.averageNights !== null && month.averageNights > 0);
  assert.ok(month.sexKnown > 0);
  assert.ok(month.topHomeLocations.length > 0);
  const half = guestAverages(demo.reservations, '6month', demo.currentProperty.id, new Date(2026, 8, 28));
  assert.ok(half.stays >= month.stays);
});

test('sample receipt fixture text reconciles for verify/edit', () => {
  const text = `HOME DEPOT #412
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
VISA 30.56`;
  const parsed = parseReceipt(text, 'tiger-blvd-516');
  assert.equal(parsed.merchant, 'HOME DEPOT #412');
  assert.equal(parsed.date, '2026-09-18');
  assert.deepEqual(approvalIssues(parsed), []);
});
