PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS property_access (user_id TEXT NOT NULL REFERENCES users(id), property_id TEXT NOT NULL REFERENCES properties(id), PRIMARY KEY(user_id, property_id));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS work_logs (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), property_id TEXT NOT NULL REFERENCES properties(id),
 work_date TEXT NOT NULL, entry_method TEXT NOT NULL CHECK(entry_method IN ('times','hours')),
 start_time TEXT NOT NULL DEFAULT '', end_time TEXT NOT NULL DEFAULT '',
 minutes_worked INTEGER NOT NULL CHECK(minutes_worked > 0 AND minutes_worked <= 1440),
 work_type TEXT NOT NULL, description TEXT NOT NULL CHECK(length(description) BETWEEN 5 AND 4000),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 FOREIGN KEY(user_id, property_id) REFERENCES property_access(user_id, property_id)
);
CREATE INDEX IF NOT EXISTS work_logs_owner_date ON work_logs(user_id, work_date);
PRAGMA user_version = 1;
