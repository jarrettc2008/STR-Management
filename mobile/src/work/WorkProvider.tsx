import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { Property, WorkDraft, WorkEntry, WorkReport, Filters } from './domain';
import { exportFile } from './exportFile';
import type { Reservation, Overrides } from '../reservations/domain';
import { CURRENT_PROPERTY } from '../property';
import { adaptDemoData } from '../demo/adaptDemoData';
import { workReport } from './domain';

const API = process.env.EXPO_PUBLIC_WORK_API_URL || (Platform.OS === 'web' ? 'http://localhost:8082' : '');
function useWorkState() {
  const [token, setToken] = useState('');
  const tokenRef = useRef('');
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [status, setStatus] = useState<{needsSetup: boolean; canSetup: boolean} | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useCallback(async (path: string, method='GET', data?: unknown, auth=tokenRef.current) => {
    if (!API) throw new Error('Set EXPO_PUBLIC_WORK_API_URL to your Work Log server address.');
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:controller.signal});
      if(!response.ok){const result=await response.json();if(response.status===401 && auth===tokenRef.current){tokenRef.current='';setToken('');setEntries([]);setProperties([]);setReservations([]);}throw new Error(result.error || 'Request failed.');}
      return response;
    } catch (e) { if(e instanceof TypeError || (e instanceof Error && e.name==='AbortError')) throw new Error('Cannot reach Work Log server. Start npm run server, then retry. Your entry has not been saved.'); throw e; }
    finally {clearTimeout(timeout);}
  },[]);
  const check = useCallback(async()=>{try{setStatus(await (await request('/api/status')).json());setError('');}catch(e){setError((e as Error).message);}},[request]);
  // request updates auth only after an awaited network response, never synchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{let active=true;request('/api/status').then(r=>r.json()).then(value=>{if(active)setStatus(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[request]);
  const reload = async(auth=tokenRef.current)=>{const [rows,props,bookings]=await Promise.all([request('/api/work-logs','GET',undefined,auth).then(r=>r.json()),request('/api/properties','GET',undefined,auth).then(r=>r.json()),request('/api/reservations','GET',undefined,auth).then(r=>r.json())]);if(auth===tokenRef.current){setEntries(rows);setProperties(props);setReservations(bookings);}};
  const run=async(action:()=>Promise<void>)=>{if(lock.current)throw new Error('Please wait for the current action.');lock.current=true;setBusy(true);setError('');try{await action();}catch(e){setError((e as Error).message);throw e;}finally{lock.current=false;setBusy(false);}};
  const saveReservation=async(id:string,kind:'counts'|'profile',data:unknown)=>{const saved:Reservation=await(await request(`/api/reservations/${id}/${kind}`,'PUT',data)).json();setReservations(rows=>rows.map(r=>r.id===id?saved:r.guestId===saved.guestId?{...r,guest:saved.guest}:r));};
  return {entries,properties,reservations,status,error,busy,signedIn:!!token,check,
    saveCounts:(id:string,data:Overrides)=>run(()=>saveReservation(id,'counts',data)),
    saveProfile:(id:string,data:{profileUrl:string;profileSource:string;profileVerifiedManually:boolean;notes:string})=>run(()=>saveReservation(id,'profile',data)),
    bookingHistory:async(id:string)=>(await request('/api/reservations/'+id)).json(),
    login:(email:string,password:string)=>run(async()=>{const session=await (await request(status?.needsSetup?'/api/setup':'/api/login','POST',{email,password})).json();tokenRef.current=session.token;setToken(session.token);setStatus({needsSetup:false,canSetup:false});await reload(session.token);}),
    logout:()=>run(async()=>{await request('/api/logout','POST',{});tokenRef.current='';setToken('');setEntries([]);setProperties([]);setReservations([]);}),
    refresh:()=>run(()=>reload()),
    save:(draft:WorkDraft,id?:string)=>run(async()=>{const saved:WorkEntry=await (await request('/api/work-logs'+(id?'/'+id:''),id?'PUT':'POST',draft)).json();setEntries(rows=>[...rows.filter(e=>e.id!==saved.id),saved]);}),
    remove:(id:string)=>run(async()=>{await request('/api/work-logs/'+id,'DELETE');setEntries(rows=>rows.filter(e=>e.id!==id));}),
    report:async(filters:Filters):Promise<WorkReport> => (await request('/api/work-report?'+new URLSearchParams(filters as Record<string,string>))).json(),
    exportReport:(filters:Filters,format:'csv'|'pdf')=>run(async()=>{const response=await request('/api/work-report?'+new URLSearchParams({...filters,format} as Record<string,string>));await exportFile(new Uint8Array(await response.arrayBuffer()),`work-log-${filters.year}.${format}`,format==='pdf'?'application/pdf':'text/csv');}),
  };
}
type WorkContext = ReturnType<typeof useWorkState> & { demo: boolean; setDemo: (value: boolean) => void; currentProperty: typeof CURRENT_PROPERTY };
const Context=createContext<WorkContext|null>(null);
export function WorkProvider({children}:{children:React.ReactNode}){
  const live=useWorkState();
  const [demo,setDemo]=useState(false);
  const [samples]=useState(()=>adaptDemoData(new Date()));
  const readOnly=async()=>{throw new Error('Demo preview is read-only. Exit demo to change real records.');};
  const work:WorkContext=demo?{
    ...live,...samples,demo,setDemo,signedIn:true,busy:false,error:'',
    save:readOnly,remove:readOnly,saveCounts:readOnly,saveProfile:readOnly,login:readOnly,exportReport:readOnly,
    logout:async()=>setDemo(false),refresh:async()=>{},check:async()=>{},
    report:async filters=>workReport(samples.entries,samples.properties,filters),
    bookingHistory:async id=>({imports:samples.reservations.filter(r=>r.id===id).map(r=>({source:r.source,receivedAt:r.updatedAt})),edits:[]}),
  }:{...live,demo,setDemo,currentProperty:CURRENT_PROPERTY};
  return <Context.Provider value={work}>{children}</Context.Provider>;
}
export function useWork(){const state=useContext(Context);if(!state)throw new Error('WorkProvider is missing.');return state;}
