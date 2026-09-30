import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData } from '../src/demo/createDemoData.ts';
import { adaptDemoData } from '../src/demo/adaptDemoData.ts';
import { calendarWeeks } from '../src/reservations/calendar.ts';
test('demo begins January 2025 with four deterministic stays through current month',()=>{
 const now=new Date(2026,8,28);const data=createDemoData(now);
 assert.equal(data.reservations.length,84);assert.equal(data.reservations[0].start,'2025-01-01');
 assert.deepEqual(createDemoData(now),data);assert.equal(new Set(data.reservations.map(r=>r.id)).size,84);
 for(let i=1;i<data.reservations.length;i++)assert.ok(data.reservations[i-1].end<=data.reservations[i].start);
 assert.ok(data.reservations.every(r=>r.propertyId===data.properties[0].id));
});
test('completed work is capped at today while current-month future stays remain',()=>{
 const data=createDemoData(new Date(2025,0,10));assert.equal(data.reservations.length,4);assert.equal(data.work.length,1);assert.equal(data.work[0].date,'2025-01-04');assert.equal(data.work[0].hours,3);
 assert.equal(createDemoData(new Date(2024,11,31)).reservations.length,0);
 assert.throws(()=>createDemoData(new Date('invalid')));
});
test('adapter retains isolated IDs, exact amounts/minutes and explicitly synthetic guest counts',()=>{
 const now=new Date(2026,8,28),raw=createDemoData(now),demo=adaptDemoData(now);
 assert.equal(demo.entries.length,126);assert.equal(demo.entries[0].minutesWorked,180);
 assert.equal(demo.reservations[0].source.stayRevenueCents,raw.reservations[0].amount*100);
 assert.equal(demo.reservations[0].source.counts.totalHumanGuests,3); assert.equal(demo.reservations[0].source.counts.pets,1); assert.ok(demo.reservations.every(r=>r.source.counts.totalHumanGuests===r.source.counts.adults+r.source.counts.children+r.source.counts.infants));
 assert.ok(demo.reservations.every(r=>r.source.propertyId.startsWith('demo-')&&r.guest.profileUrl===null));
 assert.equal(calendarWeeks('2026-09',demo.reservations,demo.currentProperty.id).flatMap(w=>w.bars).reduce((n,b)=>n+b.span,0),15);
});

