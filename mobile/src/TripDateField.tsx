import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { today, validDate } from './mileage';

export default function TripDateField({ value, onChange, disabled = false, label = 'Trip date' }: { value: string; onChange: (value: string) => void; disabled?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(`${validDate(value) ? value : today()}T12:00:00`));
  const year = month.getFullYear();
  const index = month.getMonth();
  const offset = new Date(year, index, 1).getDay();
  const count = new Date(year, index + 1, 0).getDate();
  const show = () => { if (validDate(value)) setMonth(new Date(`${value}T12:00:00`)); setOpen(true); };
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text><View style={s.row}><TextInput accessibilityLabel={label} value={value} placeholder="YYYY-MM-DD" editable={!disabled} onFocus={show} onChangeText={onChange} autoCapitalize="none" maxLength={10} style={s.input} /><Pressable accessibilityRole="button" accessibilityLabel={`Open ${label.toLowerCase()} calendar`} disabled={disabled} onPress={show} style={s.action}><Feather name="calendar" size={22} color="#294e3b" /></Pressable></View>
    {open && !disabled && <View style={s.calendar}>
      <View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(new Date(year, index - 1, 1))} style={s.action}><Feather name="chevron-left" size={21} /></Pressable><Text accessibilityRole="header" style={s.month}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={year === new Date().getFullYear() && index === new Date().getMonth()} onPress={() => setMonth(new Date(year, index + 1, 1))} style={s.action}><Feather name="chevron-right" size={21} /></Pressable></View>
      <View style={s.grid}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => <Text key={i} style={s.weekday}>{day}</Text>)}{Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => {
        const day = i - offset + 1;
        if (day < 1 || day > count) return <View key={i} style={s.day} />;
        const date = `${year}-${String(index + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const future = date > today();
        return <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Select ${date}`} accessibilityState={{ selected: value === date, disabled: future }} disabled={future} onPress={() => { onChange(date); setOpen(false); }} style={[s.day, value === date && s.selected]}><Text style={{ color: future ? '#aeb7a8' : value === date ? '#fff' : '#294e3b' }}>{day}</Text></Pressable>;
      })}</View><View style={s.row}><Pressable accessibilityRole="button" onPress={() => { onChange(today()); setMonth(new Date()); setOpen(false); }} style={s.action}><Text>Today</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={s.action}><Text>Close calendar</Text></Pressable></View>
    </View>}<Text style={s.help}>Choose a day or type YYYY-MM-DD.</Text>
  </View>;
}
const s = StyleSheet.create({ field: { marginTop: 14 }, label: { color: '#3d543b', fontWeight: '600', marginBottom: 8 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, input: { flex: 1, borderWidth: 1, borderColor: '#cbd6c3', borderRadius: 10, padding: 13, minHeight: 48, color: '#294e3b', backgroundColor: '#fafbf7', fontSize: 15 }, action: { padding: 12, minHeight: 44, justifyContent: 'center' }, calendar: { marginTop: 8, borderWidth: 1, borderColor: '#cbd6c3', borderRadius: 12, padding: 6 }, month: { fontWeight: '600', color: '#294e3b' }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.2857%', textAlign: 'center', color: '#657358', paddingVertical: 10 }, day: { width: '14.2857%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, selected: { backgroundColor: '#294e3b' }, help: { fontSize: 11, color: '#657358', marginTop: 6 } });

