import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReceipt } from '../src/receipts/extract.ts';
import { allocateReceipt, approvalIssues } from '../src/receipts/domain.ts';
import { buildTaxSummary, IRS_STANDARD_MILEAGE_CENTS_PER_MILE } from '../src/tax/taxSummary.ts';
import { demoMileageTrips, demoTaxPayments } from '../src/demo/demoLocalSamples.ts';

const HOME_DEPOT = `HOME DEPOT #412
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

const WALMART = `WALMART SUPERCENTER
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
DEBIT 38.39`;

test('seed-approved receipt fixture texts reconcile for approval', () => {
  for (const [label, text, expenseType] of [['home-depot', HOME_DEPOT, 'house'], ['walmart', WALMART, 'operating']]) {
    const fields = parseReceipt(text, 'tiger-blvd-516');
    fields.expenseType = expenseType;
    assert.deepEqual(approvalIssues(fields), [], label);
    assert.ok(allocateReceipt(fields).eligibleTotal > 0);
  }
});

test('demo mileage includes GPS routes and tax summary aggregates local data', () => {
  const today = new Date(2026, 8, 30);
  const trips = demoMileageTrips(today);
  assert.ok(trips.filter(t => (t.route?.length ?? 0) > 2).length >= 2);
  const payments = demoTaxPayments(today);
  assert.ok(payments.some(p => p.kind === 'property'));
  assert.ok(payments.some(p => p.kind === 'lodging'));
  const summary = buildTaxSummary({
    period: 'This month',
    today: '2026-09-30',
    receipts: [],
    trips,
    payments,
  });
  assert.equal(summary.mileageEstimateCents, Math.round(summary.mileageMiles * IRS_STANDARD_MILEAGE_CENTS_PER_MILE));
  assert.ok(summary.mileageEstimateCents > 0);
  assert.ok(summary.propertyTaxCents > 0);
  assert.ok(summary.deductibleIshTotalCents >= summary.mileageEstimateCents + summary.propertyTaxCents);
});
