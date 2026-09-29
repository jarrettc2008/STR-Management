type Property = { id: string; name: string; location: string }
type Reservation = { id: string; propertyId: string; guest: string; channel: string; start: string; end: string; amount: number }
type WorkEntry = { id: string; propertyId: string; date: string; activity: string; hours: number }

const date = (year: number, month: number, day: number) => {
  const value = new Date(year, month, day)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

/** Repeatable sample data for the current month and the preceding five months. */
export function createDemoData(today: Date): { properties: Property[]; reservations: Reservation[]; work: WorkEntry[] } {
  const properties = [
    { id: 'demo-cottage', name: 'Bentonville Cottage', location: 'Bentonville, AR' },
    { id: 'demo-retreat', name: 'Ozark Trail Retreat', location: 'Bella Vista, AR' }
  ]
  const guests = ['Taylor Morgan', 'Jordan Ellis', 'Casey Brooks', 'Avery Reed', 'Riley Parker', 'Jamie Quinn', 'Sam Carter', 'Alex Rivera', 'Drew Bennett', 'Robin Hayes', 'Morgan Lee', 'Cameron Price']
  const reservations: Reservation[] = []
  const work: WorkEntry[] = []

  for (let offset = -5; offset <= 0; offset++) {
    const month = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const year = month.getFullYear(), index = month.getMonth(), sequence = offset + 5
    properties.forEach((property, propertyIndex) => {
      const starts = propertyIndex === 0 ? [2, 11, 20] : [5, 14, 23]
      starts.forEach((day, stayIndex) => {
        const length = [3, 4, 5][(sequence + stayIndex + propertyIndex) % 3]
        const start = date(year, index, day)
        const end = date(year, index, day + length)
        // Current-month sample work only reflects dates that have actually passed.
        const guest = guests[(sequence * 2 + stayIndex + propertyIndex * 3) % guests.length]
        reservations.push({
          id: `demo-stay-${sequence}-${propertyIndex}-${stayIndex}`,
          propertyId: property.id, guest,
          channel: (sequence + stayIndex) % 3 === 0 ? 'Vrbo' : 'Airbnb',
          start, end,
          amount: length * (propertyIndex === 0 ? 185 : 230) + 95
        })
        if (end <= date(today.getFullYear(), today.getMonth(), today.getDate())) {
          work.push({
            id: `demo-turn-${sequence}-${propertyIndex}-${stayIndex}`,
            propertyId: property.id, date: end,
            activity: stayIndex === 1 ? 'Turnover cleaning and restocking' : 'Guest checkout and property reset',
            hours: propertyIndex === 0 ? 2.5 : 3.5
          })
        }
      })
      const inspection = date(year, index, 8)
      if (inspection <= date(today.getFullYear(), today.getMonth(), today.getDate())) {
        work.push({ id: `demo-inspection-${sequence}-${propertyIndex}`, propertyId: property.id,
          date: inspection, activity: 'Hot tub and supplies check', hours: 1.5 })
      }
    })
  }
  return { properties, reservations, work }
}
