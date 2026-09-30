# Demo preview

Select **Show demo data** in the top app banner, then open Occupancy or Work Log. Select **Exit demo** to restore the real session. No sign-in is needed for the demo. It is session-only, read-only and writes nothing to SQLite or device storage. Reloading returns to real mode. Mileage and receipts retain their existing separate datasets.

`src/demo/createDemoData.ts` implements the supplied generator: four nonoverlapping stays every month from January 2025 through the current local month, rotating fictional guest names/channels and the supplied nightly amount formula. Current-month future stays are included. Turnover work is created only for checkouts on or before today; the monthly hot-tub and supply entries use the same cutoff. Before January 2025 there are no stays or work entries. Invalid input dates are rejected.

`adaptDemoData.ts` adapts the generator to existing app types without changing demo property IDs, converts hours to integer minutes and amounts to cents, and adds explicitly synthetic adult/child/infant/pet counts for the requested preview. Service flags remain unknown. Human totals exclude pets. Guests are separate per reservation; identical names do not merge identities. No contact information or personal profile URLs are fabricated. In demo mode the person icon opens the Facebook homepage with an explicit demo label; real records require a manually verified profile URL.

The context replaces only booking/work data and their related properties in demo mode. Demo mutation and export methods are blocked, with buttons disabled. Real authentication is retained separately while previewing. Navigation remounts when switching modes so unsaved forms and selected records cannot cross between demo and real data. Demo booking revenue is grouped by check-in date for the selected overview period; it uses the supplied total amount, including the fixed $95 component.

Tests cover determinism, January 2025 start, unique IDs, nonoverlapping stays, future-work exclusion, amounts/minutes, calendar mapping and synthetic guest-count reconciliation. At September 28, 2026 the generator produces 84 reservations and 126 work entries.

