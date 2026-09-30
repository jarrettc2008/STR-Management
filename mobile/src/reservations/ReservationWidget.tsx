import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useWork } from '../work/WorkProvider';
import { Button, s } from '../work/WorkUI';

import { today } from '../mileage';
import { monthlyAnalytics } from './domain';
export default function ReservationWidget(){const work=useWork();const a=monthlyAnalytics(work.reservations,today().slice(0,7),work.currentProperty.id);return <View style={s.card}><Text style={s.title}>Reservations & guest counts</Text><Text style={s.muted}>This month · {work.currentProperty.name}</Text>{work.signedIn?<><Text style={s.text}>{a.stays} stays · {a.counts.totalHumanGuests.known} known human guests · {a.guestNights} known guest-nights</Text><Text style={s.muted}>{work.demo?'Demo sample counts. ':''}{a.counts.totalHumanGuests.unknownStays} stays with unknown party size. Pets counted separately.</Text></>:<Text style={s.muted}>Sign in or show demo data to review booking counts. Data stays on this device — Airbnb/Vrbo are not linked.</Text>}<Button title="Open reservations" onPress={()=>router.push('/reservations')}/></View>;}

