import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { validateBooking, validateCounts, safeExternalUrl } from '../src/reservations/domain.ts';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const guest=r=>({id:r.id,displayName:r.display_name,email:r.email,phone:r.phone,profileUrl:r.profile_url,profileSource:r.profile_source,profileVerifiedManually:!!r.profile_verified_manually,profileAddedAt:r.profile_added_at,notes:r.notes,createdAt:r.created_at,updatedAt:r.updated_at});
export function reservationStore(db){
 const access=(user,property)=>{if(!db.prepare('SELECT 1 FROM property_access WHERE user_id=? AND property_id=?').get(user,property))fail('Property unavailable.',403);};
 const authorized=(user,id)=>{const row=db.prepare('SELECT r.* FROM reservations r JOIN property_access a ON a.user_id=r.user_id AND a.property_id=r.property_id WHERE r.id=? AND r.user_id=?').get(id,user);if(!row)fail('Reservation not found.',404);return row;};
 const output=r=>({id:r.id,guestId:r.guest_id,source:JSON.parse(r.source_json),overrides:JSON.parse(r.overrides_json),overrideUpdatedAt:r.override_updated_at,updatedAt:r.updated_at,guest:guest(db.prepare('SELECT * FROM guests WHERE id=?').get(r.guest_id))});
 const transaction=action=>{db.exec('BEGIN IMMEDIATE');try{const result=action();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 return {
  list(user,property){if(property)access(user,property);return db.prepare('SELECT r.* FROM reservations r JOIN property_access a ON a.user_id=r.user_id AND a.property_id=r.property_id WHERE r.user_id=? ORDER BY r.updated_at DESC').all(user).filter(r=>!property||r.property_id===property).map(output);},
  detail(user,id){const row=authorized(user,id);return {...output(row),imports:db.prepare('SELECT source_json,received_at FROM reservation_imports WHERE reservation_id=? ORDER BY id DESC').all(id).map(r=>({source:JSON.parse(r.source_json),receivedAt:r.received_at})),edits:db.prepare('SELECT overrides_json,created_at FROM reservation_edits WHERE reservation_id=? ORDER BY id DESC').all(id).map(r=>({overrides:JSON.parse(r.overrides_json),createdAt:r.created_at}))};},
  sync(user,payload){const source=validateBooking(payload);access(user,source.propertyId);return transaction(()=>{
    const now=new Date().toISOString();let existing=db.prepare('SELECT * FROM reservations WHERE user_id=? AND source=? AND connection_id=? AND external_id=?').get(user,source.source,source.connectionId,source.externalId);
    if(existing){authorized(user,existing.id);const previous=JSON.parse(existing.source_json);if(source.sourceUpdatedAt<previous.sourceUpdatedAt)fail('Stale source update rejected.',409);if(source.sourceUpdatedAt===previous.sourceUpdatedAt){if(!isDeepStrictEqual(source,previous))fail('Conflicting source update at the same timestamp.',409);return output(existing);}}
    let person=source.guest.externalId?db.prepare('SELECT * FROM guests WHERE user_id=? AND source=? AND connection_id=? AND external_id=?').get(user,source.source,source.connectionId,source.guest.externalId):null;
    // Without a source guest ID, reuse only this exact reservation's unchanged primary guest.
    if(!person&&!source.guest.externalId&&existing){const old=db.prepare('SELECT * FROM guests WHERE id=?').get(existing.guest_id);if(!old.external_id&&old.display_name===source.guest.displayName)person=old;}
    const guestId=person?.id||randomUUID();
    if(person)db.prepare('UPDATE guests SET display_name=?,email=?,phone=?,updated_at=? WHERE id=?').run(source.guest.displayName,source.guest.email??person.email,source.guest.phone??person.phone,now,guestId);
    else db.prepare('INSERT INTO guests (id,user_id,source,connection_id,external_id,display_name,email,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(guestId,user,source.source,source.connectionId,source.guest.externalId??null,source.guest.displayName,source.guest.email??null,source.guest.phone??null,now,now);
    const id=existing?.id||randomUUID();
    if(existing)db.prepare('UPDATE reservations SET property_id=?,guest_id=?,source_json=?,updated_at=? WHERE id=?').run(source.propertyId,guestId,JSON.stringify(source),now,id);
    else db.prepare('INSERT INTO reservations (id,user_id,property_id,guest_id,source,connection_id,external_id,source_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,user,source.propertyId,guestId,source.source,source.connectionId,source.externalId,JSON.stringify(source),now,now);
    db.prepare('INSERT INTO reservation_imports (reservation_id,source_json,received_at) VALUES (?,?,?)').run(id,JSON.stringify(payload),now);
    return output(authorized(user,id));
  });},
  override(user,id,input){authorized(user,id);const overrides=validateCounts(input,true);return transaction(()=>{const now=new Date().toISOString();db.prepare('UPDATE reservations SET overrides_json=?,override_updated_at=?,updated_at=? WHERE id=?').run(JSON.stringify(overrides),now,now,id);db.prepare('INSERT INTO reservation_edits (reservation_id,user_id,overrides_json,created_at) VALUES (?,?,?,?)').run(id,user,JSON.stringify(overrides),now);return output(authorized(user,id));});},
  profile(user,reservationId,input){const reservation=authorized(user,reservationId);const person=db.prepare('SELECT * FROM guests WHERE id=? AND user_id=?').get(reservation.guest_id,user);if(!person)fail('Guest unavailable.',404);
    const url=input.profileUrl?safeExternalUrl(input.profileUrl):null;
    if(url&&input.profileVerifiedManually!==true)fail('Confirm that you have personally verified this profile belongs to the guest.');
    if(url&&(typeof input.profileSource!=='string'||!input.profileSource.trim()||input.profileSource.length>100))fail('Specify the profile source.');
    if(typeof input.notes!=='string'||input.notes.length>4000)fail('Notes must be at most 4,000 characters.');
    return transaction(()=>{const now=new Date().toISOString();const addedAt=url?(url===person.profile_url?person.profile_added_at:now):null;
      db.prepare('UPDATE guests SET profile_url=?,profile_source=?,profile_verified_manually=?,profile_added_at=?,notes=?,updated_at=? WHERE id=?').run(url,url?input.profileSource.trim():null,url?1:0,addedAt,input.notes,now,person.id);
      db.prepare('INSERT INTO guest_profile_edits (guest_id,user_id,profile_json,created_at) VALUES (?,?,?,?)').run(person.id,user,JSON.stringify({profileUrl:url,profileSource:input.profileSource,profileVerifiedManually:!!url,profileAddedAt:addedAt,notes:input.notes}),now);
      return output(authorized(user,reservationId));});
  }
 };
}
