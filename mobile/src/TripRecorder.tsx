import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { useMileage } from './useMileage';
import { routeMiles } from './mileage';
import { getTrackerError, startTracking, stopTracking, trackingRunning } from './tripTracking';
import RouteMap from './RouteMap';

export default function TripRecorder({ mileage, onSaved, disabled = false }: { mileage: ReturnType<typeof useMileage>; onSaved: () => void; disabled?: boolean }) {
  const [purpose, setPurpose] = useState('Property visit');
  const [odometerStart, setOdometerStart] = useState('');
  const [activeStart, setActiveStart] = useState<string | null>(null);
  const [odometerEnd, setOdometerEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [health, setHealth] = useState(() => ({ running: true, now: Date.now(), error: '' }));
  const active = mileage.active;
  useEffect(() => {
    if (!active) return;
    let mounted = true;
    const check = () => { void trackingRunning().then(running => { if (mounted) setHealth({ running, now: Date.now(), error: getTrackerError() }); }).catch(() => { if (mounted) setHealth({ running: false, now: Date.now(), error: 'Unable to confirm GPS recording. Stop to save the captured route.' }); }); };
    check();
    const interval = setInterval(check, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, [active?.id, active?.stoppedAt, active]);
  const last = active?.points[active.points.length - 1];
  const stale = last && health.now - last.timestamp > 120000;
  async function run(action: 'start' | 'stop') {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      if (action === 'start') { await startTracking({ purpose, odometerStart }); setActiveStart(null); setOdometerEnd(''); }
      else { const saved = await stopTracking({ start: activeStart ?? String(active?.odometerStart ?? ''), end: odometerEnd }); if (saved) { setSuccess(`Trip saved automatically · ${saved.miles.toFixed(2)} mi${saved.reviewNeeded ? ' · Review GPS coverage' : ''}`); setOdometerStart(''); setActiveStart(null); setOdometerEnd(''); onSaved(); } }
      await mileage.load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Recording failed. Your saved route is preserved; please retry.'); await mileage.load(); }
    finally { setBusy(false); }
  }
  return <View style={s.card}>
    <View style={s.row}><Feather name="radio" size={21} color="#294e3b" /><Text style={s.title}>{active ? active.stoppedAt ? 'Stopped · waiting to save' : 'Trip recording' : 'Ready when you are'}</Text></View>
    <View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel="Start GPS trip" disabled={busy || !!active || !mileage.ready || disabled} onPress={() => void run('start')} style={[s.start, (busy || !!active || !mileage.ready || disabled) && s.disabled]}><Feather name="play" size={18} color="white" /><Text style={s.buttonText}>Start</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Stop and save GPS trip" disabled={busy || !active} onPress={() => void run('stop')} style={[s.stop, (busy || !active) && s.disabled]}><Feather name="square" size={17} color="white" /><Text style={s.buttonText}>{active?.stoppedAt ? 'Retry save' : 'Stop & save'}</Text></Pressable></View>
    {busy && <Text accessibilityLiveRegion="polite" style={s.body}>Getting GPS / saving your trip…</Text>}
    {!active ? <>
      <Text style={s.label}>OD start (optional, actual vehicle reading)</Text><TextInput accessibilityLabel="Recording odometer start" value={odometerStart} onChangeText={setOdometerStart} placeholder="e.g. 42500" keyboardType="decimal-pad" editable={!busy} style={s.input} />
      <Text style={s.label}>Business purpose</Text><TextInput accessibilityLabel="Recording business purpose" value={purpose} onChangeText={setPurpose} placeholder="Property visit" editable={!busy} style={s.input} />
      <Text style={s.body}>Start records your current GPS location. Stop calculates miles and saves automatically. You can correct the purpose and odometer later.</Text>
      <Text style={s.small}>{Platform.OS === 'web' ? 'Browser preview: keep this tab open and visible. Locked-screen recording requires the native app.' : 'Allow precise and background location to record with the screen locked. Recording ends when you tap Stop; force-closing the app can interrupt it.'}</Text>
    </> : <>
      <Text style={s.miles}>{routeMiles(active.points).toFixed(2)} <Text style={{ fontSize: 16 }}>GPS mi</Text></Text><Text style={s.body}>{active.origin} · {active.purpose}</Text><Text style={s.small}>Started {new Date(active.startedAt).toLocaleTimeString()} · {active.points.filter(p => p.checkpoint).length} checkpoints</Text>
      <Text style={s.small}>Last GPS point: {last ? new Date(last.timestamp).toLocaleTimeString() : 'Waiting'}</Text>
      <Text style={s.label}>OD start (manual)</Text><TextInput accessibilityLabel="Active trip odometer start" value={activeStart ?? String(active.odometerStart ?? '')} onChangeText={setActiveStart} keyboardType="decimal-pad" placeholder="Actual starting reading" editable={!busy} style={s.input} />
      <Text style={s.label}>OD end (manual)</Text><TextInput accessibilityLabel="Active trip odometer end" value={odometerEnd} onChangeText={setOdometerEnd} keyboardType="decimal-pad" placeholder="Enter the reading when you arrive" editable={!busy} style={s.input} />
      <Text style={s.small}>Odometer readings are never estimated. Leave blank to add them later from History → Edit.</Text>
      {(!health.running || stale || active.warning) && <Text style={s.warning}>{active.warning || 'GPS updates may be interrupted or delayed. Stop to save the captured route, then review mileage.'}</Text>}
      {!!health.error && <Text style={s.warning}>{health.error}</Text>}
    </>}
    {!!error && <Text accessibilityRole="alert" style={s.warning}>{error}</Text>}
    {!!success && <Text accessibilityLiveRegion="polite" style={s.success}>{success}</Text>}
    <View style={{ marginTop: 16 }}><RouteMap points={active?.points ?? []} /></View>
    <Text style={s.small}>GPS distance is an estimate. Five-minute checkpoints depend on GPS availability; gaps are flagged for review.</Text>
  </View>;
}
const s = StyleSheet.create({ card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe6d4', borderRadius: 20, padding: 18, marginTop: 18 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }, title: { color: '#294e3b', fontSize: 17, fontWeight: '600' }, start: { flex: 1, flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center', backgroundColor: '#294e3b', minHeight: 54, borderRadius: 13 }, stop: { flex: 1, flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center', backgroundColor: '#9c4a35', minHeight: 54, borderRadius: 13 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 }, disabled: { opacity: 0.4 }, label: { fontSize: 12, fontWeight: '600', color: '#3d543b', marginTop: 8, marginBottom: 8 }, input: { borderWidth: 1, borderColor: '#cbd6c3', borderRadius: 10, padding: 12, minHeight: 46, color: '#294e3b' }, body: { color: '#657358', fontSize: 13, lineHeight: 21, marginTop: 10 }, small: { color: '#66735e', fontSize: 11, lineHeight: 18, marginTop: 8 }, miles: { color: '#294e3b', fontWeight: '600', fontSize: 34 }, warning: { color: '#9c382b', fontSize: 13, lineHeight: 20, marginTop: 10 }, success: { color: '#294e3b', backgroundColor: '#e8eedf', padding: 12, borderRadius: 10, marginTop: 10 } });
