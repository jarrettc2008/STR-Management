import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateWork } from '../src/work/domain.ts';
import { CURRENT_PROPERTY } from '../src/property.ts';
import { reservationStore } from './reservations.mjs';

const hash = token => createHash('sha256').update(token).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const entry = r => ({ id: r.id, userId: r.user_id, propertyId: r.property_id, workDate: r.work_date, entryMethod: r.entry_method, startTime: r.start_time, endTime: r.end_time, minutesWorked: r.minutes_worked, workType: r.work_type, description: r.description, createdAt: r.created_at, updatedAt: r.updated_at });
export function openStore(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  if (db.prepare('PRAGMA user_version').get().user_version < 1) db.exec(readFileSync(new URL('./migrations/001-work-log.sql', import.meta.url), 'utf8'));
  if (db.prepare('PRAGMA user_version').get().user_version < 2) db.exec(readFileSync(new URL('./migrations/002-reservations.sql', import.meta.url), 'utf8'));
  const properties = user => db.prepare('SELECT p.id,p.name FROM properties p JOIN property_access a ON p.id=a.property_id WHERE a.user_id=? ORDER BY p.name').all(user);
  const access = (user, property) => { if (!properties(user).some(p => p.id === property)) fail('Property unavailable.', 403); };
  const authorized = (user, id) => { const row = db.prepare('SELECT w.* FROM work_logs w JOIN property_access a ON a.user_id=w.user_id AND a.property_id=w.property_id WHERE w.id=? AND w.user_id=?').get(id, user); if (!row) fail('Work entry not found.', 404); return row; };
  function createUser(email, password, property = CURRENT_PROPERTY) {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 12 || password.length > 128) fail('Use a valid email and a password of 12–128 characters.');
    const id = randomUUID(), salt = randomBytes(16).toString('hex');
    const passwordHash = scryptSync(password, salt, 64).toString('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(id, email.trim().toLowerCase(), passwordHash, salt);
      db.prepare('INSERT OR IGNORE INTO properties VALUES (?,?)').run(property.id, property.name);
      db.prepare('INSERT INTO property_access VALUES (?,?)').run(id, property.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return id;
  }
  return {
    reservations: reservationStore(db),
    db, close: () => db.close(), properties, createUser,
    needsSetup: () => db.prepare('SELECT count(*) AS count FROM users').get().count === 0,
    login(email, password) {
      if (typeof email !== 'string' || typeof password !== 'string' || password.length > 128) fail('Invalid email or password.', 401);
      const row = db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase());
      const candidate = scryptSync(password, row?.salt || 'dummy-salt', 64);
      if (!row || !timingSafeEqual(candidate, Buffer.from(row.password_hash, 'hex'))) fail('Invalid email or password.', 401);
      const token = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token), row.id, Date.now() + 12 * 3600000);
      return { token, userId: row.id, email: row.email };
    },
    authenticate(token) { if (!token) fail('Sign in to Work Log.', 401); const session = db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(hash(token), Date.now()); if (!session) fail('Session expired. Sign in again.', 401); return session.user_id; },
    logout(token) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); },
    list(user, property) { if (property) access(user, property); return db.prepare('SELECT w.* FROM work_logs w JOIN property_access a ON a.user_id=w.user_id AND a.property_id=w.property_id WHERE w.user_id=? ORDER BY work_date DESC,created_at DESC').all(user).map(entry); },
    save(user, draft, id) {
      if (id) authorized(user, id);
      const v = validateWork(draft); access(user, v.propertyId);
      const now = new Date().toISOString();
      if (id) db.prepare('UPDATE work_logs SET property_id=?,work_date=?,entry_method=?,start_time=?,end_time=?,minutes_worked=?,work_type=?,description=?,updated_at=? WHERE id=? AND user_id=?').run(v.propertyId,v.workDate,v.entryMethod,v.startTime,v.endTime,v.minutesWorked,v.workType,v.description,now,id,user);
      else { id = randomUUID(); db.prepare('INSERT INTO work_logs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id,user,v.propertyId,v.workDate,v.entryMethod,v.startTime,v.endTime,v.minutesWorked,v.workType,v.description,now,now); }
      return entry(authorized(user, id));
    },
    remove(user, id) { authorized(user, id); db.prepare('DELETE FROM work_logs WHERE id=? AND user_id=?').run(id,user); },
  };
}
