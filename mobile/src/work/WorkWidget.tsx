import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { today } from '../mileage';

import { editDraft, filterWork, hours, totalMinutes, type WorkEntry } from './domain';
import { useWork } from './WorkProvider';
import { Account, Button, EntryCard, s, WorkForm } from './WorkUI';
export default function WorkWidget(){const work=useWork();return <WorkWidgetContent key={work.signedIn?'owner':'guest'}/>;}
function WorkWidgetContent(){
 const work=useWork();const[editing,setEditing]=useState<WorkEntry|null>(null);const date=today();const rows=filterWork(work.entries,{propertyId:work.currentProperty.id});
 return <View style={s.card}><View style={s.row}><Text accessibilityRole="header" style={s.title}>Work Log</Text><Text style={s.muted}>{work.demo?'Demo · Sample hours':'Your time, documented.'}</Text></View>{work.signedIn?<><View style={s.row}>{[['Today',date],['This month',date.slice(0,7)],['This year',date.slice(0,4)]].map(([label,prefix])=><View key={label} style={s.metric}><Text style={s.muted}>{label}</Text><Text style={s.title}>{hours(totalMinutes(rows.filter(e=>e.workDate.startsWith(prefix))))}</Text><Text style={s.muted}>hours</Text></View>)}</View>{!!work.error&&<Text accessibilityRole="alert" style={s.error}>{work.error}</Text>}<WorkForm key={editing?.id||'new'} initial={editing?editDraft(editing):undefined} onSave={async draft=>{await work.save(draft,editing?.id);setEditing(null);}} onCancel={editing?()=>setEditing(null):undefined}/><View style={s.row}><Button title="All work & annual reports" onPress={()=>router.push('/work-log')}/><Button title={work.demo?'Exit demo':'Sign out'} disabled={work.busy} onPress={()=>{void work.logout().catch(()=>{});}}/></View><Text style={s.label}>Recent work · Date / Time / Hours / Description</Text>{rows.length===0?<Text style={s.muted}>No work recorded yet. Add your first session above.</Text>:rows.slice(0,3).map(e=><EntryCard key={e.id} entry={e} onEdit={setEditing}/>)}</>:<Account/>}</View>;
}




