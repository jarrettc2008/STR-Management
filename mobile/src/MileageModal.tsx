import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { inPeriod, newDraft, totalMiles, validateTrip, type Trip, type TripDraft } from './mileage';
import type { useMileage } from './useMileage';
import TripDateField from './TripDateField';
import TripRecorder from './TripRecorder';
import RouteMap from './RouteMap';
import { addressFor, currentPoint } from './tripTracking';

type Props = { visible: boolean; onClose: () => void; mileage: ReturnType<typeof useMileage>; period: string };
export default function MileageModal({ visible, onClose, mileage, period }: Props) {
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const [validation, setValidation] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');
  const requestId = useRef(0);
  const [filter, setFilter] = useState(period);
  const selected = inPeriod(mileage.trips, filter);
  const close = () => { if (mileage.saving) return; if (draft) setDiscard(true); else onClose(); };
  const cancelDraft = () => { requestId.current++; setDraft(null); setEditing(null); setValidation(''); setDiscard(false); setGpsStatus(''); };
  async function locate() {
    const request = ++requestId.current;
    setGpsStatus('Finding your current GPS location…');
    try {
      const origin = await addressFor(await currentPoint());
      if (request !== requestId.current) return;
      setDraft(current => current && !current.origin.trim() ? { ...current, origin } : current);
      setGpsStatus('GPS location found. You can edit the starting location.');
    } catch (e) { if (request === requestId.current) setGpsStatus(e instanceof Error ? e.message : 'GPS unavailable. Enter your starting location manually.'); }
  }
  function beginDraft() { setDraft(newDraft()); setEditing(null); setDeleteId(null); setValidation(''); void locate(); }
  async function submit() {
    if (!draft) return;
    const error = validateTrip(draft);
    if (error) { setValidation(error); return; }
    const odometerStart = draft.odometerStart?.trim() ? Number(draft.odometerStart) : undefined;
    const odometerEnd = draft.odometerEnd?.trim() ? Number(draft.odometerEnd) : undefined;
    const trip: Trip = { ...editing, ...draft, id: editing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`, origin: draft.origin.trim(), destination: draft.destination.trim(), purpose: draft.purpose.trim(), notes: draft.notes.trim(), miles: Number(draft.miles), odometerStart, odometerEnd, odometerEndEstimated: !!editing?.odometerEndEstimated && odometerStart === editing.odometerStart && odometerEnd === editing.odometerEnd, source: editing?.source ?? 'manual' };
    if (await mileage.saveTrip(trip)) cancelDraft();
  }
  const field = (key: keyof TripDraft, label: string, placeholder: string, numeric = false) => <View key={key} style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={draft?.[key] ?? ''} onChangeText={value => { if (key === 'origin') requestId.current++; setDraft(current => current ? { ...current, [key]: value } : current); setValidation(''); }} placeholder={placeholder} placeholderTextColor="#82907d" keyboardType={numeric ? 'decimal-pad' : 'default'} editable={!mileage.saving} maxLength={key === 'notes' ? 1000 : 200} style={s.input} /></View>;
  return <Modal visible={visible} animationType="slide" onRequestClose={close}>
    <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
        <View style={s.header}><View style={s.icon}><Feather name="navigation" size={24} color="#294e3b" /></View><Text style={s.label}>MILEAGE</Text><Pressable accessibilityRole="button" accessibilityLabel="Close mileage" disabled={mileage.saving} onPress={close} style={s.close}><Feather name="x" size={24} color="#294e3b" /></Pressable></View>
        <TripRecorder mileage={mileage} disabled={!!draft} onSaved={() => { setFilter('All time'); }} />
        {!!draft && <Text style={s.small}>Finish or cancel your manual entry to start a GPS trip.</Text>}
        <Text style={s.kicker}>516 TIGER BLVD · BENTONVILLE</Text><Text accessibilityRole="header" style={s.title}>{draft ? editing ? 'Edit your trip' : 'Log a property trip' : 'Every mile, accounted for.'}</Text><Text style={s.body}>{draft ? 'Choose the date, confirm the route, and add your readings.' : 'Start a GPS trip above or add a trip manually below.'}</Text>
        {!!mileage.error && <View style={s.notice}><Text accessibilityRole="alert" style={s.error}>{mileage.error}</Text>{!mileage.ready && <Pressable accessibilityRole="button" onPress={() => void mileage.load()} style={s.secondary}><Text>Retry loading</Text></Pressable>}</View>}
        {discard && <View style={s.notice}><Text style={s.label}>Discard your unsaved trip changes?</Text><View style={s.actions}><Pressable accessibilityRole="button" onPress={() => setDiscard(false)} style={s.secondary}><Text>Keep editing</Text></Pressable><Pressable accessibilityRole="button" onPress={cancelDraft} style={s.secondary}><Text style={s.error}>Discard changes</Text></Pressable></View></View>}
        {draft ? <View style={s.card}>
          <TripDateField value={draft.date} disabled={mileage.saving} onChange={date => { setDraft(current => current ? { ...current, date } : current); setValidation(''); }} />
          {field('origin', 'Starting location', 'Current GPS location or address')}
          {!!gpsStatus && <Text accessibilityLiveRegion="polite" style={s.small}>{gpsStatus}</Text>}
          {!draft.origin.trim() && <Pressable accessibilityRole="button" disabled={mileage.saving} onPress={() => void locate()} style={s.secondary}><Text style={s.link}>Use current GPS location</Text></Pressable>}
          {field('destination', 'Destination', 'Where did you go?')}
          {field('odometerStart', 'OD reading start', 'Actual vehicle reading (optional)', true)}
          {field('odometerEnd', 'OD reading end', 'Actual vehicle reading (optional)', true)}
          {editing?.odometerEndEstimated && <Text style={s.small}>The saved ending OD is a GPS estimate. Enter the actual reading to replace it.</Text>}
          {!!draft.odometerStart?.trim() && !!draft.odometerEnd?.trim() && Number(draft.odometerEnd) >= Number(draft.odometerStart) && <Pressable accessibilityRole="button" onPress={() => setDraft(current => current ? { ...current, miles: (Number(current.odometerEnd) - Number(current.odometerStart)).toFixed(2) } : current)} style={s.secondary}><Text style={s.link}>Calculate miles from OD readings</Text></Pressable>}
          {field('miles', 'Total miles driven', '0.00', true)}
          <Text style={s.small}>Include the return leg if this entry covers a round trip.</Text>
          {field('purpose', 'Business purpose', 'e.g. Restock supplies')}
          {field('notes', 'Notes (optional)', 'Additional trip details')}
          {!!validation && <Text accessibilityRole="alert" style={s.error}>{validation}</Text>}
          <Pressable accessibilityRole="button" disabled={mileage.saving || !mileage.ready} onPress={() => void submit()} style={[s.primary, (!mileage.ready || mileage.saving) && s.disabled]}><Text style={s.primaryText}>{mileage.saving ? 'Saving…' : editing ? 'Save changes' : 'Save trip'}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={mileage.saving} onPress={() => setDiscard(true)} style={s.secondary}><Text style={s.link}>Cancel</Text></Pressable>
        </View> : <>
          <View style={s.filters}>{['This month', 'This year', 'All time'].map(value => <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === value }} key={value} onPress={() => { setFilter(value); setDeleteId(null); }} style={[s.filter, filter === value && { backgroundColor: '#fff' }]}><Text style={s.small}>{value}</Text></Pressable>)}</View>
          <View style={s.summary}><View><Text style={s.summaryLabel}>TOTAL MILES</Text><Text style={s.total}>{mileage.ready ? totalMiles(selected).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} <Text style={{ fontSize: 16 }}>mi</Text></Text></View><Text style={s.summaryLabel}>{mileage.ready ? `${selected.length} ${selected.length === 1 ? 'trip' : 'trips'}` : 'Loading records'}</Text></View>
          <Pressable accessibilityRole="button" disabled={!mileage.ready || !!mileage.active} onPress={beginDraft} style={[s.primary, (!mileage.ready || !!mileage.active) && s.disabled]}><Text style={s.primaryText}>+  Log a property trip manually</Text></Pressable>
          <Text accessibilityRole="header" style={s.heading}>History</Text>
          {mileage.ready && selected.length === 0 && <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}><Feather name="map" size={32} color="#788c6a" /><Text style={s.heading}>A fresh start</Text><Text style={[s.body, { textAlign: 'center' }]}>No trips for this period. Start recording or log a property trip.</Text></View>}
          {selected.length > 0 && <ScrollView horizontal><View style={{ minWidth: 680 }}>
            <View style={[s.historyRow, { backgroundColor: '#e8eedf' }]}>{['Date', 'Mileage', 'OD start', 'OD end', 'Business purpose'].map((title, i) => <Text key={title} style={[s.historyCell, i === 4 && { width: 220 }, { fontWeight: '700' }]}>{title}</Text>)}</View>
            {[...selected].sort((a, b) => b.date.localeCompare(a.date)).map(trip => <View key={trip.id} style={s.historyEntry}>
              <View style={s.historyRow}><Text style={s.historyCell}>{trip.date}</Text><Text style={s.historyCell}>{trip.miles.toLocaleString()} mi</Text><Text style={s.historyCell}>{trip.odometerStart?.toLocaleString() ?? '—'}</Text><Text style={s.historyCell}>{trip.odometerEnd?.toLocaleString() ?? '—'}{trip.odometerEndEstimated ? ' (est.)' : ''}</Text><Text style={[s.historyCell, { width: 220 }]}>{trip.purpose}</Text></View>
              <Text style={s.small}>{trip.origin} → {trip.destination}</Text>
              {trip.reviewNeeded && <Text style={s.error}>Review mileage: GPS gaps, an interrupted recording, or no measurable distance.</Text>}
              {!!trip.notes && <Text style={s.small}>{trip.notes}</Text>}
              {deleteId === trip.id ? <><Text style={s.error}>Delete this trip? This cannot be undone.</Text><View style={s.actions}><Pressable accessibilityRole="button" disabled={mileage.saving} onPress={() => setDeleteId(null)} style={s.secondary}><Text>Keep trip</Text></Pressable><Pressable accessibilityRole="button" disabled={mileage.saving} onPress={async () => { if (await mileage.deleteTrip(trip.id)) setDeleteId(null); }} style={s.secondary}><Text style={s.error}>{mileage.saving ? 'Deleting…' : 'Delete trip'}</Text></Pressable></View></> : <View style={s.actions}><Pressable accessibilityRole="button" accessibilityLabel={`Edit trip from ${trip.date}`} onPress={() => { requestId.current++; setEditing(trip); setDraft({ date: trip.date, origin: trip.origin, destination: trip.destination, purpose: trip.purpose, notes: trip.notes, miles: String(trip.miles), odometerStart: trip.odometerStart === undefined ? '' : String(trip.odometerStart), odometerEnd: trip.odometerEnd === undefined ? '' : String(trip.odometerEnd) }); setGpsStatus(''); setValidation(''); }} style={s.secondary}><Text style={s.link}>Edit</Text></Pressable>{!!trip.route?.length && <Pressable accessibilityRole="button" onPress={() => setRouteId(routeId === trip.id ? null : trip.id)} style={s.secondary}><Text style={s.link}>{routeId === trip.id ? 'Hide route' : 'View route'}</Text></Pressable>}<Pressable accessibilityRole="button" accessibilityLabel={`Delete trip from ${trip.date}`} onPress={() => setDeleteId(trip.id)} style={s.secondary}><Text style={s.error}>Delete</Text></Pressable></View>}
              {routeId === trip.id && <RouteMap points={trip.route ?? []} />}
            </View>)}
          </View></ScrollView>}
          <Text style={[s.small, { marginTop: 20 }]}>Swipe history sideways to see every column. Saved on this device; no cloud backup. OD readings are entered manually for each trip. GPS route distance is not a tax deduction calculation.</Text>
        </>}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  historyRow: { flexDirection: 'row', paddingVertical: 14, borderRadius: 8 }, historyCell: { width: 115, paddingHorizontal: 8, fontSize: 12, color: '#294e3b' }, historyEntry: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#dfe6d4', paddingBottom: 10 },

  safe: { flex: 1, backgroundColor: '#f7f8f2' }, page: { padding: 24, paddingBottom: 44, width: '100%', maxWidth: 680, alignSelf: 'center' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, icon: { backgroundColor: '#e8eedf', padding: 14, borderRadius: 17 }, close: { padding: 12 }, kicker: { fontSize: 10, letterSpacing: 1.3, color: '#66795e', marginTop: 24 }, title: { color: '#294e3b', fontSize: 31, fontWeight: '600', letterSpacing: -1, marginTop: 10 }, body: { color: '#657358', fontSize: 14, lineHeight: 22, marginTop: 10, marginBottom: 10 }, small: { fontSize: 12, color: '#66735e', lineHeight: 19 }, heading: { fontSize: 18, color: '#294e3b', fontWeight: '600', marginTop: 22, marginBottom: 8 }, filters: { flexDirection: 'row', backgroundColor: '#e9eedf', padding: 4, borderRadius: 13, marginTop: 22 }, filter: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, summary: { backgroundColor: '#294e3b', borderRadius: 20, padding: 24, marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, summaryLabel: { color: '#d3e3c6', fontSize: 12 }, total: { color: '#fff', fontSize: 38, marginTop: 8, fontWeight: '600' }, primary: { backgroundColor: '#294e3b', borderRadius: 13, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 }, disabled: { opacity: 0.5 }, card: { borderWidth: 1, borderColor: '#dfe6d4', backgroundColor: '#fff', borderRadius: 20, padding: 20, marginTop: 14 }, field: { marginTop: 14 }, label: { color: '#3d543b', fontWeight: '600', fontSize: 13, marginBottom: 8 }, input: { borderWidth: 1, borderColor: '#cbd6c3', borderRadius: 10, padding: 13, minHeight: 48, color: '#294e3b', backgroundColor: '#fafbf7', fontSize: 15, marginBottom: 8 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }, secondary: { padding: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, link: { color: '#294e3b', fontWeight: '600' }, miles: { color: '#294e3b', fontSize: 19, fontWeight: '700' }, notice: { backgroundColor: '#fff3e5', borderRadius: 14, padding: 16, marginTop: 16 }, error: { color: '#9c382b', fontSize: 13, lineHeight: 20 },
});


