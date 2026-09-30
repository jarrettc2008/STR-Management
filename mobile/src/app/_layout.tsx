import React from 'react';
import { Stack } from 'expo-router';
import { WorkProvider, useWork } from '../work/WorkProvider';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
function Screens(){const work=useWork();return <View style={{flex:1}}><SafeAreaView edges={['top']} style={{backgroundColor:work.demo?'#fff0d2':'#edf1e4'}}><View style={{paddingHorizontal:18,paddingVertical:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}><Text style={{flex:1,fontSize:12,color:'#294e3b'}}>{work.demo?'DEMO · Sample bookings & work logs · Read-only. Mileage and receipts remain separate.':'Preview the calendar and Work Log with sample data.'}</Text><Pressable accessibilityRole="button" disabled={work.busy} onPress={()=>work.setDemo(!work.demo)} style={{padding:12,minHeight:44}}><Text style={{color:'#294e3b',fontWeight:'600'}}>{work.demo?'Exit demo':'Show demo data'}</Text></Pressable></View></SafeAreaView><Stack key={work.demo?'demo':'live'} screenOptions={{headerShown:false}}/></View>;}
export default function Layout(){return <WorkProvider><Screens/></WorkProvider>;}
