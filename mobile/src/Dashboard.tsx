import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import MileageModal from './MileageModal';
import { useMileage } from './useMileage';
import { inPeriod, totalMiles, today } from './mileage';
import ReceiptModal from './receipts/ReceiptModal';
import { useReceipts } from './receipts/useReceipts';
import { approvedTotal, dollars } from './receipts/domain';
import { CURRENT_PROPERTY } from './property';
import { formatWholeDollars, getNightlyRateRecommendation } from './pricing/nightlyRateRecommendation';
import WorkWidget from './work/WorkWidget';
import { useWork } from './work/WorkProvider';
import ReservationWidget from './reservations/ReservationWidget';
import OccupancyWidget from './reservations/OccupancyWidget';
import GuestAveragesCard from './reservations/GuestAveragesCard';
import TaxModal from './tax/TaxModal';
import { buildTaxSummary, formatTaxDollars, type PropertyTaxPayment } from './tax/taxSummary';
import { readTaxPayments } from './tax/taxStore';

type Icon = React.ComponentProps<typeof Feather>['name'];
const widgets: { title: string; icon: Icon; empty: string; description: string }[] = [
  { title: 'Expenses', icon: 'shopping-bag', empty: 'No expenses added', description: 'Keep household essentials, restocks, and property supplies organized here.' },
  { title: 'Tax records', icon: 'file-text', empty: 'No records yet', description: 'Mileage, receipt, and local tax-payment totals for this property.' },
  { title: 'Mileage', icon: 'navigation', empty: 'No trips logged', description: 'Track property visits, supply runs, and maintenance trips.' },
  { title: 'Receipt vault', icon: 'camera', empty: 'No receipts saved', description: 'Keep receipt photos together with their related property expenses.' },
];
function Dashboard() {
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState('This month');
  const work = useWork();
  const demoRevenue = work.reservations.filter(r => period === 'All time' || r.source.checkIn.startsWith(today().slice(0, period === 'This month' ? 7 : 4))).reduce((sum, r) => sum + (r.source.stayRevenueCents ?? 0), 0);
  const [mileageOpen, setMileageOpen] = useState(false);
  const mileage = useMileage();
  const receipts = useReceipts();
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxPayments, setTaxPayments] = useState<PropertyTaxPayment[]>([]);
  const receiptPeriod = today();
  const visibleReceipts = receipts.receipts.filter(r => r.ownerId === CURRENT_PROPERTY.ownerId && r.reviewed.propertyId === CURRENT_PROPERTY.id && (period === 'All time' || r.reviewed.date.startsWith(receiptPeriod.slice(0, period === 'This month' ? 7 : 4))));
  const mileageTrips = inPeriod(mileage.trips, period);
  const [detail, setDetail] = useState<{ title: string; description: string } | null>(null);

  React.useEffect(() => {
    void readTaxPayments().then(setTaxPayments).catch(() => setTaxPayments([]));
  }, [taxOpen, receipts.receipts, mileage.trips, work.demo]);

  const taxSummary = useMemo(() => buildTaxSummary({
    period,
    today: today(),
    receipts: receipts.receipts.filter(r => r.ownerId === CURRENT_PROPERTY.ownerId && r.reviewed.propertyId === CURRENT_PROPERTY.id),
    trips: mileage.trips,
    payments: taxPayments,
  }), [period, receipts.receipts, mileage.trips, taxPayments]);

  const nightlyPricing = useMemo(() => getNightlyRateRecommendation(new Date()), []);

  function openWidget(title: string) {
    if (title === 'Mileage') setMileageOpen(true);
    else if (title === 'Expenses' || title === 'Receipt vault') setReceiptsOpen(true);
    else if (title === 'Tax records') setTaxOpen(true);
    else {
      const widget = widgets.find(w => w.title === title);
      if (widget) setDetail(widget);
    }
  }

  function widgetValue(title: string): string {
    if (title === 'Mileage' && mileage.ready) return totalMiles(mileageTrips).toLocaleString() + ' mi';
    if (title === 'Expenses' && receipts.ready) return dollars(approvedTotal(visibleReceipts));
    if (title === 'Receipt vault' && receipts.ready) return String(visibleReceipts.length);
    if (title === 'Tax records' && mileage.ready && receipts.ready) return formatTaxDollars(taxSummary.deductibleIshTotalCents);
    return '—';
  }

  function widgetCaption(title: string): string {
    if (title === 'Mileage') {
      if (mileage.error) return 'Open to resolve storage issue';
      if (!mileage.ready) return 'Loading records…';
      return mileageTrips.length + ' trips · ' + period.toLowerCase();
    }
    if (title === 'Expenses') return 'Approved expenses · ' + period.toLowerCase();
    if (title === 'Receipt vault') {
      if (!receipts.ready) return 'Loading records…';
      return visibleReceipts.filter(r => r.status === 'draft').length + ' awaiting review · ' + period.toLowerCase();
    }
    if (title === 'Tax records') {
      if (!mileage.ready || !receipts.ready) return 'Loading local totals…';
      if (taxSummary.deductibleIshTotalCents === 0 && taxSummary.paymentCount === 0) return 'Open for sample tax snapshot';
      return 'On-device estimate · ' + period.toLowerCase();
    }
    return widgets.find(w => w.title === title)?.empty ?? '';
  }

  return <SafeAreaView style={s.safe} edges={['bottom', 'left', 'right']}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={[s.page, width > 760 && { paddingHorizontal: 48 }]}>
      <View style={s.row}><View style={s.brand}><View style={s.logo}><Feather name="home" size={22} color="white" /></View><View><Text style={s.brandName}>Staywell</Text><Text style={s.eyebrow}>PROPERTY MANAGER</Text></View></View><Pressable accessibilityRole="button" accessibilityLabel="Property details" style={s.avatar} onPress={() => setDetail({ title: 'Your property', description: '516 Tiger Blvd\nBentonville, Arkansas 72712' })}><Text style={s.avatarText}>TB</Text></Pressable></View>
      <Pressable accessibilityRole="button" accessibilityLabel={mileage.active ? 'Open mileage — GPS trip in progress' : 'Open mileage tracker'} onPress={() => setMileageOpen(true)} style={s.mileageCue}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}><Feather name={mileage.active ? 'navigation' : 'map-pin'} size={18} color={mileage.active ? '#9c4a35' : '#294e3b'} /><Text style={[s.small, { flex: 1, color: mileage.active ? '#9c4a35' : '#294e3b', fontWeight: '600' }]}>{mileage.active ? 'GPS trip in progress — tap to open Stop controls' : 'Mileage · Start a GPS trip or log miles manually'}</Text></View><Feather name="chevron-right" size={18} color="#73816d" /></Pressable><View style={s.intro}><Text style={s.eyebrow}>YOUR PROPERTY, AT A GLANCE</Text><Text accessibilityRole="header" style={s.title}>A little clarity.{'\n'}A better stay.</Text><Text style={s.subtitle}>Welcome to your property’s home base.</Text></View>
      <View style={s.property}><View style={s.house}><Feather name="home" size={28} color="#d3e3c6" /></View><View style={{ flex: 1 }}><Text style={s.propertyLabel}>YOUR PROPERTY</Text><Text style={s.propertyTitle}>{CURRENT_PROPERTY.name}</Text><Text style={s.propertyAddress}>{CURRENT_PROPERTY.cityStateZip}</Text></View><Feather name="map-pin" size={20} color="#d3e3c6" /></View>
      <View style={s.section}><Text accessibilityRole="header" style={s.heading}>The overview</Text><Text style={s.small}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text></View>
      <View style={s.periods}>{['This month', 'This year', 'All time'].map(value => <Pressable accessibilityRole="button" accessibilityState={{ selected: period === value }} key={value} onPress={() => setPeriod(value)} style={[s.period, value === period && { backgroundColor: 'white' }]}><Text style={[s.small, value === period && { color: '#294e3b', fontWeight: '700' }]}>{value}</Text></Pressable>)}</View>
      <View style={s.grid}>{[{ title: 'Booking revenue', icon: 'dollar-sign' as Icon }].map(metric => <View key={metric.title} style={s.metric}><View style={s.row}><Feather name={metric.icon} size={19} color="#527052" /><Text style={s.small}>{period}</Text></View><Text style={s.value}>{work.demo ? dollars(demoRevenue) : '—'}</Text><Text style={s.cardTitle}>{metric.title}</Text><Text style={s.small}>{work.demo ? 'Demo sample · On-device · By check-in date' : 'On this device · No booking revenue yet'}</Text></View>)}<OccupancyWidget/></View>
      <GuestAveragesCard/>

      <View style={[s.columns, width > 760 && { flexDirection: 'row', gap: 26 }]}>
        <View style={s.column}><View style={s.section}><Text accessibilityRole="header" style={s.heading}>Keep the details together</Text><Feather name="grid" size={18} color="#73816d" /></View><View style={s.grid}>{widgets.map(widget => <Pressable accessibilityRole="button" accessibilityLabel={`View ${widget.title}`} key={widget.title} onPress={() => openWidget(widget.title)} style={({ pressed }) => [s.widget, pressed && { opacity: 0.65 }]}><View style={s.row}><View style={s.icon}><Feather name={widget.icon} size={22} color="#527052" /></View><Feather name="arrow-up-right" size={17} color="#7d8b75" /></View><Text style={[s.cardTitle, { marginTop: 18 }]}>{widget.title}</Text><Text style={s.widgetValue}>{widgetValue(widget.title)}</Text><Text style={s.small}>{widgetCaption(widget.title)}</Text></Pressable>)}</View></View>
        <View style={s.column}><View style={s.section}><Text accessibilityRole="header" style={s.heading}>Looking ahead</Text><Text style={s.badge}>PRICING</Text></View><View style={s.outlook}><Feather name="trending-up" size={26} color="#527052" /><Text style={s.outlookTitle}>Your next best nightly rate</Text><Text style={s.featuredRate}>{formatWholeDollars(nightlyPricing.featuredDollars)}</Text><Text style={s.featuredLabel}>{nightlyPricing.featuredLabel}</Text><Text style={s.body}>{nightlyPricing.summary}</Text><View style={s.days}>{nightlyPricing.days.map((day, i) => <View key={i} style={s.day}><Text style={s.dayRate}>{formatWholeDollars(day.rateDollars)}</Text><Text style={s.small}>{day.label}</Text></View>)}</View><Text style={s.small}>{nightlyPricing.caption}</Text></View>
          
        </View>
      </View>
      <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Booking channels</Text><Feather name="link" size={18} color="#73816d" /></View><Text style={[s.small, { marginBottom: 10 }]}>Stay data stays on this phone for now — no live Airbnb/Vrbo sync.</Text><View style={s.channelRow}>{[{ name: 'Airbnb', tint: '#fff0eb', ink: '#bb6154' }, { name: 'Vrbo', tint: '#edf2fb', ink: '#4869a5' }].map((channel) => <Pressable accessibilityRole="button" accessibilityLabel={`${channel.name} on-device status`} key={channel.name} onPress={() => setDetail({ title: `${channel.name} · On this device`, description: work.demo ? `${channel.name} preview uses on-device demo stays only. There is no cloud channel sync — sample reservations stay on this phone.` : `${channel.name} is not linked. Staywell keeps reservations and guest notes on this phone for now. There is no cloud channel sync yet — use demo data or records already saved locally.` })} style={s.channelCard}><View style={[s.channelIcon, { backgroundColor: channel.tint }]}><Text style={{ fontSize: 22, fontWeight: '700', color: channel.ink }}>{channel.name[0]}</Text></View><View style={{ flex: 1, minWidth: 0 }}><Text style={s.cardTitle}>{channel.name}</Text><Text style={s.small}>{work.demo ? 'Demo stays · On this device' : 'On this device · Not linked'}</Text></View><Feather name="chevron-right" size={20} color="#73816d" /></Pressable>)}</View>
      <ReservationWidget/><WorkWidget/><View style={s.footer}><Feather name="sun" size={16} color="#73816d" /><Text style={s.small}>Less busywork. More room for what matters.</Text></View>
    </ScrollView>
    {receiptsOpen && <ReceiptModal receipts={receipts} onClose={() => setReceiptsOpen(false)} period={period} />}
    {mileageOpen && <MileageModal visible onClose={() => setMileageOpen(false)} mileage={mileage} period={period} />}
    {taxOpen && <TaxModal onClose={() => setTaxOpen(false)} period={period} mileage={mileage} receipts={receipts} />}
    <Modal visible={detail !== null} transparent animationType="fade" onRequestClose={() => setDetail(null)}><View style={s.overlay}><View accessibilityViewIsModal style={s.dialog}><View style={s.row}><Text accessibilityRole="header" style={s.heading}>{detail?.title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close details" style={s.close} onPress={() => setDetail(null)}><Feather name="x" size={24} color="#294e3b" /></Pressable></View><Text style={s.body}>{detail?.description}</Text><Text style={[s.small, { marginTop: 24 }]}>On this device · Records stay local for now.</Text><Pressable accessibilityRole="button" onPress={() => setDetail(null)} style={s.button}><Text style={s.buttonText}>Back to overview</Text></Pressable></View></View></Modal>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Dashboard /></SafeAreaProvider>; }
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f8f2' }, page: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 30 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, logo: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#294e3b', alignItems: 'center', justifyContent: 'center' }, brandName: { fontSize: 22, fontWeight: '700', color: '#294e3b', letterSpacing: -0.8 }, eyebrow: { fontSize: 11, letterSpacing: 1.4, color: '#66795e', marginTop: 4 }, avatar: { width: 44, height: 44, borderRadius: 24, backgroundColor: '#e6ebdc', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#4c6640', fontWeight: '600', fontSize: 12 }, intro: { paddingTop: 34, paddingBottom: 27 }, title: { fontSize: 36, lineHeight: 42, letterSpacing: -1.4, fontWeight: '600', color: '#263f2d', marginTop: 12 }, subtitle: { fontSize: 14, color: '#697362', marginTop: 12 }, property: { backgroundColor: '#294e3b', padding: 21, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 15 }, house: { backgroundColor: '#3c604b', width: 52, height: 60, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, propertyLabel: { fontSize: 11, letterSpacing: 1.2, color: '#c7d7bf', marginBottom: 7 }, propertyTitle: { fontSize: 20, fontWeight: '600', color: 'white' }, propertyAddress: { fontSize: 11, color: '#c7d7bf', marginTop: 6, lineHeight: 17 }, section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 28, marginBottom: 16 }, heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.4, color: '#2c4431' }, small: { fontSize: 11, color: '#66735e', lineHeight: 17 }, periods: { flexDirection: 'row', alignSelf: 'flex-start', padding: 4, borderRadius: 13, backgroundColor: '#edf0e7', marginBottom: 15 }, period: { paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: 10 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { flex: 1, backgroundColor: 'white', padding: 17, borderRadius: 18, borderWidth: 1, borderColor: '#e4e9dc' }, value: { fontSize: 34, color: '#294e3b', marginTop: 16, marginBottom: 5 }, cardTitle: { fontSize: 13, fontWeight: '600', color: '#3d543b', marginBottom: 6 }, columns: { gap: 0 }, column: { flex: 1 }, widget: { width: '47%', flexGrow: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e9dc', borderRadius: 18, padding: 17 }, icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#f0f3e8', alignItems: 'center', justifyContent: 'center' }, widgetValue: { fontSize: 26, color: '#294e3b', marginBottom: 5 }, badge: { fontSize: 11, color: '#5c704b', letterSpacing: 0.8, backgroundColor: '#e8eddd', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 }, outlook: { backgroundColor: '#edf1e4', borderWidth: 1, borderColor: '#dfe6d4', borderRadius: 20, padding: 22 }, outlookTitle: { fontSize: 18, fontWeight: '600', color: '#3e5938', marginTop: 17, letterSpacing: -0.5 }, body: { fontSize: 13, lineHeight: 22, color: '#657358', marginTop: 11 }, days: { flexDirection: 'row', gap: 12, marginTop: 27, marginBottom: 21 }, day: { flex: 1, alignItems: 'center', gap: 8 }, dash: { width: '100%', height: 4, borderRadius: 5, backgroundColor: '#d3ddc4' }, featuredRate: { fontSize: 42, fontWeight: '600', color: '#294e3b', marginTop: 14, letterSpacing: -1.2 }, featuredLabel: { fontSize: 13, fontWeight: '600', color: '#3e5938', marginTop: 4 }, dayRate: { fontSize: 12, fontWeight: '700', color: '#294e3b', textAlign: 'center' }, channelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 }, channelCard: { flexGrow: 1, flexBasis: '46%', minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e9dc', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 16 }, channelIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, mileageCue: { marginTop: 20, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, borderRadius: 14, backgroundColor: '#edf1e4', borderWidth: 1, borderColor: '#dfe6d4', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 34 }, overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#152b22aa' }, dialog: { width: '100%', maxWidth: 440, backgroundColor: 'white', borderRadius: 24, padding: 24 }, close: { padding: 10 }, button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#294e3b', borderRadius: 12, marginTop: 24 }, buttonText: { color: 'white', fontWeight: '600' },
});







