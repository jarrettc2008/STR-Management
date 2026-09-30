import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { RoutePoint } from './mileage';
export function MapPlaceholder({ points, failed = false }: { points: RoutePoint[]; failed?: boolean }) {
  return <View style={{ minHeight: 205, borderRadius: 16, padding: 24, backgroundColor: '#eaf0e3', alignItems: 'center', justifyContent: 'center', gap: 12 }}><Feather name="map" size={32} color="#527052" /><Text style={{ color: '#294e3b', fontWeight: '600', fontSize: 17 }}>{failed ? 'Google Maps could not load' : 'Your route goes here'}</Text><Text style={{ color: '#657358', textAlign: 'center', lineHeight: 20 }}>{failed ? 'Check the map connection and API configuration.' : 'Google Maps setup is required to display the map.'}{'\n'}{points.length ? `${points.length} GPS points captured. Recording works without map tiles.` : 'Start a trip to record your route and five-minute checkpoints.'}</Text></View>;
}
