import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';
import { routeSegments, type RoutePoint } from './mileage';
import { MapPlaceholder } from './MapPlaceholder';

function googleKeyConfigured(): boolean {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (Platform.OS === 'ios') return !!extra?.googleMapsIosConfigured;
  if (Platform.OS === 'android') return !!extra?.googleMapsAndroidConfigured;
  return false;
}

/** Expo Go / store client — Apple Maps on iOS needs no key; Android uses Expo Go's maps. */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
}

export default function RouteMap({ points }: { points: RoutePoint[] }) {
  const map = useRef<MapView>(null);
  const [failed, setFailed] = useState(false);
  const configured = googleKeyConfigured();
  const expoGo = isExpoGo();
  // Custom Google provider only when a native key was baked into a dev/production build.
  const useGoogleProvider = configured && !expoGo;
  // iOS: Apple Maps (default provider) needs no key — works in Expo Go and store builds.
  // Android: Expo Go may still render; custom builds need GOOGLE_MAPS_ANDROID_API_KEY in .env + rebuild.
  const canRender = !failed && (Platform.OS === 'ios' || expoGo || configured);

  useEffect(() => {
    if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 35, right: 35, bottom: 35, left: 35 }, animated: true });
  }, [points]);

  if (!canRender) {
    return (
      <MapPlaceholder
        points={points}
        failed={failed}
        needsKey={!configured}
        platformHint={Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web'}
      />
    );
  }

  const center = points[0] ?? { latitude: 36.3729, longitude: -94.2088 };
  const markers = points.filter((p, i) => p.checkpoint || i === points.length - 1);
  return (
    <View>
      <MapView
        ref={map}
        provider={useGoogleProvider ? PROVIDER_GOOGLE : undefined}
        style={{ height: 240, borderRadius: 16 }}
        initialRegion={{ ...center, latitudeDelta: 0.025, longitudeDelta: 0.025 }}
        onMapReady={() => {
          if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 35, right: 35, bottom: 35, left: 35 } });
        }}
        onMapLoaded={() => setFailed(false)}
      >
        {routeSegments(points).map((segment, i) => (
          <Polyline key={i} coordinates={segment} strokeColor="#294e3b" strokeWidth={4} />
        ))}
        {markers.map((p, i) => (
          <Marker
            key={p.timestamp}
            coordinate={p}
            title={i === 0 ? 'Start' : i === markers.length - 1 ? 'Latest location' : '5-minute checkpoint'}
            description={new Date(p.timestamp).toLocaleTimeString()}
          />
        ))}
      </MapView>
      <Text style={{ color: '#66735e', fontSize: 11, marginTop: 6 }}>
        Recorded GPS route · checkpoints approximately every 5 minutes
        {useGoogleProvider ? ' · Google Maps' : Platform.OS === 'ios' ? ' · Apple Maps' : ''}
      </Text>
    </View>
  );
}
