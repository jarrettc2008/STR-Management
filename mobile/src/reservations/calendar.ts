import { validMonth, type Reservation } from './domain.ts';
const DAY = 86400000;
const stamp = (date: string) => Date.parse(date + 'T00:00:00Z');
export function calendarWeeks(month: string, reservations: Reservation[], propertyId: string) {
  if (!validMonth(month)) throw new Error('Invalid calendar month.');
  const [year, index] = month.split('-').map(Number);
  const first = Date.UTC(year, index - 1, 1), end = Date.UTC(year, index, 1);
  const gridStart = first - new Date(first).getUTCDay() * DAY;
  const count = Math.ceil((end - gridStart) / DAY / 7);
  const bookings = reservations.filter(r => r.source.propertyId === propertyId && r.source.status === 'confirmed');
  return Array.from({ length: count }, (_, week) => {
    const start = gridStart + week * 7 * DAY;
    const dates = Array.from({ length: 7 }, (_, i) => new Date(start + i * DAY).toISOString().slice(0, 10));
    const segments = bookings.map(reservation => ({ reservation, start: Math.max(stamp(reservation.source.checkIn), start, first), end: Math.min(stamp(reservation.source.checkOut), start + 7 * DAY, end) }))
      .filter(s => s.start < s.end).sort((a,b) => a.start - b.start || b.end - a.end || a.reservation.id.localeCompare(b.reservation.id));
    const laneEnds: number[] = [];
    const bars = segments.map(segment => {
      let lane = laneEnds.findIndex(end => end <= segment.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = segment.end;
      return { reservation: segment.reservation, lane, column: (segment.start-start)/DAY, span: (segment.end-segment.start)/DAY, continuesBefore: stamp(segment.reservation.source.checkIn)<segment.start, continuesAfter: stamp(segment.reservation.source.checkOut)>segment.end };
    });
    return { dates, bars, lanes: laneEnds.length };
  });
}
export function shiftMonth(month: string, amount: number) {
  const [year,index] = month.split('-').map(Number);
  return new Date(Date.UTC(year,index-1+amount,1)).toISOString().slice(0,7);
}
