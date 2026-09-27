// Date helpers. Every calendar date is a "key" string YYYY-MM-DD in America/Chicago.
// Key arithmetic runs on UTC noon so it never drifts across DST changes.

export const TZ = 'America/Chicago';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function chicagoParts(when) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(when)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

export const dateKey = when => chicagoParts(when).date;
export const todayKey = () => dateKey(Date.now());

export function clockLabel(hour, minute) {
  const suffix = hour >= 12 ? 'pm' : 'am';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')}${suffix}`;
}

export function timeLabel(when) {
  const { hour, minute } = chicagoParts(when);
  return clockLabel(hour, minute);
}

// "14:30" -> "2:30pm"
export function hhmmLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return clockLabel(h, m);
}

export const keyToDate = key => new Date(`${key}T12:00:00Z`);
export const dateToKey = d => d.toISOString().slice(0, 10);

export function addDays(key, n) {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToKey(d);
}

export const weekday = key => keyToDate(key).getUTCDay(); // 0 = Sunday
export const mondayOf = key => addDays(key, -((weekday(key) + 6) % 7));

export function mondaysBetween(startKey, endKey) {
  const out = [];
  for (let k = mondayOf(startKey); k <= endKey; k = addDays(k, 7)) out.push(k);
  return out;
}

const fmt = opts => new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' });
const shortFmt = fmt({ month: 'short', day: 'numeric' });
const longFmt = fmt({ month: 'short', day: 'numeric', year: 'numeric' });
const monthFmt = fmt({ month: 'short' });
const dowFmt = fmt({ weekday: 'short' });

export const fmtShort = key => shortFmt.format(keyToDate(key));
export const fmtLong = key => longFmt.format(keyToDate(key));
export const fmtMonth = key => monthFmt.format(keyToDate(key));
export const fmtDow = key => dowFmt.format(keyToDate(key));

// "Sep 28 – Oct 4" with the month repeated only when it changes.
export function fmtRange(startKey, endKey) {
  const a = fmtShort(startKey);
  const b = fmtMonth(startKey) === fmtMonth(endKey) ? endKey.slice(8).replace(/^0/, '') : fmtShort(endKey);
  return `${a} – ${b}`;
}

// Convert a Chicago wall-clock date + "HH:MM" into iCalendar local form.
export const icsLocal = (key, hhmm) => `${key.replaceAll('-', '')}T${hhmm.replace(':', '')}00`;

export function relativeAgo(iso, now = Date.now()) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
