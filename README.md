# STR Management

A small, local-first starting point for managing short-term rental properties. The dashboard combines occupancy, work hours, upcoming turns, and a six-month portfolio snapshot. Add properties, reservations, and work entries in the app; data is saved in this browser with `localStorage`.

## Run locally

1. Install Node.js 20.19+ (or 22.12+).
2. Run `npm install`.
3. Run `npm run dev` and open the URL printed by Vite (usually `http://localhost:5173`).
4. Run `npm run build` to type-check and create a production bundle in `dist/`; `npm run preview` serves that bundle locally.

## Explore the demo

Select **Explore 6-month demo** in the sidebar (or below the mobile navigation). It generates fictional stays and work for the single property at 516 Tiger Blvd, Bentonville, Arkansas, across the current month and the previous five months, including Airbnb/Vrbo stays, stay amounts, turnover work, and inspections. Use the dashboard snapshot or navigate through the occupancy calendar to inspect each month. The demo is labeled throughout; changes in demo mode are temporary and never overwrite your real browser entries. Select **Return to my data** to leave it. Refreshing the tab regenerates the demo.

## First version

- **Dashboard:** property count, booked nights this month, logged hours this month, upcoming checkouts, recent work, and a six-month snapshot of booked nights, stay amount, and work hours.
- **Occupancy:** month navigation, reservations by property, guest, channel, dates, and stay amount. Enter bookings manually; date ranges treat checkout as the first unoccupied day.
- **Work log:** date, property, activity, and either start/end time or total hours. Entries can be removed.
- **Properties:** add properties, view basic status, and remove a property when it has no reservations or work entries.

The app starts empty and has no account or server. Browser data does not sync across devices and can be lost if site storage is cleared. Airbnb/Vrbo imports, cleaner payouts, expense tracking, supplies, demographic reporting, and guest identity review require a future data source and permissions; no data for those features is inferred here. Avoid entering sensitive guest information beyond what is needed to manage a stay.

## Structure

- `src/demo.ts` generates repeatable fictional sample data for the rolling six-month window.
- `src/main.ts` contains the typed data model, local storage, view rendering, and form actions.
- `src/style.css` contains responsive layout and visual styles.
- `index.html` is the Vite entry point.

This is intentionally a single-page, dependency-light foundation. Add a backend and authenticated access before using it as a shared or authoritative operations system.
