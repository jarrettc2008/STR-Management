import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useWork } from '../work/WorkProvider';
import { Button, s } from '../work/WorkUI';

import { today } from '../mileage';
import { monthlyAnalytics } from './domain';
export default function ReservationWidget(){const work=useWork();const a=monthlyAnalytics(work.reservations,today().slice(0,7),work.currentProperty.id);return <View style={s.card}><Text style={s.title}>Reservations & guest counts</Text><Text style={s.muted}>This month · {work.currentProperty.name}</Text>{work.signedIn?<><Text style={s.text}>{a.stays} stays · {a.counts.totalHumanGuests.known} known human guests · {a.guestNights} known guest-nights</Text><Text style={s.muted}>{a.counts.totalHumanGuests.unknownStays} stays with unknown party size. Pets counted separately.</Text></>:<Text style={s.muted}>Sign in to review actual booking counts. Airbnb/Vrbo are not connected.</Text>}<Button title="Open reservation calendar" onPress={()=>router.push('/reservations')}/></View>;}

