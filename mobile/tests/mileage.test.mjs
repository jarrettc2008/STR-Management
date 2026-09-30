import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendPoints, decodeTrips, distanceMiles, inPeriod, newDraft, odometerError, routeMiles, routeSegments, today, totalMiles, validateTrip } from '../src/mileage.ts';
const draft = { date: '2025-01-20', origin: 'Office', destination: 'Property', purpose: 'Inspection', miles: '12.25', notes: '' };
test('rejects invalid calendar dates, missing purpose and malformed distance', () => {
  assert.equal(validateTrip(draft), null);
  for (const date of ['2025-02-30', '2025-13-01', '01/20/2025', '2999-01-01']) assert.ok(validateTrip({ ...draft, date }));
  for (const miles of ['0', '-2', 'NaN', '1e2', '12abc', '0.001', '10001']) assert.ok(validateTrip({ ...draft, miles }));
  assert.ok(validateTrip({ ...draft, purpose: '   ' }));
});
test('periods respect month/year boundaries and preserve decimal totals', () => {
  const trips = ['2024-12-31', '2025-01-01', '2025-02-01'].map((date, i) => ({ ...draft, date, id: String(i), miles: 0.1 }));
  assert.equal(inPeriod(trips, 'This month', '2025-01-20').length, 1);
  assert.equal(inPeriod(trips, 'This year', '2025-02-20').length, 2);
  assert.equal(totalMiles(inPeriod(trips, 'All time')), 0.3);
});
test('stored records round-trip and malformed storage is not silently erased', () => {
  const trips = [{ ...draft, id: 'one', miles: 12.25 }];
  assert.deepEqual(decodeTrips(JSON.stringify(trips)), trips);
  assert.deepEqual(decodeTrips(null), []);
  for (const raw of ['invalid', '{}', '[{}]', JSON.stringify([...trips, ...trips])]) assert.throws(() => decodeTrips(raw));
});
test('new trips default to today and odometer readings have consistent order', () => {
  assert.equal(newDraft().date, today());
  assert.equal(odometerError('42500', '42512.5'), null);
  assert.equal(odometerError('0', '0'), null);
  for (const pair of [['100', '99'], ['', '100'], ['-1', '0'], ['abc', '100']]) assert.ok(odometerError(...pair));
});
const p = (longitude, timestamp, accuracy = 5) => ({ latitude: 0, longitude, timestamp, accuracy });
test('GPS route sums the driven path, not only the direct start-to-end distance', () => {
  const points = appendPoints([], [p(0, 1000), p(0.001, 61000), p(0, 121000)]);
  assert.equal(points.length, 3);
  assert.ok(Math.abs(distanceMiles(points[0], points[1]) - 0.06909) < 0.001);
  assert.equal(routeMiles(points), 0.14);
});
test('poor fixes, duplicate fixes, impossible jumps and stationary jitter do not inflate miles', () => {
  const points = appendPoints([], [p(0, 1000), p(0.5, 2000), p(0.00001, 3000), p(0.001, 61000, 500), p(0.001, 61000), p(0.001, 61000)]);
  assert.equal(points.length, 2);
  assert.equal(routeMiles(points), 0.07);
});
test('five-minute checkpoints survive, gaps split the route and do not invent mileage', () => {
  const points = appendPoints([], Array.from({ length: 7 }, (_, i) => p(i * 0.001, 1000 + i * 60000)));
  assert.equal(points.filter(p => p.checkpoint).length, 2);
  const withGap = appendPoints(points, [p(0.1, 1000000)]);
  assert.equal(withGap.at(-1).breakBefore, true);
  assert.equal(routeSegments(withGap).length, 2);
  assert.equal(routeMiles(withGap), routeMiles(points));
  const stationary = appendPoints([], Array.from({ length: 7 }, (_, i) => p(0, 1000 + i * 60000)));
  assert.equal(routeMiles(stationary), 0);
  assert.equal(stationary.filter(p => p.checkpoint).length, 2);
});
test('GPS trips and missing legacy odometers survive serialization', () => {
  const recorded = { ...draft, id: 'gps-test', miles: 0, source: 'gps', reviewNeeded: true, odometerStart: 100, odometerEnd: 100, odometerEndEstimated: true, route: [p(0, 1000)] };
  assert.deepEqual(decodeTrips(JSON.stringify([recorded])), [recorded]);
  assert.throws(() => decodeTrips(JSON.stringify([{ ...recorded, route: [p(181, 1000)] }])));
  assert.throws(() => decodeTrips(JSON.stringify([{ ...recorded, odometerEnd: 90 }])));
});
