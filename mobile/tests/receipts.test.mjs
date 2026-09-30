import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateReceipt, approvalIssues, approvedTotal, cents, decimal, emptyFields, quantityTotal } from '../src/receipts/domain.ts';
import { parseReceipt } from '../src/receipts/extract.ts';
function receipt() {
  return { ...emptyFields('property'), merchant: 'Store', date: '2026-09-20', subtotal: '100.00', total: '110.00', taxes: [{ id: 'tax', label: 'Tax', amount: '10.00' }], items: [{ id: 'str', description: 'Property supplies', quantity: '1', unitPrice: '80.00', lineTotal: '80.00', included: true }, { id: 'personal', description: 'Personal', quantity: '1', unitPrice: '20.00', lineTotal: '20.00', included: false }] };
}
test('80 eligible / 100 subtotal allocates 8 tax and produces 88 expense', () => {
  const source = receipt(); const before = JSON.stringify(source); const result = allocateReceipt(source);
  assert.equal(result.eligibleSubtotal, 8000); assert.equal(result.allocatedTax, 800); assert.equal(result.eligibleTotal, 8800); assert.equal(result.excludedAmount, 2200); assert.deepEqual(approvalIssues(source), []); assert.equal(JSON.stringify(source), before);
});
test('all included and all excluded preserve original total', () => {
  const source = receipt(); source.items = source.items.map(i => ({ ...i, included: true }));
  assert.equal(allocateReceipt(source).eligibleTotal, 11000);
  source.items = source.items.map(i => ({ ...i, included: false }));
  const result = allocateReceipt(source); assert.equal(result.eligibleTotal, 0); assert.equal(result.excludedAmount, 11000);
});
test('discounts, multiple taxes, fees and tips share the same exact item ratio', () => {
  const source = { ...receipt(), discount: '10.00', taxes: [{ id: 'state', label: 'State tax', amount: '6.00' }, { id: 'city', label: 'City tax', amount: '3.00' }], tip: '5.00', fees: '2.00', total: '106.00' };
  const result = allocateReceipt(source);
  assert.equal(result.allocatedDiscount, 800); assert.equal(result.allocatedTax, 720); assert.equal(result.allocatedTip, 400); assert.equal(result.allocatedFees, 160); assert.equal(result.eligibleTotal, 8480); assert.deepEqual(result.issues, []);
});
test('fractional cents and one-cent receipt rounding are deterministic', () => {
  const source = { ...receipt(), subtotal: '0.03', total: '0.05', taxes: [{ id: 'tax', label: 'Tax', amount: '0.01' }], items: receipt().items.map((item, i) => ({ ...item, unitPrice: '', lineTotal: i === 0 ? '0.01' : '0.02' })) };
  const result = allocateReceipt(source); assert.equal(result.reconciliation, 1); assert.equal(result.eligibleTotal, 1); assert.equal(result.excludedAmount, 4);
  assert.equal(quantityTotal('1.5', '0.01'), 2); assert.equal(cents('0.29') + cents('0.01'), 30); assert.equal(decimal(30), '0.30');
});
test('zero tax, zero denominator, and invalid/unreconciled amounts are explicit', () => {
  const source = { ...receipt(), taxes: [], total: '100.00' }; assert.equal(allocateReceipt(source).eligibleTotal, 8000);
  assert.ok(approvalIssues({ ...source, total: '99.00' }).length);
  assert.ok(approvalIssues({ ...source, subtotal: '90.00' }).length);
  assert.ok(approvalIssues({ ...source, discount: '101.00' }).length);
  assert.ok(approvalIssues(emptyFields('property')).length);
  for (const value of ['NaN', '1e3', '-1', '0.001']) assert.throws(() => cents(value));
});
test('approved reports exclude drafts and a tax override cannot exceed receipt tax', () => {
  const fields = receipt(); assert.equal(approvedTotal([{ status: 'draft', reviewed: fields }, { status: 'approved', reviewed: fields }]), 8800);
  assert.equal(allocateReceipt({ ...fields, taxOverride: '7.00' }).eligibleTotal, 8700);
  assert.ok(approvalIssues({ ...fields, taxOverride: '11.00' }).length);
});
test('OCR suggestions extract quantities, multiple tax lines and receipt fields for review', () => {
  const parsed = parseReceipt('HOME DEPOT\n09/20/2026\nReceipt # ABC123\n2x Lumber 8.97\nPaint Roller 6.48\nCleaning Supplies 12.50\nSubtotal 27.95\nState Tax 2.00\nCity Tax 0.61\nTotal 30.56\nVISA 30.56', 'property');
  assert.equal(parsed.merchant, 'HOME DEPOT'); assert.equal(parsed.date, '2026-09-20'); assert.equal(parsed.receiptNumber, 'ABC123'); assert.equal(parsed.items.length, 3); assert.equal(parsed.items[0].quantity, '2'); assert.equal(parsed.taxes.length, 2); assert.equal(allocateReceipt(parsed).eligibleTotal, 3056); assert.deepEqual(approvalIssues(parsed), []);
});
test('OCR that does not reconcile never qualifies for approval', () => {
  const parsed = parseReceipt('STORE\n09/20/2026\nTowels 20.00\nSubtotal 80.00\nTotal 90.00', 'property');
  assert.ok(approvalIssues(parsed).length);
});
