# Work Log implementation and operation

## Integration inspection

The existing app is Expo SDK 57, React Native 0.86, React 19, TypeScript. `src/Dashboard.tsx` contains responsive cream/green cards and mobile modals. Mileage uses AsyncStorage; receipt images use native files or browser IndexedDB, and receipt records use AsyncStorage. Receipt reports total approved expenses in integer cents. No server, ORM, authenticated user model, database, or reusable report exporter existed before this feature. `src/property.ts` supplies the single existing Tiger Boulevard property. `TripDateField` and mileage date helpers are reused. Existing tests use Node's test runner.

Work Log adds a server-backed dataset to this app, separate from financial amounts. It does not migrate existing receipt/mileage data or claim that those local datasets now have account protection. The existing property ID and name are imported for initial owner setup, rather than introducing a second property catalog in the client. SQLite adds durable property access records for server authorization. There is no property-management or worker-management UI yet.

## Run locally

Requires Node 24 (built-in SQLite and TypeScript stripping).

In `mobile`, run `npm run server` and, in another terminal, `npm run web`.
Open `http://localhost:8081`. In the home Work Log widget, create the first owner account using your own email/password (12–128 characters). There is no default account or password. Setup is allowed only on loopback, only before an owner exists, and never with `NODE_ENV=production`. Email is an account identifier; no email is sent or verified.

API defaults to `127.0.0.1:8082`; allowed browser origin is exactly `http://localhost:8081`. Native builds require `EXPO_PUBLIC_WORK_API_URL` set to the reachable HTTPS API origin, then a rebuild/restart. A phone cannot connect to the computer using its own localhost. Deployment, TLS, password recovery, and native-device verification remain follow-up work. Before running a production server, provision the owner locally and set `NODE_ENV=production`.

Server environment: `STR_DATABASE` (absolute database path recommended), `STR_HOST`, `STR_PORT`, `STR_WEB_ORIGIN`. Client environment: `EXPO_PUBLIC_WORK_API_URL` (address only, no secret). Configure the server's timezone to match the property's local work-date policy; the default development server uses the Windows local timezone.

Passwords are salted and hashed with scrypt. Random bearer sessions are stored hashed on the server, expire after 12 hours, and are held only in client memory. Restart/reload requires signing in again. Every CRUD/report query enforces user ownership plus current property access. Login/setup attempts are rate limited. A public multi-user signup flow is deliberately absent.

## Database and retention

Migration `server/migrations/001-work-log.sql` creates users, properties, property_access, sessions and work_logs, with foreign keys, duration constraints, and an owner/date index. Migration version is recorded in SQLite `user_version`. Work Log stores integer minutes, entry mode, optional clock values, property/user IDs, description/category, and creation/update timestamps. The server calculates duration rather than trusting client totals.

Default database: `mobile/server/data/work-log.sqlite`, excluded from Git. Data survives app and server restarts. This is local durable storage, not a cloud backup. For backup, stop the server cleanly and copy the database to a separate protected location; restore while the server is stopped. Keep live SQLite outside cloud-synced folders for production by setting `STR_DATABASE`; syncing a live database/WAL is not a reliable backup strategy. Do not delete this directory or recreate the database during upgrades. Retain backups and annual exports for your accounting workflow.

## Entry and reporting rules

- Today is the local default, editable through the existing calendar or YYYY-MM-DD input. Saving resets date/description; property/type remain convenient for repeated entry.
- Clock inputs use 24-hour HH:MM. End must be after start. Split overnight sessions by date.
- Manual hours convert exactly to whole minutes; values needing rounding are rejected with a correction message. Per-entry duration is 1–1,440 minutes. Descriptions require 5–4,000 characters.
- Multiple sessions per date are supported. Editing preserves the record ID; deleting requires an explicit confirmation in the UI.
- Home shows today/month/year totals for the current property and three recent sessions. `/work-log` has history, date/year/property/type/search filters, edits, deletes, and annual reports.
- Annual reports use year/property/type. History search and date-range filters intentionally do not restrict annual exports. All totals and breakdowns use the same shared report function, with exact minutes shown alongside rounded decimal hours. No dollar value is assigned.
- CSV includes report context, all breakdowns, detail, exact minutes and formula-injection escaping. PDF includes the same data, wraps long comments and paginates. PDF currently supports English text plus normalized smart punctuation; unsupported characters produce an explicit error directing the user to Unicode-preserving CSV. No XLSX framework existed, so no XLSX dependency was introduced.

## Routes and API

Expo Router routes: `/` (existing dashboard) and `/work-log` (full history/report page).

- `GET /api/status`: local setup availability.
- `POST /api/setup`: one-time owner setup, local development only.
- `POST /api/login`, `POST /api/logout`: session lifecycle.
- `GET /api/properties`: authorized existing properties.
- `GET /api/work-logs`: authorized history, optional filters.
- `POST /api/work-logs`: validated creation.
- `PUT /api/work-logs/:id`: authorized update and duration recalculation.
- `DELETE /api/work-logs/:id`: authorized deletion.
- `GET /api/work-report?year=2026&propertyId=...&workType=...&format=csv|pdf`: authorized annual report/export; omit format for JSON.

## Files changed

New: `src/work/domain.ts`, `WorkProvider.tsx`, `WorkUI.tsx`, `WorkWidget.tsx`, `WorkPage.tsx`, `exportFile.ts`, `exportFile.web.ts`; `src/app/_layout.tsx`, `index.tsx`, `work-log.tsx`; `server/server.mjs`, `store.mjs`, `exports.mjs`, `migrations/001-work-log.sql`; `tests/work.test.mjs`; this document.

Updated: `src/Dashboard.tsx`, `src/TripDateField.tsx` (optional label, retains mileage defaults), `index.ts` (Router entry, retains background trip task import), `app.config.ts`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, and root README. Expo Router and its SDK-compatible navigation dependencies were installed with Expo's installer.

## Verification and limitations

`npm test` covers existing receipt/mileage behavior plus editable date defaults, exact durations, input rejection, persistence after reopening SQLite, edits/deletes/multiple daily records, history filters, monthly/year/type/property/detail reconciliation, export totals, formula escaping, unauthenticated requests, and cross-user/property read/write/delete/report denial. Tests use isolated memory/temp databases; no sample records are inserted into the app database.

Required checks: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform all`. The all-platform export generates production web and Hermes bundles; it is not a signed native binary or physical-device test. A generated PDF fixture was rendered and visually inspected separately from user records.

Verification result (September 26, 2026): all 22 tests passed (16 existing, 6 new grouped Work Log tests); TypeScript and ESLint passed; final web/iOS/Android production bundle export passed. The live dashboard's owner setup was visually checked. The signed-in browser flow awaits the user's own account setup; no owner credentials were invented and no sample data was added to their database.

Current limits: API connection required (no offline write queue), single-owner setup, memory-only client sessions, no account recovery or automatic backup, PDF character limits, and no production hosting. Existing receipt/mileage storage remains device-local. Recommended next steps: deploy a protected HTTPS API with scheduled backups, add secure session persistence/recovery, and verify native keyboard/calendar/export behavior on real iOS/Android devices.
