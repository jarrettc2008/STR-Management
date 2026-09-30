import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { RoutePoint } from './mileage';

type Props = {
  points: RoutePoint[];
  failed?: boolean;
  /** True when a Google Maps API key is missing for this platform. */
  needsKey?: boolean;
  platformHint?: 'ios' | 'android' | 'web';
};

export function MapPlaceholder({ points, failed = false, needsKey = false, platformHint }: Props) {
  const title = failed ? 'Google Maps could not load' : needsKey ? 'Map tiles need an API key' : 'Your route goes here';
  let body: string;
  if (failed) {
    body = 'Check network access and the Maps API key in .env (see .env.example), then restart Expo.';
  } else if (needsKey && platformHint === 'web') {
    body = 'Add EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY to a local .env (copy from .env.example), restrict the key by HTTP referrer, then restart npx expo start.';
  } else if (needsKey && platformHint === 'android') {
    body = 'For a custom Android build, set GOOGLE_MAPS_ANDROID_API_KEY in .env (see .env.example) and rebuild. Expo Go may show a blank map if its bundled key is unavailable.';
  } else if (needsKey && platformHint === 'ios') {
    body = 'Apple Maps works in Expo Go without a key. For Google Maps in a custom iOS build, set GOOGLE_MAPS_IOS_API_KEY in .env and rebuild.';
  } else {
    body = 'Google Maps setup is required to display the map. Copy .env.example to .env and add the keys for your platform.';
  }
  const pointsLine = points.length
    ? `${points.length} GPS points captured. Recording works without map tiles.`
    : 'Start a trip to record your route and five-minute checkpoints.';

  return (
    <View style={{ minHeight: 205, borderRadius: 16, padding: 24, backgroundColor: '#eaf0e3', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Feather name="map" size={32} color="#527052" />
      <Text style={{ color: '#294e3b', fontWeight: '600', fontSize: 17 }}>{title}</Text>
      <Text style={{ color: '#657358', textAlign: 'center', lineHeight: 20 }}>
        {body}
        {'\n'}
        {pointsLine}
      </Text>
    </View>
  );
}
