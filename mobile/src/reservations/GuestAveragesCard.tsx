import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWork } from '../work/WorkProvider';
import {
  formatAverage,
  guestAverages,
  type GuestAnalyticsPeriod,
} from './guestAnalytics';

const PERIODS: { value: GuestAnalyticsPeriod; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: '6month', label: '6 months' },
  { value: 'year', label: 'This year' },
];

const SEX_LABEL: Record<string, string> = {
  female: 'Female',
  male: 'Male',
  nonbinary: 'Nonbinary',
  unspecified: 'Unspecified',
};

export default function GuestAveragesCard() {
  const work = useWork();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<GuestAnalyticsPeriod>('month');
  const summary = useMemo(
    () => guestAverages(work.reservations, 'month', work.currentProperty.id),
    [work.reservations, work.currentProperty.id],
  );
  const detail = useMemo(
    () => guestAverages(work.reservations, period, work.currentProperty.id),
    [work.reservations, work.currentProperty.id, period],
  );

  const emptyHint = work.signedIn
    ? work.demo
      ? 'Demo sample · On-device only'
      : 'From stays saved on this device'
    : 'Show demo data to preview averages';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open guest averages details"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}
      >
        <View style={s.row}>
          <Feather name="users" size={19} color="#527052" />
          <Feather name="arrow-up-right" size={17} color="#7d8b75" />
        </View>
        <Text style={s.value}>{work.signedIn ? formatAverage(summary.averageAge, 0) : '—'}</Text>
        <Text style={s.title}>Guest averages</Text>
        <Text style={s.caption}>
          {work.signedIn
            ? `Avg age, nights, party, and home locations from stays on this device`
            : 'Age, stay length, home location'}
        </Text>
        {work.signedIn && (
          <View style={s.statsRow}>
            <View style={s.statChip}><Text style={s.statChipLabel}>Avg age</Text><Text style={s.statChipValue}>{formatAverage(summary.averageAge, 0)}</Text></View>
            <View style={s.statChip}><Text style={s.statChipLabel}>Avg nights</Text><Text style={s.statChipValue}>{formatAverage(summary.averageNights)}</Text></View>
            <View style={s.statChip}><Text style={s.statChipLabel}>Sex</Text><Text style={s.statChipValue}>{sexShort(summary.sexCounts, summary.sexKnown)}</Text></View>
            <View style={s.statChip}><Text style={s.statChipLabel}>Top home</Text><Text style={s.statChipValue} numberOfLines={1}>{topLocation(summary.topHomeLocations)}</Text></View>
          </View>
        )}
        <Text style={s.hint}>{emptyHint}</Text>
        <Text style={s.link}>View breakdown ↗</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <View accessibilityViewIsModal style={s.dialog}>
            <View style={s.row}>
              <Text accessibilityRole="header" style={s.heading}>Guest averages</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close guest averages" style={s.close} onPress={() => setOpen(false)}>
                <Feather name="x" size={24} color="#294e3b" />
              </Pressable>
            </View>
            <Text style={s.body}>
              On-device stay stats for {work.currentProperty.name}. Demo demographics are fictional samples stored locally — nothing syncs from Airbnb, Vrbo, or the cloud.
            </Text>
            <View style={s.periods}>
              {PERIODS.map((p) => (
                <Pressable
                  key={p.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === p.value }}
                  onPress={() => setPeriod(p.value)}
                  style={[s.period, period === p.value && s.periodOn]}
                >
                  <Text style={[s.periodText, period === p.value && s.periodTextOn]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              <Text style={s.muted}>{detail.periodLabel} · {detail.rangeStart} → {detail.rangeEnd} · {detail.stays} stays</Text>
              {!work.signedIn && (
                <Text style={s.muted}>Sign in or show demo data to load on-device guest averages.</Text>
              )}
              {work.signedIn && detail.stays === 0 && (
                <Text style={s.muted}>No confirmed stays in this period on this device.</Text>
              )}
              {work.signedIn && detail.stays > 0 && (
                <>
                  <Stat label="Average age" value={formatAverage(detail.averageAge, 1)} note={`${detail.guestsWithAge}/${detail.stays} stays with age`} />
                  <Stat label="Average nights stayed" value={formatAverage(detail.averageNights, 1)} note="Per stay · check-in to checkout" />
                  <Stat label="Average party size" value={formatAverage(detail.averagePartySize, 1)} note={`${detail.partyKnown}/${detail.stays} stays with known party`} />
                  <View style={s.block}>
                    <Text style={s.blockTitle}>Sex breakdown</Text>
                    <Text style={s.muted}>{detail.sexKnown}/{detail.stays} stays with a recorded value</Text>
                    {(['female', 'male', 'nonbinary', 'unspecified'] as const).map((key) => (
                      <Text key={key} style={s.statLine}>
                        {SEX_LABEL[key]}: {detail.sexCounts[key]}
                        {detail.sexKnown ? ` (${Math.round((detail.sexCounts[key] / detail.sexKnown) * 100)}%)` : ''}
                      </Text>
                    ))}
                  </View>
                  <View style={s.block}>
                    <Text style={s.blockTitle}>Home locations</Text>
                    <Text style={s.muted}>{detail.locationsKnown}/{detail.stays} stays with a home location</Text>
                    {detail.topHomeLocations.length === 0 ? (
                      <Text style={s.statLine}>No home locations recorded yet.</Text>
                    ) : (
                      detail.topHomeLocations.map((row) => (
                        <Text key={row.location} style={s.statLine}>
                          {row.location}: {row.stays} stay{row.stays === 1 ? '' : 's'}
                        </Text>
                      ))
                    )}
                  </View>
                </>
              )}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={s.button}>
              <Text style={s.buttonText}>Back to overview</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={s.block}>
      <Text style={s.blockTitle}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.muted}>{note}</Text>
    </View>
  );
}

function sexShort(counts: Record<string, number>, known: number): string {
  if (!known) return 'Sex —';
  const female = counts.female ?? 0;
  const male = counts.male ?? 0;
  return `${Math.round((female / known) * 100)}% F · ${Math.round((male / known) * 100)}% M`;
}

function topLocation(rows: { location: string; stays: number }[]): string {
  return rows[0]?.location ?? 'Location —';
}

const s = StyleSheet.create({
  card: { width: '100%', alignSelf: 'stretch', backgroundColor: 'white', padding: 17, borderRadius: 18, borderWidth: 1, borderColor: '#e4e9dc', marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { fontSize: 34, color: '#294e3b', marginTop: 16, marginBottom: 5 },
  title: { fontSize: 13, fontWeight: '600', color: '#3d543b', marginBottom: 6 },
  caption: { fontSize: 11, color: '#66735e', lineHeight: 17 },
  hint: { fontSize: 11, color: '#73816d', marginTop: 6 },
  link: { fontSize: 12, fontWeight: '600', color: '#294e3b', marginTop: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  statChip: { flexGrow: 1, flexBasis: '22%', minWidth: 110, backgroundColor: '#f0f3e8', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  statChipLabel: { fontSize: 10, color: '#66735e', marginBottom: 4 },
  statChipValue: { fontSize: 13, fontWeight: '700', color: '#294e3b' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#152b22aa' },
  dialog: { width: '100%', maxWidth: 480, backgroundColor: 'white', borderRadius: 24, padding: 24, gap: 12 },
  heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.4, color: '#2c4431', flex: 1 },
  close: { padding: 10 },
  body: { fontSize: 13, lineHeight: 22, color: '#657358' },
  periods: { flexDirection: 'row', alignSelf: 'flex-start', padding: 4, borderRadius: 13, backgroundColor: '#edf0e7', flexWrap: 'wrap', gap: 4 },
  period: { paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 10 },
  periodOn: { backgroundColor: 'white' },
  periodText: { fontSize: 11, color: '#66735e' },
  periodTextOn: { color: '#294e3b', fontWeight: '700' },
  muted: { fontSize: 11, color: '#66735e', lineHeight: 17 },
  block: { backgroundColor: '#f7f8f2', borderRadius: 14, padding: 14, gap: 4 },
  blockTitle: { fontSize: 13, fontWeight: '600', color: '#3d543b' },
  statValue: { fontSize: 28, color: '#294e3b', fontWeight: '600' },
  statLine: { fontSize: 13, color: '#3d543b', lineHeight: 20 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#294e3b', borderRadius: 12, marginTop: 8 },
  buttonText: { color: 'white', fontWeight: '600' },
});
