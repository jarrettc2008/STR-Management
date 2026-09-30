import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { type Trip } from './mileage';
import { readMileage, subscribeMileage, updateMileage, type ActiveTrip } from './mileageStore';
export function useMileage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [active, setActive] = useState<ActiveTrip | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const load = useCallback(() => readMileage()
    .then(state => { setTrips(state.trips); setActive(state.active); setError(''); setReady(true); })
    .catch(() => { setReady(false); setError('Could not load your mileage records. Retry to safely access them.'); }), []);
  useEffect(() => { void load(); const unsubscribe = subscribeMileage(() => void load()); const subscription = AppState.addEventListener('change', status => { if (status === 'active') void load(); }); return () => { unsubscribe(); subscription.remove(); }; }, [load]);
  async function mutate(update: (trips: Trip[]) => Trip[]) {
    if (!ready || locked.current) return false;
    locked.current = true;
    setSaving(true);
    setError('');
    try { await updateMileage(state => ({ ...state, trips: update(state.trips) })); await load(); return true; }
    catch { setError('Could not save changes. Your previous records are unchanged. Please try again.'); return false; }
    finally { locked.current = false; setSaving(false); }
  }
  const saveTrip = (trip: Trip) => mutate(trips => [...trips.filter(t => t.id !== trip.id), trip]);
  const deleteTrip = (id: string) => mutate(trips => trips.filter(t => t.id !== id));
  return { trips, active, ready, error, saving, saveTrip, deleteTrip, load };
}
