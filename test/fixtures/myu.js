// Synthetic MyU IScript HTML shaped like the real responses observed on
// 2026-09-26 (class names, data-* attributes, <br>-separated details,
// and the day-number overflow in data-fulldate).

const cls = ({ nbr, date, name, details }) => `
  <div class="myu_calendar-class" data-strm="1269" data-class-nbr="${nbr}" data-fulldate="${date}" data-institution="UMNTC">
    <div class="myu_calendar-class-name"><span class="myu_calendar-class-name-color-referencer">${name.split(' (')[0]}</span> ${name.slice(name.indexOf('('))}</div>
    <div class="myu_calendar-class-details">
${details.join('<br>\n')}
    </div>
  </div>`;

const MATH = { nbr: '10001', name: 'MATH 4242 (010) Applied Linear Algebra', details: ['Lecture', '9:05 - 9:55 AM', ' Hall A 110 '] };
const G = { nbr: '10005', name: 'CSCI 5607 (001) Computer Graphics 1', details: ['Lecture', '2:30 - 3:45 PM', ' Hall D 140 '] };
const GENAI = { nbr: '10003', name: 'CSCI 4821 (001) GenAI for Software Engineering', details: ['Lecture', '11:15 - 12:30 PM', ' Hall C 130 '] };

// Build a week from a Monday "YYYYMMDD" by naive day increments, like MyU.
export function weekHtml(mondayDigits, { skipDays = [] } = {}) {
  const y = mondayDigits.slice(0, 6), d0 = Number(mondayDigits.slice(6));
  const day = i => `${y}${String(d0 + i).padStart(2, '0')}`;
  const plan = [
    [0, MATH], [0, G], [1, GENAI], [2, MATH], [2, G], [3, MATH], [3, GENAI], [4, MATH],
  ].filter(([i]) => !skipDays.includes(i));
  return `<html><head><title>Class Schedule</title></head><body>
  <h2>Week of Classes for the week of${mondayDigits.slice(4, 6)}/${mondayDigits.slice(6)}/${mondayDigits.slice(0, 4)}</h2>
  <div class="myu_calendar"><h3>Classes With Set Days and Times</h3>
  ${plan.map(([i, c]) => cls({ ...c, date: day(i) })).join('\n')}
  <div class="myu_calendar-class no-class" data-fulldate="${day(5)}"></div>
  </div></body></html>`;
}

export const emptyWeekHtml = '<html><head><title>Class Schedule</title></head><body><h2>Week of Classes</h2><p>No classes</p></body></html>';

export function detailHtml(nbr) {
  const rows = {
    10001: [['M-W-F-- 09:05 AM - 09:55 AM', 'Lecturer, A', '09/08/2026 - 12/16/2026', 'Hall A 110'],
      ['---Th--- 09:05 AM - 09:55 AM', 'Assistant, B', '09/08/2026 - 12/16/2026', 'Hall A 110']],
    10005: [['M-W---- 02:30 PM - 03:45 PM', 'Staff', '09/08/2026 - 12/16/2026', 'Hall D 140']],
    10003: [['-T-Th--- 11:15 AM - 12:30 PM', 'Staff', '09/08/2026 - 12/16/2026', 'Hall C 130']],
  }[nbr];
  const tr = r => `<tr><td data-th="Days and Times">${r[0]}</td><td data-th="Instructors">${r[1]}</td><td data-th="Meeting Dates">${r[2]}</td><td data-th="Room">${r[3]}</td></tr>`;
  return `<html><head><title>Class Detail</title></head><body><h3>Meeting Information</h3>
  <table class="myu_panel-table table responsive"><tbody>${rows.map(tr).join('')}</tbody></table>
  <h3>Class Availability</h3><table class="myu_panel-table"><tbody><tr><td>Seats</td></tr></tbody></table></body></html>`;
}
