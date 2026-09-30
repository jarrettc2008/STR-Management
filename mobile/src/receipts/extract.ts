import { cents, decimal, emptyFields, type ReceiptFields } from './domain.ts';
// Conservative receipt-text parser: keeps the untouched OCR alongside these suggestions.
// Ambiguous layouts and reconciliation errors must be corrected in review.
export function parseReceipt(text: string, propertyId: string): ReceiptFields {
  const fields = emptyFields(propertyId);
  fields.taxes = [];
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  fields.merchant = lines.find(line => /[a-z]/i.test(line) && !/^(receipt|invoice|date|tel|phone)\b/i.test(line)) ?? '';
  const date = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  const usDate = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (date) fields.date = `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`;
  else if (usDate) fields.date = `${usDate[3]}-${usDate[1].padStart(2, '0')}-${usDate[2].padStart(2, '0')}`;
  fields.receiptNumber = text.match(/(?:receipt|invoice|transaction)\s*(?:no\.?|#|number)?\s*[:#]?\s*([\w-]{3,})/i)?.[1] ?? '';
  for (const line of lines) {
    const money = line.match(/(-?\$?\d[\d,]*\.\d{2})\s*(?:[A-Z])?$/);
    if (!money) continue;
    const label = line.slice(0, money.index).trim();
    if (!label) continue;
    let value: string;
    try { value = decimal(cents(money[1].replace('-', ''))); } catch { continue; }
    if (/sub\s*total/i.test(label)) fields.subtotal = value;
    else if (/\b(discount|coupon|savings)\b/i.test(label) || money[1].startsWith('-')) fields.discount = decimal(cents(fields.discount) + cents(value));
    else if (/\b(tax|vat|gst|hst)\b/i.test(label)) fields.taxes.push({ id: `tax-${fields.taxes.length}`, label, amount: value });
    else if (/\b(tip|gratuity)\b/i.test(label)) fields.tip = decimal(cents(fields.tip) + cents(value));
    else if (/\b(fee|fees|delivery|shipping)\b/i.test(label)) fields.fees = decimal(cents(fields.fees) + cents(value));
    else if (/\b(total|amount due|balance due)\b/i.test(label)) fields.total = value;
    else if (/\b(cash|change|visa|mastercard|debit|credit|tender|payment|paid|balance)\b/i.test(label)) continue;
    else {
      const qty = label.match(/^(\d+(?:\.\d{1,3})?)\s*[xX@]\s*(.+)/);
      const unit = label.match(/\s+@\s*\$?(\d+\.\d{2})$/);
      fields.items.push({ id: `ocr-${fields.items.length}`, description: qty?.[2] ?? label, quantity: qty?.[1] ?? '1', unitPrice: unit?.[1] ?? '', lineTotal: value, included: true });
    }
  }
  if (!fields.subtotal && fields.items.length) fields.subtotal = decimal(fields.items.reduce((sum, item) => sum + cents(item.lineTotal), 0));
  if (!fields.taxes.length) fields.taxes = [{ id: 'tax-1', label: 'Sales tax', amount: '0.00' }];
  return fields;
}
