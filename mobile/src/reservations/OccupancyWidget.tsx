import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useWork } from '../work/WorkProvider';

import { today } from '../mileage';
import { monthlyAnalytics } from './domain';

export default function OccupancyWidget() {
  const work = useWork();
  const summary = monthlyAnalytics(work.reservations, today().slice(0, 7), work.currentProperty.id);
  return <Pressable accessibilityRole="button" accessibilityLabel="Open occupancy calendar" onPress={() => router.push('/occupancy')} style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}>
    <View style={s.row}><Feather name="calendar" size={19} color="#527052" /><Feather name="maximize-2" size={17} color="#527052" /></View>
    <Text style={s.value}>{work.signedIn ? summary.occupiedPropertyNights : '—'}</Text>
    <Text style={s.title}>Occupancy</Text>
    <Text style={s.caption}>{work.signedIn ? (work.demo ? 'Demo · Booked nights · This month' : 'Booked nights · This month') : 'Sign in or show demo data'}</Text>
    <Text style={s.link}>Open calendar ↗</Text>
  </Pressable>;
}
const s = StyleSheet.create({
  card: { flex: 1, backgroundColor: 'white', padding: 17, borderRadius: 18, borderWidth: 1, borderColor: '#e4e9dc' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { fontSize: 34, color: '#294e3b', marginTop: 16, marginBottom: 5 },
  title: { fontSize: 13, fontWeight: '600', color: '#3d543b', marginBottom: 6 },
  caption: { fontSize: 11, color: '#66735e', lineHeight: 17 },
  link: { fontSize: 12, fontWeight: '600', color: '#294e3b', marginTop: 12 },
});

