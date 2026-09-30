import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openStore } from './store.mjs';
import { filterWork, workReport } from '../src/work/domain.ts';
import { csvReport, pdfReport } from './exports.mjs';
import { monthlyAnalytics } from '../src/reservations/domain.ts';

export function createApi(store, { origin = 'http://localhost:8081', allowSetup = false } = {}) {
  const attempts = new Map();
  return createServer(async (req,res) => {
    const send = (status, data, type='application/json') => { res.writeHead(status,{'Content-Type':type}); res.end(type==='application/json'?JSON.stringify(data):data); };
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    if (req.headers.origin && req.headers.origin !== origin) return send(403,{error:'Origin not allowed.'});
    res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
    if(req.method==='OPTIONS') { res.writeHead(204);res.end();return; }
    try {
      const url=new URL(req.url,'http://localhost'); const path=url.pathname;
      const body=async()=>{let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>20000)throw Object.assign(new Error('Request too large.'),{status:413});}try{return JSON.parse(data);}catch{throw new Error('Invalid JSON request.');}};
      const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      if(path==='/api/status' && req.method==='GET') return send(200,{needsSetup:store.needsSetup(),canSetup:allowSetup&&local});
      if(['/api/login','/api/setup'].includes(path) && req.method==='POST') {
        const key=req.socket.remoteAddress; const now=Date.now();
        for (const [ip,attempt] of attempts) if(attempt.until<now)attempts.delete(ip);
        const count=attempts.get(key)||{count:0,until:now+15*60000}; count.count++; attempts.set(key,count);
        if(count.count>15) return send(429,{error:'Too many attempts. Try again in 15 minutes.'});
        const {email,password}=await body();
        if(path==='/api/setup') {if(!allowSetup || !local || !store.needsSetup())return send(403,{error:'Owner setup is unavailable.'});store.createUser(email,password);}
        return send(200,store.login(email,password));
      }
      const token=req.headers.authorization?.replace(/^Bearer /,'');const user=store.authenticate(token);
      if(path==='/api/logout' && req.method==='POST'){store.logout(token);return send(200,{ok:true});}
      if(path==='/api/properties' && req.method==='GET')return send(200,store.properties(user));
      const filters=Object.fromEntries(url.searchParams);
      if(path==='/api/reservations'&&req.method==='GET')return send(200,store.reservations.list(user,filters.propertyId));
      if(path==='/api/reservations/import'&&req.method==='POST')return send(200,store.reservations.sync(user,await body()));
      if(path==='/api/reservations/analytics'&&req.method==='GET')return send(200,monthlyAnalytics(store.reservations.list(user,filters.propertyId),filters.month,filters.propertyId));
      const booking=path.match(/^\/api\/reservations\/([a-f0-9-]+)(?:\/(counts|profile))?$/);
      if(booking&&req.method==='GET'&&!booking[2])return send(200,store.reservations.detail(user,booking[1]));
      if(booking&&req.method==='PUT'&&booking[2]==='counts')return send(200,store.reservations.override(user,booking[1],await body()));
      if(booking&&req.method==='PUT'&&booking[2]==='profile')return send(200,store.reservations.profile(user,booking[1],await body()));
      if(filters.year && !/^\d{4}$/.test(filters.year)) throw new Error('Choose a four-digit report year.');
      if(path==='/api/work-logs' && req.method==='GET')return send(200,filterWork(store.list(user,filters.propertyId),filters));
      if(path==='/api/work-logs' && req.method==='POST')return send(201,store.save(user,await body()));
      const match=path.match(/^\/api\/work-logs\/([a-f0-9-]+)$/);
      if(match && req.method==='PUT')return send(200,store.save(user,await body(),match[1]));
      if(match && req.method==='DELETE'){store.remove(user,match[1]);return send(200,{ok:true});}
      if(path==='/api/work-report' && req.method==='GET'){
        if(!filters.year)throw new Error('Select a report year.');
        // Annual exports deliberately use the same year/property/type scope as the report view.
        const scope={year:filters.year,propertyId:filters.propertyId,workType:filters.workType};
        const report=workReport(store.list(user,scope.propertyId),store.properties(user),scope);
        if(filters.format==='csv')return send(200,csvReport(report),'text/csv; charset=utf-8');
        if(filters.format==='pdf')return send(200,pdfReport(report),'application/pdf');
        return send(200,report);
      }
      send(404,{error:'Not found.'});
    }catch(error){send(error.status||400,{error:error.status || error instanceof TypeError ? (error.status?error.message:'Invalid work entry.') : error.message});}
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const database=resolve(process.env.STR_DATABASE || 'server/data/work-log.sqlite');mkdirSync(dirname(database),{recursive:true});
  const store=openStore(database);const host=process.env.STR_HOST||'127.0.0.1';
  const api=createApi(store,{origin:process.env.STR_WEB_ORIGIN||'http://localhost:8081',allowSetup:host==='127.0.0.1'&&process.env.NODE_ENV!=='production'});
  api.listen(Number(process.env.STR_PORT||8082),host,()=>console.log(`Work Log API listening on ${host}:${process.env.STR_PORT||8082}. Database: ${database}`));
  const stop=()=>api.close(()=>{store.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
