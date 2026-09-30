BEGIN IMMEDIATE;
CREATE TABLE guests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), source TEXT NOT NULL, connection_id TEXT NOT NULL,
 external_id TEXT, display_name TEXT NOT NULL, email TEXT, phone TEXT,
 profile_url TEXT, profile_source TEXT, profile_verified_manually INTEGER NOT NULL DEFAULT 0,
 profile_added_at TEXT, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(user_id,source,connection_id,external_id)
);
CREATE TABLE reservations (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), property_id TEXT NOT NULL REFERENCES properties(id),
 guest_id TEXT NOT NULL REFERENCES guests(id), source TEXT NOT NULL, connection_id TEXT NOT NULL, external_id TEXT NOT NULL,
 source_json TEXT NOT NULL, overrides_json TEXT NOT NULL DEFAULT '{}', override_updated_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(user_id,source,connection_id,external_id)
);
CREATE INDEX reservation_owner_property ON reservations(user_id,property_id);
CREATE TABLE reservation_imports (
 id INTEGER PRIMARY KEY, reservation_id TEXT NOT NULL REFERENCES reservations(id), source_json TEXT NOT NULL, received_at TEXT NOT NULL
);
CREATE TABLE reservation_edits (
 id INTEGER PRIMARY KEY, reservation_id TEXT NOT NULL REFERENCES reservations(id), user_id TEXT NOT NULL REFERENCES users(id), overrides_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE guest_profile_edits (
 id INTEGER PRIMARY KEY, guest_id TEXT NOT NULL REFERENCES guests(id), user_id TEXT NOT NULL REFERENCES users(id), profile_json TEXT NOT NULL, created_at TEXT NOT NULL
);
PRAGMA user_version=2;
COMMIT;
