type Property = { id: string; name: string; location: string }
type Reservation = { id: string; propertyId: string; guest: string; channel: string; start: string; end: string; amount: number }
type WorkEntry = { id: string; propertyId: string; date: string; activity: string; hours: number }

const date = (year: number, month: number, day: number) => {
  const value = new Date(year, month, day)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

/** Repeatable sample data from January 1, 2025 through the current month. */
export function createDemoData(today: Date): { properties: Property[]; reservations: Reservation[]; work: WorkEntry[] } {
  const property = { id: 'demo-tiger-blvd', name: '516 Tiger Blvd', location: 'Bentonville, AR' }
  const properties = [property]
  const guests = ['Taylor Morgan', 'Jordan Ellis', 'Casey Brooks', 'Avery Reed', 'Riley Parker', 'Jamie Quinn', 'Sam Carter', 'Alex Rivera', 'Drew Bennett', 'Robin Hayes', 'Morgan Lee', 'Cameron Price']
  const reservations: Reservation[] = []
  const work: WorkEntry[] = []

  const currentMonth = (today.getFullYear() - 2025) * 12 + today.getMonth()
  for (let sequence = 0; sequence <= currentMonth; sequence++) {
    const month = new Date(2025, sequence, 1)
    const year = month.getFullYear(), index = month.getMonth()
    const starts = [1, 11, 20]
    starts.forEach((day, stayIndex) => {
        const length = [3, 4, 5][(sequence + stayIndex) % 3]
        const start = date(year, index, day)
        const end = date(year, index, day + length)
        // Current-month sample work only reflects dates that have actually passed.
        const guest = guests[(sequence * 2 + stayIndex) % guests.length]
        reservations.push({
          id: `demo-stay-${sequence}-${stayIndex}`,
          propertyId: property.id, guest,
          channel: (sequence + stayIndex) % 3 === 0 ? 'Vrbo' : 'Airbnb',
          start, end,
          amount: length * 185 + 95
        })
        if (end <= date(today.getFullYear(), today.getMonth(), today.getDate())) {
          work.push({
            id: `demo-turn-${sequence}-${stayIndex}`,
            propertyId: property.id, date: end,
            activity: stayIndex === 1 ? 'Turnover cleaning and restocking' : 'Guest checkout and property reset',
            hours: 2.5
          })
        }
    })
    const inspection = date(year, index, 8)
    if (inspection <= date(today.getFullYear(), today.getMonth(), today.getDate())) {
      work.push({ id: `demo-inspection-${sequence}`, propertyId: property.id,
        date: inspection, activity: 'Hot tub and supplies check', hours: 1.5 })
    }
  }
  return { properties, reservations, work }
}
