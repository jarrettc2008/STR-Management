import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { WorkProvider, useWork } from '../work/WorkProvider';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { seedOnDeviceDemoData } from '../demo/seedLocalDemo';

function Screens() {
  const work = useWork();
  const [seeding, setSeeding] = useState(false);

  async function toggleDemo() {
    if (work.busy || seeding) return;
    if (!work.demo) {
      setSeeding(true);
      try {
        // Populate on-device mileage, receipts (with images), tax payments, and GPS sample routes.
        await seedOnDeviceDemoData({ replace: true });
      } catch {
        // Bookings/work demo still works even if local file seed fails (e.g. web storage).
      } finally {
        setSeeding(false);
      }
      work.setDemo(true);
    } else {
      work.setDemo(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: work.demo ? '#fff0d2' : '#edf1e4' }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            {work.demo ? (
              <>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#8a5a12' }}>DEMO PREVIEW</Text>
                <Text style={{ fontSize: 12, color: '#5c4818', lineHeight: 17 }}>
                  Sample bookings, work log, mileage, receipts, tax snapshot, and map routes · on this device.
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 12, color: '#294e3b', lineHeight: 17 }}>
                Show demo data fills bookings, work log, mileage, receipts, tax, and sample map routes on this device.
              </Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={work.demo ? 'Exit demo preview' : 'Show demo data'}
            disabled={work.busy || seeding}
            onPress={() => { void toggleDemo(); }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              minHeight: 44,
              justifyContent: 'center',
              borderRadius: 10,
              backgroundColor: work.demo ? '#294e3b' : 'transparent',
              borderWidth: work.demo ? 0 : 1,
              borderColor: '#294e3b55',
              opacity: seeding ? 0.7 : 1,
            }}
          >
            {seeding ? (
              <ActivityIndicator color="#294e3b" />
            ) : (
              <Text style={{ color: work.demo ? '#fff' : '#294e3b', fontWeight: '700', fontSize: 13 }}>
                {work.demo ? 'Exit demo' : 'Show demo data'}
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
      <Stack key={work.demo ? 'demo' : 'live'} screenOptions={{ headerShown: false }} />
    </View>
  );
}

export default function Layout() {
  return (
    <WorkProvider>
      <Screens />
    </WorkProvider>
  );
}
