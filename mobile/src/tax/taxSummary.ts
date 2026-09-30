import { allocateReceipt, approvedTotal, dollars, EXPENSE_TYPES, type Receipt } from '../receipts/domain.ts';
import { inPeriod, totalMiles, type Trip } from '../mileage.ts';

/** IRS standard mileage rate used only as an on-device estimate label (cents per mile). Not tax advice. */
export const IRS_STANDARD_MILEAGE_CENTS_PER_MILE = 70;

export type PropertyTaxPayment = {
  id: string;
  date: string;
  label: string;
  amountCents: number;
  notes: string;
  kind: 'property' | 'lodging' | 'other';
};

export type TaxCategoryRow = {
  id: string;
  label: string;
  amountCents: number;
  subtitle: string;
};

export type TaxSummary = {
  period: string;
  rows: TaxCategoryRow[];
  mileageMiles: number;
  mileageEstimateCents: number;
  receiptsEligibleCents: number;
  receiptsAllocatedTaxCents: number;
  propertyTaxCents: number;
  lodgingTaxCents: number;
  deductibleIshTotalCents: number;
  receiptCount: number;
  tripCount: number;
  paymentCount: number;
};

export function filterPayments(payments: PropertyTaxPayment[], period: string, today: string): PropertyTaxPayment[] {
  return payments.filter(p => period === 'All time' || (p.date <= today && p.date.startsWith(today.slice(0, period === 'This month' ? 7 : 4))));
}

export function buildTaxSummary(input: {
  period: string;
  today: string;
  receipts: Receipt[];
  trips: Trip[];
  payments: PropertyTaxPayment[];
}): TaxSummary {
  const { period, today } = input;
  const receipts = input.receipts.filter(r => period === 'All time' || (r.reviewed.date && r.reviewed.date <= today && r.reviewed.date.startsWith(today.slice(0, period === 'This month' ? 7 : 4))));
  const trips = inPeriod(input.trips, period, today);
  const payments = filterPayments(input.payments, period, today);

  const receiptsEligibleCents = approvedTotal(receipts);
  const receiptsAllocatedTaxCents = receipts
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + allocateReceipt(r.reviewed).allocatedTax, 0);

  const mileageMiles = totalMiles(trips);
  const mileageEstimateCents = Math.round(mileageMiles * IRS_STANDARD_MILEAGE_CENTS_PER_MILE);

  const propertyTaxCents = payments.filter(p => p.kind === 'property').reduce((s, p) => s + p.amountCents, 0);
  const lodgingTaxCents = payments.filter(p => p.kind === 'lodging').reduce((s, p) => s + p.amountCents, 0);

  const rows: TaxCategoryRow[] = [
    ...EXPENSE_TYPES.map(type => ({
      id: `expense-${type.id}`,
      label: type.label,
      amountCents: approvedTotal(receipts.filter(r => r.reviewed.expenseType === type.id)),
      subtitle: 'Approved receipt expenses · on this device',
    })),
    {
      id: 'receipt-tax',
      label: 'Sales tax on receipts (allocated)',
      amountCents: receiptsAllocatedTaxCents,
      subtitle: 'Portion of receipt tax allocated to included STR items',
    },
    {
      id: 'mileage',
      label: `Mileage estimate (${IRS_STANDARD_MILEAGE_CENTS_PER_MILE}¢/mi)`,
      amountCents: mileageEstimateCents,
      subtitle: `${mileageMiles.toLocaleString('en-US', { maximumFractionDigits: 2 })} mi · ${trips.length} trip(s) · estimate only`,
    },
    {
      id: 'property-tax',
      label: 'Property tax payments',
      amountCents: propertyTaxCents,
      subtitle: 'Recorded locally · not filed with any agency',
    },
    {
      id: 'lodging-tax',
      label: 'Lodging / occupancy tax (recorded)',
      amountCents: lodgingTaxCents,
      subtitle: 'Sample or manual lodging-tax payments on this device',
    },
  ];

  const deductibleIshTotalCents = receiptsEligibleCents + mileageEstimateCents + propertyTaxCents;

  return {
    period,
    rows,
    mileageMiles,
    mileageEstimateCents,
    receiptsEligibleCents,
    receiptsAllocatedTaxCents,
    propertyTaxCents,
    lodgingTaxCents,
    deductibleIshTotalCents,
    receiptCount: receipts.filter(r => r.status === 'approved').length,
    tripCount: trips.length,
    paymentCount: payments.length,
  };
}

export function formatTaxDollars(cents: number) {
  return dollars(cents);
}
