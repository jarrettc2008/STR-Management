import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { CURRENT_PROPERTY } from '../property';
import { allocateReceipt, approvalIssues, approvedTotal, decimal, dollars, emptyFields, EXPENSE_TYPES, quantityTotal, type OriginalFile, type Receipt, type ReceiptFields } from './domain';
import { openOriginal, originalUri, preserveOriginal, releaseOriginalUri, type PickedFile } from './files';
import { recognizeReceipt, OcrUnavailableError } from './ocr';
import { parseReceipt } from './extract';
import { RECEIPT_FIXTURES, matchReceiptFixture, pickedFileFromFixture } from '../demo/receiptFixtures';
import { seedOnDeviceDemoData } from '../demo/seedLocalDemo';
import type { useReceipts } from './useReceipts';

function OriginalPreview({ original }: { original: OriginalFile }) {
  const [uri, setUri] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let disposed = false; let source = ''; originalUri(original).then(value => { source = value; if (disposed) releaseOriginalUri(value); else setUri(value); }).catch(() => setError('Original file cannot be read.')); return () => { disposed = true; if (source) releaseOriginalUri(source); }; }, [original]);
  return <View style={s.original}>{uri && original.mimeType.startsWith('image/') ? <Image accessibilityLabel="Original receipt image" source={{ uri }} resizeMode="contain" style={{ height: 240, width: '100%' }} onError={() => setError('Image preview unavailable. The original can still be opened.')} /> : <Feather name="file-text" size={32} color="#527052" />}<Text style={s.small}>{original.name} · Original retained</Text>{!!error && <Text style={s.error}>{error}</Text>}<Pressable accessibilityRole="button" onPress={() => { void openOriginal(original).catch(e => setError(String(e.message))); }} style={s.secondary}><Text style={s.link}>{Platform.OS === 'web' ? 'Download original' : 'Open / share original'}</Text></Pressable></View>;
}
type Props = { receipts: ReturnType<typeof useReceipts>; onClose: () => void; period: string };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export default function ReceiptModal({ receipts, onClose, period }: Props) {
  const [record, setRecord] = useState<Receipt | null>(null);
  const [fields, setFields] = useState<ReceiptFields | null>(null);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<'list' | 'reports'>('list');
  const [filter, setFilter] = useState(period);
  const [status, setStatus] = useState('all');
  const [confirmed, setConfirmed] = useState(false);
  const [audit, setAudit] = useState(false);
  const [leave, setLeave] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const captureLock = useRef(false);
  const busy = !!phase || receipts.saving;
  const allocation = fields ? allocateReceipt(fields) : null;
  const date = new Date();
  const periodPrefix = `${date.getFullYear()}${filter === 'This month' ? `-${String(date.getMonth() + 1).padStart(2, '0')}` : ''}`;
  const propertyReceipts = receipts.receipts.filter(r => r.ownerId === CURRENT_PROPERTY.ownerId && r.reviewed.propertyId === CURRENT_PROPERTY.id);
  const filtered = propertyReceipts.filter(r => (filter === 'All time' || r.reviewed.date.startsWith(periodPrefix) || (!r.reviewed.date && r.status === 'draft')) && (status === 'all' || r.status === status));
  const reporting = propertyReceipts.filter(r => filter === 'All time' || r.reviewed.date.startsWith(periodPrefix));
  function update(next: ReceiptFields) { setFields(next); setDirty(true); setConfirmed(false); setError(''); }
  function closeReview() { setRecord(null); setFields(null); setDirty(false); setLeave(false); setAudit(false); setError(''); setNotice(''); }
  function close() { if (busy) return; if (record) { if (dirty) setLeave(true); else closeReview(); } else onClose(); }

  async function loadSampleFixture(fixtureId?: string) {
    if (captureLock.current || !receipts.ready) return;
    captureLock.current = true;
    setError(''); setNotice(''); setPhase('Loading on-device sample receipt'); setProgress(0);
    try {
      const fixture = RECEIPT_FIXTURES.find(f => f.id === fixtureId) ?? RECEIPT_FIXTURES[0];
      const picked = await pickedFileFromFixture(fixture);
      const id = `receipt-sample-${fixture.id}-${Date.now()}`;
      const original = await preserveOriginal(id, picked);
      const extracted = parseReceipt(fixture.text, CURRENT_PROPERTY.id);
      extracted.expenseType = fixture.expenseType;
      extracted.notes = 'Loaded from on-device sample image. Verify before approving.';
      const timestamp = new Date().toISOString();
      const next: Receipt = {
        id, ownerId: CURRENT_PROPERTY.ownerId, original,
        extraction: { rawText: fixture.text, fields: copy(extracted), engine: 'Demo fixture text (on-device sample)', capturedAt: timestamp },
        reviewed: extracted, status: 'draft', createdAt: timestamp, updatedAt: timestamp, revisions: [],
      };
      setRecord(next); setFields(copy(extracted)); setConfirmed(false); setDirty(false);
      if (!(await receipts.save(next))) throw new Error('Sample receipt could not be saved locally. Try again.');
      setNotice('Sample autofilled on this device · Verify & edit, then save draft or approve.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Sample receipt could not be loaded.'); }
    finally { setPhase(''); captureLock.current = false; }
  }
  async function seedLocalSamples() {
    if (seeding || !receipts.ready) return;
    setSeeding(true); setError(''); setNotice('');
    try {
      const result = await seedOnDeviceDemoData({ replace: true });
      await receipts.load();
      setNotice(`Loaded ${result.receipts} sample receipt(s), ${result.trips} mileage trip(s), and ${result.taxPayments ?? 0} tax payment(s) on this device. Open a draft to verify & edit.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not seed on-device samples.'); }
    finally { setSeeding(false); }
  }

  async function capture(camera: boolean) {
    if (captureLock.current || !receipts.ready) return;
    captureLock.current = true;
    setError(''); setNotice('');
    let picked: PickedFile | null = null;
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Camera access was declined. You can choose an existing receipt instead.');
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
        if (result.canceled) return;
        const asset = result.assets[0];
        picked = { uri: asset.uri, name: asset.fileName ?? `receipt-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize, file: asset.file };
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
        if (result.canceled) return;
        const asset = result.assets[0];
        picked = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? (/\.pdf$/i.test(asset.name) ? 'application/pdf' : 'image/jpeg'), size: asset.size, file: asset.file };
      }
      if (picked.size && picked.size > 20 * 1024 * 1024) throw new Error('Choose an image or PDF smaller than 20 MB.');
      if (!picked.mimeType.startsWith('image/') && picked.mimeType !== 'application/pdf') throw new Error('Choose an image or a PDF receipt.');
      setPhase('Saving the original receipt'); setProgress(0);
      const id = `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const original = await preserveOriginal(id, picked);
      const timestamp = new Date().toISOString();
      let next: Receipt = { id, ownerId: CURRENT_PROPERTY.ownerId, original, extraction: null, reviewed: emptyFields(CURRENT_PROPERTY.id), status: 'draft', createdAt: timestamp, updatedAt: timestamp, revisions: [] };
      setRecord(next); setFields(copy(next.reviewed)); setConfirmed(false); setDirty(false);
      if (!(await receipts.save(next))) throw new Error('Original file was preserved, but the draft could not be saved. Keep this review open and use Save draft to retry.');
      if (original.mimeType === 'application/pdf') { setNotice('Original PDF saved. Enter its details below; automatic extraction currently supports images.'); return; }
      setPhase('Reading receipt text');
      const uri = await originalUri(original);
      try {
        let result: { text: string; engine: string };
        try {
          result = await recognizeReceipt(uri, setProgress);
        } catch (ocrError) {
          const fixture = matchReceiptFixture(picked.name);
          if (fixture) {
            result = { text: fixture.text, engine: 'Demo fixture text (OCR unavailable · on-device sample)' };
            setProgress(1);
          } else if (ocrError instanceof OcrUnavailableError) {
            setNotice(ocrError.message + ' Tip: use “Load sample receipts” to demo autofill, or fill the form below.');
            return;
          } else {
            throw ocrError;
          }
        }
        const extracted = parseReceipt(result.text, CURRENT_PROPERTY.id);
        const fixture = matchReceiptFixture(picked.name);
        if (fixture) extracted.expenseType = fixture.expenseType;
        next = { ...next, extraction: { rawText: result.text, fields: copy(extracted), engine: result.engine, capturedAt: new Date().toISOString() }, reviewed: extracted, updatedAt: new Date().toISOString() };
        setRecord(next); setFields(copy(extracted));
        if (!(await receipts.save(next))) { setDirty(true); throw new Error('Text was extracted but could not be saved. Use Save draft to retry.'); }
        setNotice('Autofill ready · Verify & edit every field against the original before approving.');
      } finally { releaseOriginalUri(uri); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Receipt could not be processed. Try again or enter its details manually.'); }
    finally { setPhase(''); captureLock.current = false; }
  }
  async function save(approve: boolean) {
    if (!record || !fields) return;
    if (approve) {
      const issues = approvalIssues(fields);
      if (issues.length) { setError(issues.join('\n')); return; }
      if (!confirmed) { setError('Confirm that you reviewed the receipt and allocation.'); return; }
    }
    const at = new Date().toISOString();
    const next: Receipt = { ...record, reviewed: copy(fields), status: approve ? 'approved' : 'draft', updatedAt: at, approvedAt: approve ? at : undefined, calculated: approve ? allocateReceipt(fields) : undefined, revisions: [...record.revisions, { at, fields: copy(record.reviewed), status: record.status }] };
    if (await receipts.save(next)) { setFilter('All time'); closeReview(); }
  }
  function edit(receipt: Receipt) { setRecord(receipt); setFields(copy(receipt.reviewed)); setConfirmed(false); setDirty(false); setAudit(false); setError(''); setNotice(''); }
  const input = (key: keyof Omit<ReceiptFields, 'items' | 'taxes' | 'expenseType' | 'propertyId'>, label: string, numeric = false) => <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={fields?.[key] ?? ''} onChangeText={value => { if (fields) update({ ...fields, [key]: value }); }} editable={!busy} keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={key === 'notes'} maxLength={key === 'notes' ? 2000 : 200} /></View>;
  return <Modal visible animationType="slide" onRequestClose={close}><SafeAreaView style={s.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
    <View style={s.row}><View style={s.icon}><Feather name="file-text" size={24} color="#294e3b" /></View><Pressable accessibilityRole="button" accessibilityLabel={record ? 'Back to receipts' : 'Close receipts'} disabled={busy} onPress={close} style={s.secondary}><Feather name="x" size={24} color="#294e3b" /></Pressable></View>
    <Text style={s.kicker}>{CURRENT_PROPERTY.name.toUpperCase()} · RECEIPTS & EXPENSES</Text><Text accessibilityRole="header" style={s.title}>{record ? 'Verify & edit receipt' : 'Every expense, in its place'}</Text>
    <Text style={s.body}>{record ? 'Step 2 · Check autofilled merchant, date, items, and totals against the original. Correct anything, then save draft or approve. Everything stays on this device.' : 'Capture or upload a receipt. On-device OCR autofills fields when available; samples demo the same verify/edit flow in Expo Go.'}</Text>
    {(error || receipts.error) && <Text accessibilityRole="alert" style={s.error}>{error || receipts.error}</Text>}
    {!receipts.ready && <View style={s.notice}><Text style={s.body}>Loading receipts saved on this device…</Text><Pressable accessibilityRole="button" onPress={() => void receipts.load()} style={[s.secondary, { minHeight: 44 }]}><Text style={s.link}>Retry receipt storage</Text></Pressable></View>}
    {!!notice && <View style={s.notice}><Text style={s.body}>{notice}</Text></View>}
    {!!phase && <View style={s.notice}><ActivityIndicator color="#294e3b" /><Text accessibilityLiveRegion="polite" style={s.body}>{phase}{progress > 0 ? ` · ${Math.round(progress * 100)}%` : '…'}</Text></View>}
    {leave && <View style={s.notice}><Text style={s.body}>Leave this review? Changes since the last save will be lost. Your saved draft and original remain.</Text><View style={s.row}><Pressable accessibilityRole="button" onPress={() => setLeave(false)} style={s.secondary}><Text>Keep reviewing</Text></Pressable><Pressable accessibilityRole="button" onPress={closeReview} style={s.secondary}><Text>Leave review</Text></Pressable></View></View>}
    {record && fields && allocation ? <>
      <View style={s.verifyBanner}><Text style={s.label}>Verify & edit</Text><Text style={s.small}>{record.extraction ? `Autofilled by ${record.extraction.engine}. Confirm each field matches the original.` : 'No autofill yet — enter fields from the original, then save.'}</Text></View>
      <OriginalPreview original={record.original} />
      <View style={s.card}>{input('merchant', 'Merchant / vendor')}{input('date', 'Receipt date (YYYY-MM-DD)')}{input('receiptNumber', 'Receipt number (optional)')}
        <Text style={s.label}>Expense type</Text><View style={s.picker}><Picker style={{ minHeight: 48, color: '#294e3b', backgroundColor: '#fafbf7', fontSize: 15 }} accessibilityLabel="Expense type" selectedValue={fields.expenseType} enabled={!busy} onValueChange={value => update({ ...fields, expenseType: value })}>{EXPENSE_TYPES.map(type => <Picker.Item key={type.id} label={type.label} value={type.id} />)}</Picker></View><Text style={s.label}>Property</Text><Text style={s.body}>{CURRENT_PROPERTY.address}</Text>
      </View>
      <Text accessibilityRole="header" style={s.heading}>Purchased items</Text><Text style={s.small}>Exclude personal purchases without deleting their transcription. Discounts below apply to the whole receipt.</Text>
      {fields.items.map((item, index) => <View key={item.id} style={[s.card, !item.included && s.excluded]}><View style={s.row}><Text style={s.label}>Item {index + 1} · {item.included ? 'Included' : 'Excluded'}</Text><Pressable accessibilityRole="checkbox" accessibilityLabel={`Include item ${index + 1}`} accessibilityState={{ checked: item.included }} disabled={busy} onPress={() => update({ ...fields, items: fields.items.map(i => i.id === item.id ? { ...i, included: !i.included } : i) })} style={s.secondary}><Text style={s.link}>{item.included ? 'Exclude' : 'Include again'}</Text></Pressable></View>
        {(['description', 'quantity', 'unitPrice', 'lineTotal'] as const).map(key => <View key={key} style={s.field}><Text style={s.label}>{({ description: 'Description', quantity: 'Quantity', unitPrice: 'Unit price (optional)', lineTotal: 'Line total' })[key]}</Text><TextInput accessibilityLabel={`Item ${index + 1} ${key}`} value={item[key]} editable={!busy} onChangeText={value => update({ ...fields, items: fields.items.map(i => i.id === item.id ? { ...i, [key]: value } : i) })} style={s.input} keyboardType={key === 'description' ? 'default' : 'decimal-pad'} maxLength={key === 'description' ? 300 : 30} /></View>)}
        <Pressable accessibilityRole="button" disabled={busy || !item.unitPrice} onPress={() => { try { const lineTotal = decimal(quantityTotal(item.quantity, item.unitPrice)); update({ ...fields, items: fields.items.map(i => i.id === item.id ? { ...i, lineTotal } : i) }); } catch (e) { setError(String((e as Error).message)); } }} style={s.secondary}><Text style={s.link}>Calculate quantity × unit price</Text></Pressable>
      </View>)}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => update({ ...fields, items: [...fields.items, { id: `manual-${Date.now()}`, description: '', quantity: '1', unitPrice: '', lineTotal: '', included: true }] })} style={s.secondary}><Text style={s.link}>+ Add line item</Text></Pressable>
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Receipt totals</Text>{input('subtotal', 'Subtotal before receipt-wide discounts', true)}{input('discount', 'Receipt-wide discounts', true)}
        {fields.taxes.map((tax, index) => <View key={tax.id} style={s.field}><Text style={s.label}>Tax {index + 1}</Text><TextInput accessibilityLabel={`Tax ${index + 1} label`} value={tax.label} editable={!busy} onChangeText={label => update({ ...fields, taxes: fields.taxes.map(t => t.id === tax.id ? { ...t, label } : t) })} style={s.input} /><TextInput accessibilityLabel={`Tax ${index + 1} amount`} value={tax.amount} editable={!busy} keyboardType="decimal-pad" onChangeText={amount => update({ ...fields, taxes: fields.taxes.map(t => t.id === tax.id ? { ...t, amount } : t) })} style={s.input} /></View>)}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => update({ ...fields, taxes: [...fields.taxes, { id: `tax-${Date.now()}`, label: 'Additional tax', amount: '0.00' }] })} style={s.secondary}><Text style={s.link}>+ Add tax line</Text></Pressable>
        {input('tip', 'Tips', true)}{input('fees', 'Other fees', true)}{input('total', 'Original receipt total (verify against receipt)', true)}{input('taxOverride', 'Allocated tax override (optional)', true)}<Text style={s.small}>Tax, discounts, fees, and tips are allocated by included item value. If tax rates differ by item, enter the verified eligible tax override. Set an unused tax line to 0.</Text>
      </View>
      <View style={s.summary}><Text style={s.summaryTitle}>Your eligible STR expense</Text>{[
        ['Original receipt total', allocation.originalTotal], ['Excluded amount', allocation.excludedAmount], ['Eligible subtotal (after discounts)', allocation.eligibleSubtotal], ['Allocated discount', allocation.allocatedDiscount], ['Allocated tax', allocation.allocatedTax], ['Allocated tips & fees', allocation.allocatedTip + allocation.allocatedFees], ['Rounding adjustment', allocation.allocatedRounding], ['Eligible expense total', allocation.eligibleTotal],
      ].map(([label, amount]) => <View key={String(label)} style={s.summaryRow}><Text style={s.summaryText}>{label}</Text><Text style={s.summaryText}>{dollars(Number(amount))}</Text></View>)}</View>
      {allocation.issues.length > 0 && <View style={s.notice}><Text style={s.label}>Reconciliation needed</Text>{allocation.issues.map((issue, index) => <Text key={index} style={s.error}>{issue}</Text>)}</View>}
      <View style={s.card}>{input('notes', 'Comments / notes (optional)')}</View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} accessibilityLabel="Confirm receipt review" disabled={busy} onPress={() => setConfirmed(!confirmed)} style={s.confirm}><Feather name={confirmed ? 'check-square' : 'square'} size={23} color="#294e3b" /><Text style={[s.body, { flex: 1 }]}>I checked the original, included items, totals, and allocation.</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save(true)} style={[s.primary, busy && s.disabled]}><Text style={s.primaryText}>Approve expense</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void save(false)} style={s.secondary}><Text style={s.link}>Save draft for later</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setAudit(!audit)} style={s.secondary}><Text style={s.link}>{audit ? 'Hide' : 'View'} original transcription & review history</Text></Pressable>
      {audit && <View style={s.card}><Text style={s.label}>{record.extraction?.engine ?? 'Manual entry / extraction unavailable'}</Text><Text selectable style={s.small}>{record.extraction?.rawText || 'No OCR text. The original receipt file is preserved above.'}</Text>{record.extraction && <Text style={s.body}>Initial extracted subtotal: {record.extraction.fields.subtotal || 'Unknown'} · total: {record.extraction.fields.total || 'Unknown'}</Text>}{record.revisions.map((revision, i) => <View key={i}><Text style={s.label}>{revision.at} · {revision.status}</Text><Text selectable style={s.small}>{revision.fields.merchant} · Total {revision.fields.total} · {revision.fields.items.map(item => `${item.included ? 'Included' : 'Excluded'}: ${item.description} ${item.lineTotal}`).join('; ')}</Text></View>)}</View>}
    </> : <>
      <View style={s.row}><Pressable accessibilityRole="button" disabled={busy || !receipts.ready} onPress={() => void capture(true)} style={[s.primary, { flex: 1 }]}><Text style={s.primaryText}>Take photo</Text></Pressable><Pressable accessibilityRole="button" disabled={busy || !receipts.ready} onPress={() => void capture(false)} style={[s.primary, { flex: 1 }]}><Text style={s.primaryText}>Upload receipt</Text></Pressable></View><Text style={s.small}>Images or PDF · up to 20 MB · PDFs are retained for manual review · OCR runs on-device when available</Text>
      <View style={s.row}><Pressable accessibilityRole="button" disabled={busy || seeding || !receipts.ready} onPress={() => void seedLocalSamples()} style={[s.secondary, s.sampleBtn, { flex: 1 }]}><Text style={s.link}>{seeding ? 'Loading samples…' : 'Load sample receipts + mileage'}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy || !receipts.ready} onPress={() => void loadSampleFixture()} style={[s.secondary, s.sampleBtn, { flex: 1 }]}><Text style={s.link}>Try one sample now</Text></Pressable></View>
      <Text style={s.small}>Samples stay on this phone. In Expo Go, native OCR may be limited — samples still autofill so you can practice verify & edit.</Text>
      <View style={s.filters}>{(['list', 'reports'] as const).map(tab => <Pressable accessibilityRole="button" accessibilityState={{ selected: view === tab }} key={tab} onPress={() => setView(tab)} style={[s.filter, view === tab && s.selected]}><Text style={s.link}>{tab === 'list' ? 'Receipt list' : 'Expense report'}</Text></Pressable>)}</View>
      <View style={s.filters}>{['This month', 'This year', 'All time'].map(value => <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === value }} key={value} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.selected]}><Text style={s.small}>{value}</Text></Pressable>)}</View>
      {view === 'reports' ? <><View style={s.summary}><Text style={s.summaryTitle}>Approved expenses · {filter.toLowerCase()}</Text><Text style={s.reportTotal}>{dollars(approvedTotal(reporting))}</Text><Text style={s.summaryText}>Drafts and excluded items do not count.</Text></View>{EXPENSE_TYPES.map(type => <View key={type.id} style={s.card}><Text style={s.label}>{type.label}</Text><Text style={s.heading}>{dollars(approvedTotal(reporting.filter(r => r.reviewed.expenseType === type.id)))}</Text></View>)}<Text style={s.small}>{`USD · ${CURRENT_PROPERTY.address}. This reports recorded expenses, not profit or tax deductibility.`}</Text></> : <>
        <View style={s.picker}><Picker style={{ minHeight: 48, color: '#294e3b', backgroundColor: '#fafbf7', fontSize: 15 }} accessibilityLabel="Receipt status filter" selectedValue={status} onValueChange={setStatus}><Picker.Item label="All receipts" value="all" /><Picker.Item label="Needs review" value="draft" /><Picker.Item label="Approved" value="approved" /></Picker></View>
        {!filtered.length && <View style={s.original}><Feather name="inbox" size={34} color="#73816d" /><Text style={s.heading}>Your receipts start here</Text><Text style={s.body}>No receipts in this period. Capture or upload your first receipt.</Text></View>}
        {[...filtered].sort((a, b) => b.reviewed.date.localeCompare(a.reviewed.date)).map(receipt => <Pressable accessibilityRole="button" key={receipt.id} onPress={() => edit(receipt)} style={s.card}><Text style={s.label}>{receipt.reviewed.date || 'Date needs review'}  ·  {EXPENSE_TYPES.find(type => type.id === receipt.reviewed.expenseType)?.label}</Text><View style={s.row}><Text style={[s.heading, { flex: 1 }]}>{receipt.reviewed.merchant || 'Merchant needs review'}</Text><Feather name="file-text" size={22} color="#527052" /></View><Text style={s.body}>{receipt.status === 'approved' ? dollars(allocateReceipt(receipt.reviewed).eligibleTotal) : 'Needs review · not in expense totals'}</Text></Pressable>)}
      </>}
      <Text style={[s.small, { marginTop: 22 }]}>Originals and records are saved locally on this device. No cloud backup or account sync is configured.</Text>
    </>}
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f7f8f2' }, page: { padding: 24, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, icon: { backgroundColor: '#e8eedf', padding: 14, borderRadius: 16 }, kicker: { color: '#66795e', fontSize: 10, letterSpacing: 1, marginTop: 22 }, title: { fontSize: 30, color: '#294e3b', fontWeight: '600', marginTop: 12 }, body: { color: '#657358', fontSize: 14, lineHeight: 22, marginVertical: 10 }, small: { color: '#66735e', fontSize: 11, lineHeight: 18 }, label: { color: '#3d543b', fontWeight: '600', fontSize: 13, marginBottom: 8 }, heading: { fontSize: 19, fontWeight: '600', color: '#294e3b', marginTop: 16, marginBottom: 10 }, field: { marginTop: 14 }, input: { borderWidth: 1, borderColor: '#cbd6c3', borderRadius: 10, padding: 12, minHeight: 46, color: '#294e3b', backgroundColor: '#fafbf7', fontSize: 15, marginBottom: 8 }, picker: { borderWidth: 1, borderColor: '#cbd6c3', borderRadius: 10, marginTop: 10, marginBottom: 14, overflow: 'hidden' }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe6d4', borderRadius: 18, padding: 18, marginTop: 14 }, original: { alignItems: 'center', padding: 18, backgroundColor: '#edf1e4', borderRadius: 18, marginTop: 18 }, primary: { backgroundColor: '#294e3b', padding: 14, minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginTop: 16 }, primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 }, secondary: { minHeight: 44, padding: 12, justifyContent: 'center', alignItems: 'center' }, link: { color: '#294e3b', fontWeight: '600' }, disabled: { opacity: 0.5 }, error: { color: '#9c382b', fontSize: 13, lineHeight: 21, marginTop: 10 }, notice: { backgroundColor: '#fff3e5', borderRadius: 14, padding: 16, marginTop: 16 }, excluded: { backgroundColor: '#f0f0eb', borderStyle: 'dashed' }, summary: { backgroundColor: '#294e3b', padding: 22, borderRadius: 18, marginTop: 22 }, summaryTitle: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 14 }, summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, marginVertical: 6 }, summaryText: { color: '#e3eddd', fontSize: 13, flexShrink: 1 }, confirm: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 20 }, filters: { flexDirection: 'row', padding: 4, backgroundColor: '#e8eedf', borderRadius: 12, marginTop: 18 }, filter: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, selected: { backgroundColor: '#fff' }, reportTotal: { color: '#fff', fontSize: 36, fontWeight: '600', marginBottom: 10 }, sampleBtn: { backgroundColor: '#edf1e4', borderRadius: 12, borderWidth: 1, borderColor: '#dfe6d4', marginTop: 10 }, verifyBanner: { backgroundColor: '#fff0d2', borderColor: '#e8c57a', borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 16, gap: 4 } });

