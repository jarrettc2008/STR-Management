import React, { useEffect, useState } from 'react';
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Text, View } from 'react-native';
import { routeSegments, type RoutePoint } from './mileage';
import { MapPlaceholder } from './MapPlaceholder';

function RouteLines({ points }: { points: RoutePoint[] }) {
  const map = useMap();
  const maps = useMapsLibrary('maps');
  const core = useMapsLibrary('core');
  useEffect(() => {
    if (!map || !maps || !core || !points.length) return;
    const lines = routeSegments(points).map(segment => new maps.Polyline({ map, path: segment.map(p => ({ lat: p.latitude, lng: p.longitude })), strokeColor: '#294e3b', strokeWeight: 4 }));
    if (points.length > 1) { const bounds = new core.LatLngBounds(); points.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude })); map.fitBounds(bounds, 35); }
    else map.setCenter({ lat: points[0].latitude, lng: points[0].longitude });
    return () => lines.forEach(line => line.setMap(null));
  }, [map, maps, core, points]);
  return null;
}
export default function RouteMap({ points }: { points: RoutePoint[] }) {
  const [failed, setFailed] = useState(false);
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;
  if (!apiKey || failed) return <MapPlaceholder points={points} failed={failed} />;
  return <View><APIProvider apiKey={apiKey} onError={() => setFailed(true)}><Map style={{ height: 240, borderRadius: 16, overflow: 'hidden' }} defaultCenter={{ lat: points[0]?.latitude ?? 36.3729, lng: points[0]?.longitude ?? -94.2088 }} defaultZoom={14} gestureHandling="cooperative"><RouteLines points={points} />{points.filter((p, i) => p.checkpoint || i === points.length - 1).map((p, i) => <Marker key={p.timestamp} position={{ lat: p.latitude, lng: p.longitude }} title={`${i === 0 ? 'Start' : 'Checkpoint'} · ${new Date(p.timestamp).toLocaleTimeString()}`} />)}</Map></APIProvider><Text style={{ color: '#66735e', fontSize: 11, marginTop: 6 }}>Recorded GPS route · checkpoints approximately every 5 minutes</Text></View>;
}
