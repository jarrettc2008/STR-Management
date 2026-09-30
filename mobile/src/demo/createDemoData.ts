export type Property = { id: string; name: string; location: string };
export type DemoSex = 'female' | 'male' | 'nonbinary' | 'unspecified';
/** On-device demo demographics only — not from cloud/profile scraping. */
export type DemoGuest = {
  name: string;
  profileUrl: string;
  age: number;
  sex: DemoSex;
  homeLocation: string;
};
export type Reservation = {
  id: string;
  propertyId: string;
  guest: string;
  profileUrl: string;
  age: number;
  sex: DemoSex;
  homeLocation: string;
  channel: string;
  start: string;
  end: string;
  amount: number;
};
export type WorkEntry = { id: string; propertyId: string; date: string; activity: string; hours: number };
export type DemoData = { properties: Property[]; reservations: Reservation[]; work: WorkEntry[] };

/** Well-known public Facebook profiles used only for demo person-icon links. */
export const DEMO_GUESTS: DemoGuest[] = [
  { name: 'Mark Zuckerberg', profileUrl: 'https://www.facebook.com/zuck', age: 41, sex: 'male', homeLocation: 'Palo Alto, CA' },
  { name: 'Dwayne Johnson', profileUrl: 'https://www.facebook.com/DwayneJohnson', age: 53, sex: 'male', homeLocation: 'Los Angeles, CA' },
  { name: 'David Beckham', profileUrl: 'https://www.facebook.com/Beckham', age: 50, sex: 'male', homeLocation: 'London, UK' },
  { name: 'Beyoncé', profileUrl: 'https://www.facebook.com/beyonce', age: 44, sex: 'female', homeLocation: 'Houston, TX' },
  { name: 'Arnold Schwarzenegger', profileUrl: 'https://www.facebook.com/arnold', age: 78, sex: 'male', homeLocation: 'Los Angeles, CA' },
  { name: 'Bill Gates', profileUrl: 'https://www.facebook.com/BillGates', age: 70, sex: 'male', homeLocation: 'Medina, WA' },
  { name: 'Taylor Swift', profileUrl: 'https://www.facebook.com/TaylorSwift', age: 36, sex: 'female', homeLocation: 'Nashville, TN' },
  { name: 'Cristiano Ronaldo', profileUrl: 'https://www.facebook.com/Cristiano', age: 41, sex: 'male', homeLocation: 'Riyadh, SA' },
  { name: 'Shakira', profileUrl: 'https://www.facebook.com/shakira', age: 48, sex: 'female', homeLocation: 'Barranquilla, CO' },
  { name: 'Will Smith', profileUrl: 'https://www.facebook.com/WillSmith', age: 57, sex: 'male', homeLocation: 'Los Angeles, CA' },
  { name: 'Ellen DeGeneres', profileUrl: 'https://www.facebook.com/ellentv', age: 67, sex: 'female', homeLocation: 'Montecito, CA' },
  { name: 'Rihanna', profileUrl: 'https://www.facebook.com/rihanna', age: 37, sex: 'female', homeLocation: 'Los Angeles, CA' },
  { name: 'Oprah Winfrey', profileUrl: 'https://www.facebook.com/oprahwinfrey', age: 71, sex: 'female', homeLocation: 'Montecito, CA' },
  { name: 'Tom Hanks', profileUrl: 'https://www.facebook.com/TomHanks', age: 69, sex: 'male', homeLocation: 'Los Angeles, CA' },
  { name: 'Serena Williams', profileUrl: 'https://www.facebook.com/SerenaWilliams', age: 44, sex: 'female', homeLocation: 'Palm Beach, FL' },
  { name: 'Keanu Reeves', profileUrl: 'https://www.facebook.com/KeanuReeves', age: 61, sex: 'male', homeLocation: 'Los Angeles, CA' },
  { name: 'Lady Gaga', profileUrl: 'https://www.facebook.com/ladygaga', age: 39, sex: 'female', homeLocation: 'New York, NY' },
  { name: 'LeBron James', profileUrl: 'https://www.facebook.com/LeBron', age: 41, sex: 'male', homeLocation: 'Los Angeles, CA' },
];

function date(year: number, month: number, day: number): string {
  const value = new Date(year, month, day);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}
export function createDemoData(today: Date): DemoData {
  if (!Number.isFinite(today.getTime())) throw new Error('Choose a valid demo date.');
  const property: Property = { id: 'demo-516-tiger-blvd', name: '516 Tiger Blvd', location: 'Bentonville, AR' };
  const guests = DEMO_GUESTS;
  const reservations: Reservation[] = [], work: WorkEntry[] = [];
  const todayString = date(today.getFullYear(), today.getMonth(), today.getDate());
  const lastMonth = (today.getFullYear() - 2025) * 12 + today.getMonth();
  for (let monthNumber = 0; monthNumber <= lastMonth; monthNumber++) {
    const month = new Date(2025, monthNumber, 1), year = month.getFullYear(), monthIndex = month.getMonth();
    [1, 7, 13, 19, 25].forEach((day, stayIndex) => {
      const nights = [2, 3, 4, 3, 2][(monthNumber + stayIndex) % 5];
      const checkIn = date(year, monthIndex, day), checkout = date(year, monthIndex, day + nights);
      const guest = guests[(monthNumber * 3 + stayIndex) % guests.length];
      reservations.push({
        id: `demo-stay-${monthNumber}-${stayIndex}`,
        propertyId: property.id,
        guest: guest.name,
        profileUrl: guest.profileUrl,
        age: guest.age,
        sex: guest.sex,
        homeLocation: guest.homeLocation,
        channel: (monthNumber + stayIndex) % 3 === 0 ? 'Vrbo' : 'Airbnb',
        start: checkIn,
        end: checkout,
        amount: nights * (175 + (monthNumber % 4) * 15) + 95,
      });
      if (checkout <= todayString) work.push({ id: `demo-turnover-${monthNumber}-${stayIndex}`, propertyId: property.id, date: checkout, activity: stayIndex % 2 === 0 ? 'Turnover cleaning and laundry' : 'Guest checkout, cleaning, and restocking', hours: stayIndex % 2 === 0 ? 3 : 2.5 });
    });
    const inspectionDate = date(year, monthIndex, 12);
    if (inspectionDate <= todayString) work.push({ id: `demo-hot-tub-${monthNumber}`, propertyId: property.id, date: inspectionDate, activity: 'Hot tub cleaning and water check', hours: 1.5 });
    const supplyDate = date(year, monthIndex, 21);
    if (supplyDate <= todayString) work.push({ id: `demo-supplies-${monthNumber}`, propertyId: property.id, date: supplyDate, activity: 'Restock toiletries, snacks, and paper supplies', hours: 1 });
  }
  return { properties: [property], reservations, work };
}
