// University closures and no-class days from the public UMN academic
// calendar (the same feed MyU uses to hide classes on holidays; MyU's
// schedule pages themselves still list those meetings).

export const ACADEMIC_CALENDAR_URL = 'https://academic-calendar.umn.edu/academic_calendar';

const CAMPUS = { UMNTC: 'Twin Cities', UMNDL: 'Duluth', UMNMO: 'Morris', UMNCR: 'Crookston', UMNRO: 'Rochester' };

export function closuresFrom(feed, { institution = 'UMNTC', start, end }) {
  const campus = CAMPUS[institution] || 'Twin Cities';
  const dates = Array.isArray(feed) ? feed : feed?.dates || [];
  const seen = new Set();
  return dates
    .filter(x => x.campus === campus && x.date >= start && x.date <= end
      && (x.categories || []).some(c => c === 'University closed' || c === 'No classes'))
    .map(x => ({
      date: x.date,
      label: String(x.description || 'No classes').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'No classes',
    }))
    .filter(x => !seen.has(x.date) && seen.add(x.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchClosures(range, institution) {
  try {
    const res = await fetch(ACADEMIC_CALENDAR_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    return closuresFrom(await res.json(), { institution, ...range });
  } catch {
    return [];
  }
}
