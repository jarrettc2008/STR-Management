export const EXPENSE_TYPES = [{ id: 'house', label: 'House Expense' }, { id: 'operating', label: 'Operating Cost' }];
export type ReceiptItem = { id: string; description: string; quantity: string; unitPrice: string; lineTotal: string; included: boolean };
export type TaxLine = { id: string; label: string; amount: string };
export type ReceiptFields = { merchant: string; date: string; receiptNumber: string; subtotal: string; discount: string; taxes: TaxLine[]; tip: string; fees: string; total: string; items: ReceiptItem[]; expenseType: string; propertyId: string; notes: string; taxOverride: string };
export type OriginalFile = { storageKey: string; name: string; mimeType: string; size: number };
export type Extraction = { rawText: string; fields: ReceiptFields; engine: string; capturedAt: string };
export type Receipt = { id: string; ownerId: string; original: OriginalFile; extraction: Extraction | null; reviewed: ReceiptFields; status: 'draft' | 'approved'; createdAt: string; updatedAt: string; approvedAt?: string; calculated?: Allocation; revisions: { at: string; fields: ReceiptFields; status: string }[] };
export type Allocation = { originalTotal: number; gross: number; eligibleGross: number; eligibleSubtotal: number; allocatedDiscount: number; allocatedTax: number; allocatedTip: number; allocatedFees: number; allocatedRounding: number; eligibleTotal: number; excludedAmount: number; reconciliation: number; issues: string[] };
export const emptyFields = (propertyId: string): ReceiptFields => ({ merchant: '', date: '', receiptNumber: '', subtotal: '', discount: '0.00', taxes: [{ id: 'tax-1', label: 'Sales tax', amount: '0.00' }], tip: '0.00', fees: '0.00', total: '', items: [], expenseType: 'house', propertyId, notes: '', taxOverride: '' });
// Parse decimal text directly to integer cents. No binary-float currency multiplication.
export function cents(value: string): number {
  const normalized = value.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Enter a nonnegative dollar amount with at most two decimals.');
  const [whole, fraction = ''] = normalized.split('.');
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount > 10000000000n) throw new Error('Amount exceeds the supported receipt limit.');
  return Number(amount);
}
export function decimal(amount: number) { return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, '0')}`; }
export function dollars(amount: number) { return `${amount < 0 ? '-' : ''}$${decimal(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`; }
function roundedRatio(amount: number, numerator: number, denominator: number) {
  if (!denominator) return 0;
  const product = BigInt(amount) * BigInt(numerator);
  return Number((product + BigInt(denominator) / 2n) / BigInt(denominator));
}
export function quantityTotal(quantity: string, unitPrice: string) {
  if (!/^\d+(\.\d{1,3})?$/.test(quantity) || !/[1-9]/.test(quantity)) throw new Error('Quantity must be positive, with at most three decimals.');
  const [whole, part = ''] = quantity.split('.');
  const units = BigInt(whole) * 1000n + BigInt(part.padEnd(3, '0'));
  const amount = (units * BigInt(cents(unitPrice)) + 500n) / 1000n;
  if (amount > 10000000000n) throw new Error('Line total is too large.');
  return Number(amount);
}
export function allocateReceipt(fields: ReceiptFields): Allocation {
  const issues: string[] = [];
  const read = (value: string, label: string) => { try { return cents(value); } catch { issues.push(`${label}: enter a valid amount.`); return 0; } };
  let gross = 0, eligibleGross = 0;
  if (!fields.items.length) issues.push('Add at least one line item.');
  for (const item of fields.items) {
    const line = read(item.lineTotal, item.description || 'Line total');
    gross += line;
    if (item.included) eligibleGross += line;
    if (!item.description.trim()) issues.push('Every item needs a description.');
    try { const expected = quantityTotal(item.quantity, item.unitPrice || '0'); if (item.unitPrice && Math.abs(expected - line) > 1) issues.push(`${item.description}: quantity × unit price does not match the line total.`); } catch { issues.push(`${item.description || 'Item'}: check quantity and unit price.`); }
  }
  const subtotal = read(fields.subtotal, 'Subtotal');
  const discount = read(fields.discount, 'Discount');
  const taxes = fields.taxes.map(t => read(t.amount, t.label || 'Tax'));
  const tax = taxes.reduce((a, b) => a + b, 0);
  const tip = read(fields.tip, 'Tip');
  const fees = read(fields.fees, 'Fees');
  const originalTotal = read(fields.total, 'Receipt total');
  if (subtotal !== gross) issues.push(`Line totals differ from subtotal by ${dollars(Math.abs(subtotal - gross))}. Correct the lines or subtotal before approving.`);
  if (discount > gross) issues.push('Discount cannot exceed the item subtotal.');
  const reconciliation = originalTotal - (subtotal - discount + tax + tip + fees);
  if (Math.abs(reconciliation) > 1) issues.push(`Receipt totals differ by ${dollars(Math.abs(reconciliation))}. Reconcile before approving.`);
  if (gross === 0 && originalTotal !== 0) issues.push('A nonzero receipt needs a nonzero item subtotal for allocation.');
  const share = (amount: number) => roundedRatio(amount, eligibleGross, gross);
  const allocatedDiscount = share(Math.min(discount, gross));
  let allocatedTax = share(tax);
  if (fields.taxOverride.trim()) { allocatedTax = read(fields.taxOverride, 'Allocated tax override'); if (allocatedTax > tax || (eligibleGross === 0 && allocatedTax > 0)) issues.push('Allocated tax must be within receipt tax and zero when no items are included.'); }
  const allocatedTip = share(tip), allocatedFees = share(fees);
  const allocatedRounding = Math.abs(reconciliation) <= 1 ? Math.sign(reconciliation) * share(Math.abs(reconciliation)) : 0;
  const eligibleSubtotal = eligibleGross - allocatedDiscount;
  const eligibleTotal = eligibleSubtotal + allocatedTax + allocatedTip + allocatedFees + allocatedRounding;
  return { originalTotal, gross, eligibleGross, eligibleSubtotal, allocatedDiscount, allocatedTax, allocatedTip, allocatedFees, allocatedRounding, eligibleTotal, excludedAmount: originalTotal - eligibleTotal, reconciliation, issues };
}
export function approvalIssues(fields: ReceiptFields) {
  const issues = [...allocateReceipt(fields).issues];
  if (!fields.merchant.trim()) issues.push('Merchant is required.');
  const d = new Date(`${fields.date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== fields.date) issues.push('Enter a valid receipt date (YYYY-MM-DD).');
  if (!EXPENSE_TYPES.some(t => t.id === fields.expenseType)) issues.push('Choose an expense type.');
  if (!fields.propertyId) issues.push('Choose a property.');
  return issues;
}
export function approvedTotal(receipts: Receipt[]) { return receipts.filter(r => r.status === 'approved').reduce((sum, r) => sum + allocateReceipt(r.reviewed).eligibleTotal, 0); }
