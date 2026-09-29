# STR Management

A small, local-first starting point for managing short-term rental properties. The dashboard combines occupancy, work hours, and upcoming turns. Add properties, reservations, and work entries in the app; data is saved in this browser with `localStorage`.

## Run locally

1. Install Node.js 20.19+ (or 22.12+).
2. Run `npm install`.
3. Run `npm run dev` and open the URL printed by Vite (usually `http://localhost:5173`).
4. Run `npm run build` to type-check and create a production bundle in `dist/`; `npm run preview` serves that bundle locally.

## First version

- **Dashboard:** property count, booked nights this month, logged hours this month, upcoming checkouts, and recent work.
- **Occupancy:** month navigation, reservations by property, guest, channel, dates, and stay amount. Enter bookings manually; date ranges treat checkout as the first unoccupied day.
- **Work log:** date, property, activity, and either start/end time or total hours. Entries can be removed.
- **Properties:** add properties, view basic status, and remove a property when it has no reservations or work entries.

The app starts empty and has no account or server. Browser data does not sync across devices and can be lost if site storage is cleared. Airbnb/Vrbo imports, cleaner payouts, expense tracking, supplies, demographic reporting, and guest identity review require a future data source and permissions; no data for those features is inferred here. Avoid entering sensitive guest information beyond what is needed to manage a stay.

## Structure

- `src/main.ts` contains the typed data model, local storage, view rendering, and form actions.
- `src/style.css` contains responsive layout and visual styles.
- `index.html` is the Vite entry point.

This is intentionally a single-page, dependency-light foundation. Add a backend and authenticated access before using it as a shared or authoritative operations system.
