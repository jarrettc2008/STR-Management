// Isolated browser QA only. No persistent database, owner credentials, or real bookings.
// Run after `npx expo export --platform web`; stop with Ctrl+C after testing.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { openStore } from '../server/store.mjs';
import { createApi } from '../server/server.mjs';
const store=openStore();
const user=store.createUser('qa@example.test','temporary-fixture-password');
store.reservations.sync(user,{source:'Airbnb',connectionId:'qa-only',externalId:'qa-booking',propertyId:'tiger-blvd-516',sourceUpdatedAt:'2026-09-01T00:00:00Z',guest:{displayName:'QA Guest - Test Only',externalId:'qa-guest'},checkIn:'2026-09-10',checkOut:'2026-09-14',status:'confirmed',counts:{adults:2,children:2,infants:0,pets:1,totalHumanGuests:4},rawGuestCounts:{adults:2,children:2,infants:0,pets:1,totalGuests:4},stayRevenueCents:124500,currency:'USD',bookingUrl:null,cleaningRequired:true,hotTubService:true});
const api=createApi(store,{origin:'http://localhost:8084'});api.listen(8083,'127.0.0.1');
const root=resolve('dist');
const web=createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep)&&file!==root){res.writeHead(403);res.end();return;}if(!extname(file)||!existsSync(file))file=resolve(root,'index.html');let data=readFileSync(file);const type=extname(file);if(type==='.js')data=Buffer.from(data.toString().replaceAll('http://localhost:8082','http://localhost:8083'));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png'})[type]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
web.listen(8084,'127.0.0.1',()=>console.log('Isolated reservation UI fixture: http://localhost:8084 (no real records).'));
process.on('SIGINT',()=>{web.close();api.close(()=>{store.close();process.exit(0);});});
