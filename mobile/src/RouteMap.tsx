import React, { useEffect, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';
import { routeSegments, type RoutePoint } from './mileage';
import { MapPlaceholder } from './MapPlaceholder';

export default function RouteMap({ points }: { points: RoutePoint[] }) {
  const map = useRef<MapView>(null);
  const configured = Constants.expoConfig?.extra?.[Platform.OS === 'ios' ? 'googleMapsIosConfigured' : 'googleMapsAndroidConfigured'];
  useEffect(() => { if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 35, right: 35, bottom: 35, left: 35 }, animated: true }); }, [points]);
  if (!configured) return <MapPlaceholder points={points} />;
  const center = points[0] ?? { latitude: 36.3729, longitude: -94.2088 };
  const markers = points.filter((p, i) => p.checkpoint || i === points.length - 1);
  return <View><MapView ref={map} provider={PROVIDER_GOOGLE} style={{ height: 240, borderRadius: 16 }} initialRegion={{ ...center, latitudeDelta: 0.025, longitudeDelta: 0.025 }} onMapReady={() => { if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 35, right: 35, bottom: 35, left: 35 } }); }}>
    {routeSegments(points).map((segment, i) => <Polyline key={i} coordinates={segment} strokeColor="#294e3b" strokeWidth={4} />)}
    {markers.map((p, i) => <Marker key={p.timestamp} coordinate={p} title={i === 0 ? 'Start' : i === markers.length - 1 ? 'Latest location' : '5-minute checkpoint'} description={new Date(p.timestamp).toLocaleTimeString()} />)}
  </MapView><Text style={{ color: '#66735e', fontSize: 11, marginTop: 6 }}>Recorded GPS route · checkpoints approximately every 5 minutes</Text></View>;
}
