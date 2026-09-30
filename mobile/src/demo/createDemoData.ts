export type Property = { id: string; name: string; location: string };
export type Reservation = { id: string; propertyId: string; guest: string; channel: string; start: string; end: string; amount: number };
export type WorkEntry = { id: string; propertyId: string; date: string; activity: string; hours: number };
export type DemoData = { properties: Property[]; reservations: Reservation[]; work: WorkEntry[] };

function date(year: number, month: number, day: number): string {
  const value = new Date(year, month, day);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}
export function createDemoData(today: Date): DemoData {
  if (!Number.isFinite(today.getTime())) throw new Error('Choose a valid demo date.');
  const property: Property = { id: 'demo-516-tiger-blvd', name: '516 Tiger Blvd', location: 'Bentonville, AR' };
  const guests = ['Taylor Morgan', 'Jordan Ellis', 'Casey Brooks', 'Avery Reed', 'Riley Parker', 'Jamie Quinn', 'Sam Carter', 'Alex Rivera', 'Drew Bennett', 'Robin Hayes', 'Morgan Lee', 'Cameron Price'];
  const reservations: Reservation[] = [], work: WorkEntry[] = [];
  const todayString = date(today.getFullYear(), today.getMonth(), today.getDate());
  const lastMonth = (today.getFullYear() - 2025) * 12 + today.getMonth();
  for (let monthNumber = 0; monthNumber <= lastMonth; monthNumber++) {
    const month = new Date(2025, monthNumber, 1), year = month.getFullYear(), monthIndex = month.getMonth();
    [1, 8, 16, 24].forEach((day, stayIndex) => {
      const nights = [3, 4, 5, 3][(monthNumber + stayIndex) % 4];
      const checkIn = date(year, monthIndex, day), checkout = date(year, monthIndex, day + nights);
      reservations.push({ id: `demo-stay-${monthNumber}-${stayIndex}`, propertyId: property.id, guest: guests[(monthNumber * 3 + stayIndex) % guests.length], channel: (monthNumber + stayIndex) % 3 === 0 ? 'Vrbo' : 'Airbnb', start: checkIn, end: checkout, amount: nights * (175 + (monthNumber % 4) * 15) + 95 });
      if (checkout <= todayString) work.push({ id: `demo-turnover-${monthNumber}-${stayIndex}`, propertyId: property.id, date: checkout, activity: stayIndex % 2 === 0 ? 'Turnover cleaning and laundry' : 'Guest checkout, cleaning, and restocking', hours: stayIndex % 2 === 0 ? 3 : 2.5 });
    });
    const inspectionDate = date(year, monthIndex, 12);
    if (inspectionDate <= todayString) work.push({ id: `demo-hot-tub-${monthNumber}`, propertyId: property.id, date: inspectionDate, activity: 'Hot tub cleaning and water check', hours: 1.5 });
    const supplyDate = date(year, monthIndex, 21);
    if (supplyDate <= todayString) work.push({ id: `demo-supplies-${monthNumber}`, propertyId: property.id, date: supplyDate, activity: 'Restock toiletries, snacks, and paper supplies', hours: 1 });
  }
  return { properties: [property], reservations, work };
}
