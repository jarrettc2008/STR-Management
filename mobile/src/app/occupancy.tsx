import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import OccupancyCalendar from '../reservations/OccupancyCalendar';

export default function OccupancyPage() {
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close occupancy calendar" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.back}><Text style={s.backText}>← Back to overview</Text></Pressable>
    <OccupancyCalendar />
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f8f2' },
  page: { width: '100%', maxWidth: 1440, alignSelf: 'center', padding: 16, paddingBottom: 40 },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  backText: { color: '#294e3b', fontSize: 14, fontWeight: '600' },
});
