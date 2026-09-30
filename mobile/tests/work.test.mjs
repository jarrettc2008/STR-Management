import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newWorkDraft, duration, validateWork, filterWork, workReport, totalMinutes } from '../src/work/domain.ts';
import { today } from '../src/mileage.ts';
import { openStore } from '../server/store.mjs';
import { createApi } from '../server/server.mjs';
import { csvReport, pdfReport } from '../server/exports.mjs';
const draft=(overrides={})=>({...newWorkDraft(),workDate:'2025-09-26',startTime:'08:00',endTime:'09:45',description:'Repaired the deck railing',...overrides});
test('current local date defaults and previous date remains editable',()=>{assert.equal(newWorkDraft().workDate,today());assert.equal(validateWork(draft()).workDate,'2025-09-26');});
test('time and manual calculations use exact minutes',()=>{assert.equal(duration(draft({endTime:'08:30'})),30);assert.equal(duration(draft({endTime:'08:15'})),15);assert.equal(duration(draft()),105);assert.equal(duration(draft({entryMethod:'hours',hours:'1.75',startTime:'',endTime:''})),105);assert.equal(duration(draft({startTime:'08:15',endTime:'12:45'})),270);});
test('invalid durations and fields rejected without rounding',()=>{for(const d of [draft({entryMethod:'hours',hours:'350'}),draft({entryMethod:'hours',hours:'0'}),draft({entryMethod:'hours',hours:'-1'}),draft({entryMethod:'hours',hours:'1.001'}),draft({startTime:'23:00',endTime:'01:00'}),draft({description:''}),draft({workDate:'2025-02-30'}),draft({workType:'Invalid'})])assert.throws(()=>validateWork(d));});
test('SQLite survives reopen, supports edits, multiple sessions per day and deletion',()=>{
 const dir=mkdtempSync(join(tmpdir(),'str-work-'));let store;
 try {const path=join(dir,'test.sqlite');store=openStore(path);const user=store.createUser('owner@example.test','test-password-123');const a=store.save(user,draft({entryMethod:'hours',hours:'1.75'}));const b=store.save(user,draft());assert.notEqual(a.id,b.id);assert.equal(a.minutesWorked,105);store.close();store=openStore(path);assert.equal(store.list(user).length,2);const changed=store.save(user,draft({endTime:'08:30'}),a.id);assert.equal(changed.id,a.id);assert.equal(changed.minutesWorked,30);store.remove(user,b.id);assert.equal(store.list(user).length,1);}finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
test('filters, monthly/type/property/detail totals and exports reconcile',()=>{
 const store=openStore();try{const user=store.createUser('owner@example.test','test-password-123');store.db.prepare('INSERT INTO properties VALUES (?,?)').run('p2','Second property');store.db.prepare('INSERT INTO property_access VALUES (?,?)').run(user,'p2');
 store.save(user,draft());store.save(user,draft({propertyId:'p2',workDate:'2025-10-01',workType:'Cleaning',endTime:'08:30'}));store.save(user,draft({workDate:'2024-10-01'}));const rows=store.list(user);const report=workReport(rows,store.properties(user),{year:'2025'});assert.equal(report.totalMinutes,135);assert.equal(totalMinutes(report.rows),135);assert.equal(Object.values(report.byType).reduce((a,b)=>a+b,0),135);assert.equal(Object.values(report.byProperty).reduce((a,b)=>a+b,0),135);assert.equal(report.monthly.reduce((a,b)=>a+b.minutes,0),135);assert.equal(report.monthly[8].minutes,105);assert.equal(filterWork(rows,{year:'2025',propertyId:'p2',workType:'Cleaning',from:'2025-10-01',to:'2025-10-01',search:'DECK'}).length,1);assert.match(csvReport(report),/TOTAL: 2.25 hours.*135 minutes/);assert.match(pdfReport(report).toString(),/TOTAL: 2.25 hours.*135 minutes/);assert.match(csvReport({...report,rows:[{...report.rows[0],description:'=SUM(A1:A2)'}]}),/'=SUM/);
 }finally{store.close();}
});
test('HTTP authentication, ownership and property authorization protect CRUD and exports',async()=>{
 const store=openStore();const a=store.createUser('a@example.test','test-password-123');const b=store.createUser('b@example.test','test-password-123',{id:'other',name:'Other'});const record=store.save(a,draft());const api=createApi(store);await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${api.address().port}`;
 const call=(path,token,method='GET',data)=>fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});
 try{assert.equal((await call('/api/work-logs')).status,401);const login=await (await call('/api/login',null,'POST',{email:'b@example.test',password:'test-password-123'})).json();const token=login.token;assert.deepEqual(await (await call('/api/work-logs',token)).json(),[]);assert.equal((await call('/api/work-logs/'+record.id,token,'PUT',draft())).status,404);assert.equal((await call('/api/work-logs/'+record.id,token,'DELETE')).status,404);assert.equal((await call('/api/work-logs',token,'POST',draft())).status,403);assert.equal((await call('/api/work-report?year=2025&propertyId=tiger-blvd-516&format=pdf',token)).status,403);const report=await (await call('/api/work-report?year=2025',token)).json();assert.equal(report.totalMinutes,0);assert.equal((await call('/api/setup',null,'POST',{email:'x@example.test',password:'test-password-123'})).status,403);await call('/api/logout',token,'POST',{});assert.equal((await call('/api/work-logs',token)).status,401);assert.equal(store.list(a).length,1);assert.equal(store.list(b).length,0);}finally{await new Promise(resolve=>api.close(resolve));store.close();}
});
