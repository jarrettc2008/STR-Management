import './style.css'

type Property = { id: string; name: string; location: string }
type Reservation = { id: string; propertyId: string; guest: string; channel: string; start: string; end: string; amount: number }
type WorkEntry = { id: string; propertyId: string; date: string; activity: string; hours: number }
type Data = { properties: Property[]; reservations: Reservation[]; work: WorkEntry[] }
type Page = 'dashboard' | 'occupancy' | 'work' | 'properties'

const key = 'str-management:v1'
const today = new Date()
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const parseDate = (value: string) => new Date(`${value}T12:00:00`)
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
const dateLabel = (value: string) => parseDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const id = () => crypto.randomUUID()
function readData(): Data {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}')
    return {
      properties: Array.isArray(raw.properties) ? raw.properties : [],
      reservations: Array.isArray(raw.reservations) ? raw.reservations : [],
      work: Array.isArray(raw.work) ? raw.work : []
    }
  } catch { return { properties: [], reservations: [], work: [] } }
}
let data = readData()
let page: Page = 'dashboard'
let month = new Date(today.getFullYear(), today.getMonth(), 1)
const root = document.querySelector<HTMLDivElement>('#app')!
const save = () => { localStorage.setItem(key, JSON.stringify(data)); render() }
const propertyName = (propertyId: string) => data.properties.find(property => property.id === propertyId)?.name || 'Unknown property'
const propertyOptions = () => data.properties.map(property => `<option value="${escapeHtml(property.id)}">${escapeHtml(property.name)}</option>`).join('')
const emptyProperties = `<div class="empty">Add a property first to start recording stays and work. <button class="text-button" data-page="properties">Add property →</button></div>`
const inRange = (date: string, start: string, end: string) => date >= start && date < end
const nightsInMonth = (reservation: Reservation, start: string, end: string) => Math.max(0, Math.round((Math.min(parseDate(reservation.end).getTime(), parseDate(end).getTime()) - Math.max(parseDate(reservation.start).getTime(), parseDate(start).getTime())) / 86400000))

function dashboard() {
  const start = localDate(new Date(today.getFullYear(), today.getMonth(), 1))
  const end = localDate(new Date(today.getFullYear(), today.getMonth() + 1, 1))
  const nights = data.reservations.reduce((sum, stay) => sum + nightsInMonth(stay, start, end), 0)
  const hours = data.work.filter(entry => entry.date >= start && entry.date < end).reduce((sum, entry) => sum + entry.hours, 0)
  const departures = data.reservations.filter(stay => stay.end >= localDate(today)).sort((a, b) => a.end.localeCompare(b.end)).slice(0, 4)
  const recent = [...data.work].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  return `<div class="hero"><div><p class="eyebrow">YOUR RENTAL OVERVIEW</p><h2>Everything in one place.</h2><p>Keep tabs on stays, property work, and what needs attention next.</p></div><button class="primary" data-page="occupancy">View occupancy →</button></div>
    <div class="stats"><article class="stat"><span>Properties</span><strong>${data.properties.length}</strong><small>In your portfolio</small></article><article class="stat"><span>Booked nights</span><strong>${nights}</strong><small>This month · all properties</small></article><article class="stat"><span>Work logged</span><strong>${hours.toFixed(1)} h</strong><small>This month</small></article></div>
    <div class="columns"><section class="panel"><div class="section-head"><div><p class="eyebrow">COMING UP</p><h3>Upcoming checkouts</h3></div><button class="text-button" data-page="occupancy">Calendar →</button></div>${departures.length ? departures.map(stay => `<div class="list-row"><div><b>${escapeHtml(stay.guest)}</b><small>${escapeHtml(propertyName(stay.propertyId))} · ${escapeHtml(stay.channel)}</small></div><span class="pill">${dateLabel(stay.end)}</span></div>`).join('') : '<p class="muted">No upcoming checkouts yet.</p>'}</section>
    <section class="panel"><div class="section-head"><div><p class="eyebrow">RECENT ACTIVITY</p><h3>Work log</h3></div><button class="text-button" data-page="work">All entries →</button></div>${recent.length ? recent.map(entry => `<div class="list-row"><div><b>${escapeHtml(entry.activity)}</b><small>${escapeHtml(propertyName(entry.propertyId))} · ${dateLabel(entry.date)}</small></div><span class="pill">${entry.hours.toFixed(1)} h</span></div>`).join('') : '<p class="muted">No work logged yet.</p>'}</section></div>`
}
function occupancy() {
  const year = month.getFullYear(), index = month.getMonth()
  const first = new Date(year, index, 1), days = new Date(year, index + 1, 0).getDate()
  const cells = Array.from({ length: first.getDay() }, () => '<div class="day outside"></div>')
  for (let day = 1; day <= days; day++) {
    const date = localDate(new Date(year, index, day))
    const stays = data.reservations.filter(stay => inRange(date, stay.start, stay.end))
    cells.push(`<div class="day ${date === localDate(today) ? 'today' : ''}"><span class="day-number">${day}</span>${stays.map(stay => `<span class="booking" title="${escapeHtml(propertyName(stay.propertyId))}: ${escapeHtml(stay.guest)}">${escapeHtml(propertyName(stay.propertyId))} · ${escapeHtml(stay.guest)}</span>`).join('')}</div>`)
  }
  return `<div class="section-head top"><div><p class="eyebrow">STAYS & REVENUE</p><h2>Occupancy calendar</h2><p class="muted">Booked dates include check-in and exclude checkout.</p></div></div><div class="columns occupancy-layout"><section class="panel calendar-panel"><div class="section-head"><h3>${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3><div class="month-controls"><button aria-label="Previous month" data-month="-1">←</button><button data-month="0">Today</button><button aria-label="Next month" data-month="1">→</button></div></div><div class="calendar"><div class="weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => `<span>${day}</span>`).join('')}</div><div class="days">${cells.join('')}</div></div></section><section class="panel"><p class="eyebrow">NEW BOOKING</p><h3>Add a reservation</h3>${data.properties.length ? `<form id="reservation-form" class="form"><label>Property<select name="propertyId" required>${propertyOptions()}</select></label><label>Guest name<input name="guest" required maxlength="80" placeholder="Guest name" /></label><div class="form-pair"><label>Check-in<input type="date" name="start" required value="${localDate(today)}" /></label><label>Checkout<input type="date" name="end" required /></label></div><div class="form-pair"><label>Channel<select name="channel"><option>Airbnb</option><option>Vrbo</option><option>Direct</option><option>Other</option></select></label><label>Stay amount ($)<input type="number" name="amount" min="0" step="0.01" required placeholder="0.00" /></label></div><button class="primary" type="submit">Add reservation</button></form>` : emptyProperties}</section></div><section class="panel"><div class="section-head"><h3>Reservations</h3><span class="muted">${data.reservations.length} total</span></div>${data.reservations.length ? [...data.reservations].sort((a,b) => a.start.localeCompare(b.start)).map(stay => `<div class="list-row"><div><b>${escapeHtml(stay.guest)}</b><small>${escapeHtml(propertyName(stay.propertyId))} · ${escapeHtml(stay.channel)} · ${dateLabel(stay.start)} – ${dateLabel(stay.end)}</small></div><div class="row-actions"><strong>${money(stay.amount)}</strong><button class="delete" data-delete="reservation" data-id="${escapeHtml(stay.id)}" aria-label="Remove reservation for ${escapeHtml(stay.guest)}">Remove</button></div></div>`).join('') : '<p class="muted">No reservations added yet.</p>'}</section>`
}
function workLog() {
  const entries = [...data.work].sort((a,b) => b.date.localeCompare(a.date))
  return `<div class="section-head top"><div><p class="eyebrow">TIME & TASKS</p><h2>Work log</h2><p class="muted">Record what was done and how long it took.</p></div></div><div class="columns"><section class="panel"><p class="eyebrow">NEW ENTRY</p><h3>Log work</h3>${data.properties.length ? `<form id="work-form" class="form"><label>Property<select name="propertyId" required>${propertyOptions()}</select></label><label>Date<input type="date" name="date" required value="${localDate(today)}" /></label><label>What was done<input name="activity" required maxlength="160" placeholder="Cleaning, maintenance, restocking…" /></label><div class="form-pair"><label>Start time<input type="time" name="start" /></label><label>End time<input type="time" name="end" /></label></div><label>Or total hours<input type="number" name="hours" min="0.1" max="24" step="0.1" placeholder="e.g. 2.5" /></label><p class="hint">Enter start and end time, or total hours. A time range takes priority.</p><button class="primary" type="submit">Save entry</button></form>` : emptyProperties}</section><section class="panel"><div class="section-head"><h3>Entries</h3><span class="muted">${entries.length} total</span></div>${entries.length ? entries.map(entry => `<div class="list-row"><div><b>${escapeHtml(entry.activity)}</b><small>${escapeHtml(propertyName(entry.propertyId))} · ${dateLabel(entry.date)}</small></div><div class="row-actions"><span class="pill">${entry.hours.toFixed(1)} h</span><button class="delete" data-delete="work" data-id="${escapeHtml(entry.id)}" aria-label="Remove work entry">Remove</button></div></div>`).join('') : '<p class="muted">Your work entries will appear here.</p>'}</section></div>`
}
function properties() {
  return `<div class="section-head top"><div><p class="eyebrow">YOUR PORTFOLIO</p><h2>Properties</h2><p class="muted">Set up your rentals to connect stays and work to each place.</p></div></div><div class="columns"><section class="panel"><p class="eyebrow">NEW PROPERTY</p><h3>Add a property</h3><form id="property-form" class="form"><label>Property name<input name="name" required maxlength="80" placeholder="e.g. The Bentonville House" /></label><label>Location<input name="location" maxlength="100" placeholder="City or address (optional)" /></label><button class="primary" type="submit">Add property</button></form></section><section class="panel"><div class="section-head"><h3>Your properties</h3><span class="muted">${data.properties.length} total</span></div>${data.properties.length ? data.properties.map(property => `<div class="list-row"><div><b>${escapeHtml(property.name)}</b><small>${escapeHtml(property.location || 'No location added')} · ${data.reservations.filter(stay => stay.propertyId === property.id).length} stays</small></div><button class="delete" data-delete="property" data-id="${escapeHtml(property.id)}" aria-label="Remove ${escapeHtml(property.name)}">Remove</button></div>`).join('') : '<p class="muted">No properties yet. Add your first one to get started.</p>'}</section></div>`
}
function render() {
  const labels: Record<Page, string> = { dashboard: 'Dashboard', occupancy: 'Occupancy', work: 'Work log', properties: 'Properties' }
  root.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">⌂</span><div><strong>STR Management</strong><small>PROPERTY OPERATIONS</small></div></div><p class="nav-label">WORKSPACE</p><nav aria-label="Main navigation">${(Object.keys(labels) as Page[]).map((item, i) => `<button data-page="${item}" class="nav-item ${page === item ? 'active' : ''}" ${page === item ? 'aria-current="page"' : ''}><span class="nav-icon">${['▦','▤','◷','⌂'][i]}</span>${labels[item]}</button>`).join('')}</nav><div class="sidebar-note"><b>Local workspace</b><p>Your entries are saved in this browser.</p></div></aside><main class="main"><header class="header"><div><span class="mobile-brand">STR Management</span><p class="eyebrow">PROPERTY OPERATIONS</p><h1>${labels[page]}</h1></div><span class="date-badge">${today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span></header><div class="content">${{dashboard, occupancy, work: workLog, properties}[page]()}</div></main></div>`
}
root.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-page], [data-month], [data-delete]')
  if (!target) return
  if (target.dataset.page) { page = target.dataset.page as Page; render(); window.scrollTo(0, 0) }
  if (target.dataset.month) { month = target.dataset.month === '0' ? new Date(today.getFullYear(), today.getMonth(), 1) : new Date(month.getFullYear(), month.getMonth() + Number(target.dataset.month), 1); render() }
  if (target.dataset.delete) {
    const recordId = target.dataset.id!
    if (target.dataset.delete === 'property') {
      if (data.reservations.some(stay => stay.propertyId === recordId) || data.work.some(entry => entry.propertyId === recordId)) { alert('Remove this property’s reservations and work entries first.'); return }
      data.properties = data.properties.filter(item => item.id !== recordId)
    } else if (target.dataset.delete === 'reservation') data.reservations = data.reservations.filter(item => item.id !== recordId)
    else data.work = data.work.filter(item => item.id !== recordId)
    save()
  }
})
root.addEventListener('submit', event => {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  const values = new FormData(form)
  const get = (name: string) => String(values.get(name) || '').trim()
  if (form.id === 'property-form') data.properties.push({ id: id(), name: get('name'), location: get('location') })
  if (form.id === 'reservation-form') {
    const start = get('start'), end = get('end'), propertyId = get('propertyId')
    if (end <= start) { alert('Checkout must be after check-in.'); return }
    if (data.reservations.some(stay => stay.propertyId === propertyId && start < stay.end && end > stay.start)) { alert('These dates overlap an existing reservation for this property.'); return }
    data.reservations.push({ id: id(), propertyId, guest: get('guest'), channel: get('channel'), start, end, amount: Number(get('amount')) })
  }
  if (form.id === 'work-form') {
    const start = get('start'), end = get('end')
    if (Boolean(start) !== Boolean(end)) { alert('Enter both start and end times, or use total hours.'); return }
    const hours = start && end ? (Number(end.slice(0,2))*60 + Number(end.slice(3)) - Number(start.slice(0,2))*60 - Number(start.slice(3))) / 60 : Number(get('hours'))
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) { alert('Enter a valid positive duration up to 24 hours. For overnight work, use total hours.'); return }
    data.work.push({ id: id(), propertyId: get('propertyId'), date: get('date'), activity: get('activity'), hours: Math.round(hours * 100) / 100 })
  }
  save()
})
render()
