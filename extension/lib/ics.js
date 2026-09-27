// iCalendar export for Google Calendar / Apple Calendar import.
// Classes become timed events at their MyU times; deadlines become
// 15-minute events that end at the due time (all-day when no time is known).

import { SYMBOLS } from './classify.js';
import { addDays, chicagoParts, icsLocal } from './time.js';

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:America/Chicago',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT',
  'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST',
  'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n|\r/g, '\\n').replace(/([,;])/g, '\\$1');

// Lines longer than 75 octets are folded with CRLF + space (RFC 5545 §3.1).
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function hhmmFromLabel(label) {
  const m = String(label || '').match(/^(\d{1,2}):(\d{2})(am|pm)$/);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3] === 'pm' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function minus15(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.max(0, h * 60 + m - 15);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function buildIcs(model, { classes = true, deadlines = true, stamp = new Date() } = {}) {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gopher Calendar//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', `X-WR-CALNAME:${esc(model.termName)} · UMN`, 'X-WR-TIMEZONE:America/Chicago', ...VTIMEZONE,
  ];
  const event = fields => lines.push('BEGIN:VEVENT', `DTSTAMP:${dtstamp}`, ...fields, 'END:VEVENT');

  if (classes) {
    for (const m of model.meetings) {
      event([
        `UID:${m.id.replace(/[^\w.-]/g, '-')}@gopher-calendar`,
        `DTSTART;TZID=America/Chicago:${icsLocal(m.date, m.start)}`,
        `DTEND;TZID=America/Chicago:${icsLocal(m.date, m.end)}`,
        `SUMMARY:${esc(`${m.course} ${m.component || 'Class'}`)}`,
        `LOCATION:${esc(m.room)}`,
        `DESCRIPTION:${esc(`${m.course} (${m.section}) ${m.title}`)}`,
        'CATEGORIES:Class',
      ]);
    }
  }

  if (deadlines) {
    for (const d of model.deadlines) {
      // All-day items (no time shown) export as all-day events.
      const hhmm = !d.time ? null : d.dueAt ? (() => { const p = chicagoParts(d.dueAt); return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`; })() : hhmmFromLabel(d.time);
      const when = hhmm
        ? [`DTSTART;TZID=America/Chicago:${icsLocal(d.date, minus15(hhmm))}`, `DTEND;TZID=America/Chicago:${icsLocal(d.date, hhmm)}`]
        : [`DTSTART;VALUE=DATE:${d.date.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${addDays(d.date, 1).replaceAll('-', '')}`];
      const note = [
        d.source === 'syllabus' && !d.confirmed ? 'Date read from the syllabus, not confirmed on Canvas.' : '',
        d.points != null ? `${d.points} pts` : '', d.url || '',
      ].filter(Boolean).join('\n');
      event([
        `UID:${d.id.replace(/[^\w.-]/g, '-')}@gopher-calendar`,
        ...when,
        `SUMMARY:${esc(`${SYMBOLS[d.kind] || ''} ${d.course} · ${d.title}`.trim())}`,
        `DESCRIPTION:${esc(note)}`,
        ...(d.url ? [`URL:${d.url}`] : []),
        'CATEGORIES:Deadline',
        'TRANSP:TRANSPARENT',
      ]);
    }
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
