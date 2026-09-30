import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { approvalIssues, type Receipt } from './domain';
const PREFIX = 'staywell.receipt.v1:';
export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const load = useCallback(() => AsyncStorage.getAllKeys().then(keys => AsyncStorage.multiGet(keys.filter(k => k.startsWith(PREFIX)))).then(rows => {
    const values = rows.map(([, value]) => { const envelope = JSON.parse(value ?? 'null'); if (envelope?.version !== 1 || !envelope.receipt?.original || !Array.isArray(envelope.receipt.reviewed?.items) || !Array.isArray(envelope.receipt.reviewed?.taxes) || !Array.isArray(envelope.receipt.revisions)) throw new Error('Unreadable receipt'); return envelope.receipt as Receipt; });
    setReceipts(values); setReady(true); setError('');
  }).catch(() => { setReady(false); setError('Could not load your receipts safely. Retry; existing records have not been erased.'); }), []);
  useEffect(() => { void load(); }, [load]);
  async function save(receipt: Receipt) {
    if (!ready || lock.current) return false;
    lock.current = true; setSaving(true); setError('');
    try {
      if (receipt.status === 'approved' && approvalIssues(receipt.reviewed).length) throw new Error('Receipt is not reconciled.');
      await AsyncStorage.setItem(`${PREFIX}${receipt.id}`, JSON.stringify({ version: 1, receipt }));
      setReceipts(current => [...current.filter(r => r.id !== receipt.id), receipt]);
      return true;
    } catch { setError('Could not save this receipt. Keep the review open and try again.'); return false; }
    finally { lock.current = false; setSaving(false); }
  }
  return { receipts, ready, error, saving, save, load };
}
