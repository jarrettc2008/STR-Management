import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarWeeks, shiftMonth } from '../src/reservations/calendar.ts';
const stay=(id,start,end,extra={})=>({id,source:{propertyId:'p',status:'confirmed',checkIn:start,checkOut:end,...extra}});
test('night bars split across weeks/months without including checkout night',()=>{
 const weeks=calendarWeeks('2026-09',[stay('a','2026-08-30','2026-09-08')],'p');
 const bars=weeks.flatMap(w=>w.bars);
 assert.equal(bars.reduce((sum,b)=>sum+b.span,0),7);
 assert.equal(bars[0].column,2);assert.equal(bars[0].continuesBefore,true);assert.equal(bars[0].continuesAfter,true);
 assert.equal(bars.at(-1).continuesAfter,false);
});
test('overlapping bookings occupy separate lanes; adjacent stays can share a lane',()=>{
 const bars=calendarWeeks('2026-09',[stay('a','2026-09-07','2026-09-10'),stay('b','2026-09-08','2026-09-11'),stay('c','2026-09-10','2026-09-12')],'p').flatMap(w=>w.bars);
 assert.notEqual(bars[0].lane,bars[1].lane);assert.equal(bars[0].lane,bars[2].lane);
});
test('calendar excludes cancelled/other-property stays and handles leap years and year navigation',()=>{
 assert.equal(calendarWeeks('2024-02',[],'p').flatMap(w=>w.dates).filter(d=>d.startsWith('2024-02')).length,29);
 assert.equal(calendarWeeks('2026-09',[stay('a','2026-09-01','2026-09-03',{status:'cancelled'}),stay('b','2026-09-01','2026-09-03',{propertyId:'other'})],'p').flatMap(w=>w.bars).length,0);
 assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');
});
