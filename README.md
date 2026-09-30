# STR Management

A single-property React Native app (Expo SDK 57 / TypeScript) for 516 Tiger Blvd, Bentonville, Arkansas. Staywell is the working name.

## Run

From `mobile`, run `npm install`, then `npm run web` for the live browser preview or `npm start` for the Expo development server. Installation prepares local English OCR assets in `public/ocr`; rerun `node scripts/prepare-ocr.cjs` if they are missing. No sample receipts or trips are seeded.

## Existing architecture and integration

The original repository contained a single Expo application with dashboard widgets, React Native modals, one hard-coded property, and an AsyncStorage mileage log. It had no backend/API, database, authentication, cloud file storage, financial report service, migration framework, or multi-property selector. The features remain in that same app and reuse its styling, modal flow, storage pattern, and property context.

`src/property.ts` identifies the existing property and a local owner profile. This profile is not an authenticated account. Receipts carry owner/property IDs so a future account-backed service can migrate them without inventing duplicate property models. No account isolation across signed-in users is claimed.

## Mileage

- New manual trips start with today's local date. Focus the date field for a month calendar, or type YYYY-MM-DD.
- Creating a manual trip requests a GPS starting location. Native reverse geocoding attempts an address; coordinates are the fallback. Denied/unavailable GPS leaves manual entry available.
- Start records GPS points; Stop calculates the captured route's estimated distance and saves the trip automatically. Default business purpose is Property visit and can be edited.
- Odometer start and end are manual for every trip. They are never estimated or copied from a previous trip. Blank readings can be added later using History > Edit.
- History order: date, mileage, OD start, OD end, business purpose. Swipe horizontally on a narrow screen.
- Native location sampling requests updates at about 10 seconds / 10 meters, with background delivery allowed to batch for five minutes. Checkpoints are marked every five minutes when fixes are available. OS scheduling, permissions, GPS quality, and app termination can affect delivery; exact timing is not guaranteed.
- The distance filter rejects poor-accuracy fixes, out-of-order points, extreme jumps, and stationary jitter. Gaps longer than two minutes split the drawn route and are excluded from distance instead of inventing a road path. Flagged trips need review.
- Background tracking requires a native development build and background location permissions, not Expo Go. Web tracking only works while the page is running; closing/reloading the browser interrupts recording. An interrupted active trip remains available to Stop and save for review.

### Google Maps setup

Copy `mobile/.env.example` to `.env.local` and configure separate Google Maps keys. Enable Maps SDK for Android/iOS and Maps JavaScript API as appropriate. Restrict native keys to the application identifier and signing certificate; restrict the browser key by HTTP referrer. Add your actual native bundle/package identifiers before making device builds. Google Maps requires a Google Cloud project with applicable billing configuration; none has been created or charged by this work.

Restart Metro after environment changes. Native keys and background permissions require a rebuilt binary. Without keys, the map displays an explicit setup state and GPS can still record locally. No Google Directions or Roads API is used: the polyline represents recorded fixes, not a snapped or inferred road route.

## Receipts and expenses

Open Expenses or Receipt Vault. Capture a phone photo or upload an image/PDF (20 MB maximum). Originals are copied to the app documents directory on native devices; browser originals are retained as Blobs in IndexedDB. Metadata is saved independently in AsyncStorage. Preview/download/share the original from the review screen.

Image OCR uses on-device Apple Vision/Google ML Kit in native development builds and a locally served Tesseract English worker in the browser. Receipt images are not sent to a cloud OCR service. PDFs are preserved and support manual review; automatic PDF transcription is not implemented. HEIC and other image decoding depends on platform support; a failed extraction leaves the original and draft available for manual entry. Native OCR requires rebuilding the app; Expo Go falls back to manual entry with an explanatory message.

Extracted text is parsed conservatively into merchant, receipt date/number, totals, discounts, tax lines, fees, tips, and purchased items. Extraction accuracy varies by receipt layout. Raw OCR and the initial extracted fields remain immutable. The review form edits a separate copy; included/excluded flags preserve personal items for auditing. Each save retains the previous review snapshot.

House Expense and Operating Cost are defined in an extensible type registry. Receipts are associated with the existing property; there is no misleading multi-property selector. Lists start with date then expense type. Drafts never count in financial reports. Reviewed/approved receipts populate dashboard expense totals and reports by time period and expense type. Reports represent recorded expenses, not profit or tax advice.

### Allocation policy

All amounts are parsed directly from decimal strings into integer USD cents. Multiplication/division uses BigInt with half-up rounding. The included item's share of all line totals allocates receipt-wide discounts, combined sales tax, tips, and fees. Eligible subtotal is after its allocated discount. Excluded amount is the verified receipt total minus eligible expense total. A tax override accommodates receipts with differing item tax treatment; it cannot exceed original sales tax.

The review shows original total, excluded amount, eligible subtotal, discount, allocated tax, fees/tips, rounding adjustment, and eligible expense total. Item subtotal mismatches and total mismatches greater than one cent prevent approval; a one-cent receipt rounding difference is displayed and allocated. Item-specific discounts should be reflected in the affected line total and verified unit price, with only receipt-wide discounts in the discount field. Original extracted totals are never rewritten by the allocation function. User confirmation is required before approval.

### Storage versions

- Existing `staywell.mileage.v1` is read on first use if no v2 state exists; the original key is retained.
- `staywell.mileage.v2` stores history and active recording in one document. Serialized writes and the shared stop/history transaction prevent duplicate Stop saves.
- Each receipt uses `staywell.receipt.v1:<id>` with a versioned envelope, original file reference, OCR snapshot, reviewed fields, status, calculated allocation, and review revisions.
- Native original paths are stored relative to the documents directory so app updates do not invalidate the container path. Browser file data lives in `staywell-receipt-files` IndexedDB.
- This is local storage, not a cloud backup. Uninstalling the app or clearing browser storage can remove records. Storage failures surface errors and do not silently reset existing records.

## Validation

From `mobile`: `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npx expo export --platform all`.

The tests cover mileage validation/periods/geometry/GPS gaps, receipt parsing, exact allocation, multiple tax lines, discounts/tips/fees, exclusions, rounding, and draft exclusion from reports. An optional `npm run test:ocr` integration check reads the synthetic `tests/fixtures/receipt.png` fixture; it does not add app data.

JavaScript/Hermes bundles have been validated for web, iOS, and Android. A successful bundle is not a native-device build or a road test. Camera access, native OCR module compilation, Google Maps with real keys, background location behavior, and GPS accuracy still need validation on physical iPhone/Android devices.

# Work Log

The dashboard now includes an authenticated Work Log with SQLite storage, editable time entries, annual reports, and CSV/PDF exports. Start `npm run server` from `mobile` alongside the Expo preview. Create your owner account inside the Work Log widget. See [Work Log setup, architecture, API and verification](mobile/WORK-LOG.md) for the database location, backup steps, native connection setup and remaining deployment limitations. Earlier local-only notes below still apply to mileage and receipts.
