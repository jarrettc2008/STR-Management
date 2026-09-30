import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CURRENT_PROPERTY } from '../property';
import { today } from '../mileage';
import type { useMileage } from '../useMileage';
import type { useReceipts } from '../receipts/useReceipts';
import { seedOnDeviceDemoData } from '../demo/seedLocalDemo';
import { buildTaxSummary, formatTaxDollars, type PropertyTaxPayment } from './taxSummary';
import { readTaxPayments } from './taxStore';

type Props = {
  onClose: () => void;
  period: string;
  mileage: ReturnType<typeof useMileage>;
  receipts: ReturnType<typeof useReceipts>;
};

export default function TaxModal({ onClose, period, mileage, receipts }: Props) {
  const [filter, setFilter] = useState(period);
  const [payments, setPayments] = useState<PropertyTaxPayment[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [seeding, setSeeding] = useState(false);

  const loadPayments = useCallback(() => readTaxPayments()
    .then(rows => { setPayments(rows); setReady(true); setError(''); })
    .catch(() => { setReady(false); setError('Could not load tax payment records on this device.'); }), []);

  useEffect(() => {
    let active = true;
    readTaxPayments()
      .then(rows => { if (active) { setPayments(rows); setReady(true); setError(''); } })
      .catch(() => { if (active) { setReady(false); setError('Could not load tax payment records on this device.'); } });
    return () => { active = false; };
  }, []);

  const summary = buildTaxSummary({
    period: filter,
    today: today(),
    receipts: receipts.receipts.filter(r => r.ownerId === CURRENT_PROPERTY.ownerId && r.reviewed.propertyId === CURRENT_PROPERTY.id),
    trips: mileage.trips,
    payments,
  });

  async function seed() {
    if (seeding) return;
    setSeeding(true); setError(''); setNotice('');
    try {
      const result = await seedOnDeviceDemoData({ replace: true });
      await receipts.load();
      await mileage.load();
      await loadPayments();
      setNotice(`Loaded ${result.receipts} receipt(s), ${result.trips} trip(s), and ${result.taxPayments} tax payment(s) on this device.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load on-device sample tax data.');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          <View style={s.row}>
            <View style={s.icon}><Feather name="file-text" size={24} color="#294e3b" /></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close tax records" onPress={onClose} style={s.secondary}>
              <Feather name="x" size={24} color="#294e3b" />
            </Pressable>
          </View>
          <Text style={s.kicker}>{CURRENT_PROPERTY.name.toUpperCase()} · TAX RECORDS</Text>
          <Text accessibilityRole="header" style={s.title}>On-device tax snapshot</Text>
          <Text style={s.body}>
            Totals derived from mileage, approved receipts, and local tax payments saved on this phone. This is a record-keeping aid — not tax advice or a filing.
          </Text>
          {(error || mileage.error || receipts.error) ? (
            <Text accessibilityRole="alert" style={s.error}>{error || mileage.error || receipts.error}</Text>
          ) : null}
          {notice ? (
            <View style={s.notice}><Text style={s.body}>{notice}</Text></View>
          ) : null}
          {!ready || !mileage.ready || !receipts.ready ? (
            <View style={s.notice}><ActivityIndicator color="#294e3b" /><Text style={s.body}>Loading local tax-related records…</Text></View>
          ) : null}

          <View style={s.filters}>
            {(['This month', 'This year', 'All time'] as const).map(value => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: filter === value }}
                key={value}
                onPress={() => setFilter(value)}
                style={[s.filter, filter === value && s.selected]}
              >
                <Text style={s.small}>{value}</Text>
              </Pressable>
            ))}
          </View>

          <View style={s.summary}>
            <Text style={s.summaryTitle}>Deductible-ish total · {filter.toLowerCase()}</Text>
            <Text style={s.reportTotal}>{formatTaxDollars(summary.deductibleIshTotalCents)}</Text>
            <Text style={s.summaryText}>
              Approved expenses + mileage estimate + property tax payments. Lodging tax is listed separately below.
            </Text>
          </View>

          <View style={s.metaRow}>
            <Text style={s.small}>{summary.receiptCount} approved receipt(s)</Text>
            <Text style={s.small}>{summary.tripCount} trip(s)</Text>
            <Text style={s.small}>{summary.paymentCount} tax payment(s)</Text>
          </View>

          {summary.rows.map(row => (
            <View key={row.id} style={s.card}>
              <Text style={s.label}>{row.label}</Text>
              <Text style={s.heading}>{formatTaxDollars(row.amountCents)}</Text>
              <Text style={s.small}>{row.subtitle}</Text>
            </View>
          ))}

          <Text accessibilityRole="header" style={s.heading}>Tax payments on this device</Text>
          {!payments.length ? (
            <View style={s.card}>
              <Text style={s.body}>No property or lodging tax payments saved yet. Load samples to preview categories and totals.</Text>
            </View>
          ) : (
            payments
              .filter(p => filter === 'All time' || p.date.startsWith(today().slice(0, filter === 'This month' ? 7 : 4)))
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(p => (
                <View key={p.id} style={s.card}>
                  <Text style={s.label}>{p.date} · {p.kind}</Text>
                  <Text style={s.heading}>{p.label}</Text>
                  <Text style={s.body}>{formatTaxDollars(p.amountCents)}</Text>
                  {p.notes ? <Text style={s.small}>{p.notes}</Text> : null}
                </View>
              ))
          )}

          <Pressable
            accessibilityRole="button"
            disabled={seeding || !mileage.ready || !receipts.ready}
            onPress={() => { void seed(); }}
            style={[s.primary, (seeding || !mileage.ready || !receipts.ready) && s.disabled]}
          >
            <Text style={s.primaryText}>{seeding ? 'Loading samples…' : 'Load sample tax + mileage + receipts'}</Text>
          </Pressable>
          <Text style={[s.small, { marginTop: 16 }]}>
            {`USD · ${CURRENT_PROPERTY.address}. Records stay on this device. No cloud sync or e-file.`}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f8f2' },
  page: { padding: 24, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  icon: { backgroundColor: '#e8eedf', padding: 14, borderRadius: 16 },
  kicker: { color: '#66795e', fontSize: 10, letterSpacing: 1, marginTop: 22 },
  title: { fontSize: 30, color: '#294e3b', fontWeight: '600', marginTop: 12 },
  body: { color: '#657358', fontSize: 14, lineHeight: 22, marginVertical: 10 },
  small: { color: '#66735e', fontSize: 11, lineHeight: 18 },
  label: { color: '#3d543b', fontWeight: '600', fontSize: 13, marginBottom: 8 },
  heading: { fontSize: 19, fontWeight: '600', color: '#294e3b', marginTop: 16, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe6d4', borderRadius: 18, padding: 18, marginTop: 14 },
  primary: { backgroundColor: '#294e3b', padding: 14, minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginTop: 16 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  secondary: { minHeight: 44, padding: 12, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.5 },
  error: { color: '#9c382b', fontSize: 13, lineHeight: 21, marginTop: 10 },
  notice: { backgroundColor: '#fff3e5', borderRadius: 14, padding: 16, marginTop: 16, gap: 8 },
  summary: { backgroundColor: '#294e3b', padding: 22, borderRadius: 18, marginTop: 22 },
  summaryTitle: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 14 },
  summaryText: { color: '#e3eddd', fontSize: 13, flexShrink: 1 },
  reportTotal: { color: '#fff', fontSize: 36, fontWeight: '600', marginBottom: 10 },
  filters: { flexDirection: 'row', padding: 4, backgroundColor: '#e8eedf', borderRadius: 12, marginTop: 18 },
  filter: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  selected: { backgroundColor: '#fff' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
});
