// Rule-based item typing. The AI polish step may override these, but the
// calendar must be fully usable without it.

export const KINDS = ['exam', 'quiz', 'project', 'milestone', 'assignment', 'participation'];

export const SYMBOLS = {
  assignment: '♦', quiz: '♠', exam: '♣', project: '♥', participation: '●', milestone: '▲',
};

export const KIND_LABELS = {
  assignment: 'assignment', quiz: 'quiz', exam: 'exam',
  project: 'project / presentation', participation: 'participation', milestone: 'report / milestone',
};

// Relative effort used for the purple intensity of a matrix cell.
export const WEIGHTS = {
  assignment: 2.1, quiz: 2.0, exam: 4.2, project: 3.5, participation: 0.8, milestone: 3.0,
};

const RULES = [
  ['exam', /\b(final exam|midterm|exam|examination|test \d)\b/i],
  ['quiz', /\bquiz(zes)?\b/i],
  ['participation', /\b(participation|attendance|check-?in|reading response|poll|survey|consent)\b/i],
  ['project', /\b(project|presentation|tech talk|pitch|proposal|demo|FP\d)\b/i],
  ['milestone', /\b(milestone|beta|peer review|report|evaluation|reflection|deliverable)\b/i],
];

export function classify(title, plannableType) {
  if (plannableType === 'quiz') return /\b(exam|midterm|final)\b/i.test(title) ? 'exam' : 'quiz';
  for (const [kind, re] of RULES) if (re.test(title)) return kind;
  return 'assignment';
}

// 'Participation "LLMs and Agents"' -> 'Participation — LLMs and Agents'
export function cleanTitle(title, courseCode = '') {
  let t = String(title || '').trim();
  if (courseCode) t = t.replace(new RegExp(`^${courseCode.replace(/\s+/g, '\\s*')}\\s*[:\\-–—]?\\s*`, 'i'), '');
  t = t.replace(/^([^"“]+?)\s*["“](.+?)["”]\s*$/, '$1 — $2');
  t = t.replace(/^([A-Za-z][\w\s]*?):\s+/, '$1 — ');
  return t.replace(/\s{2,}/g, ' ');
}

// Canvas calendar events that describe class sessions or office hours belong
// to the class schedule, not the workload view.
export const isSessionEvent = title =>
  /\b(class|lecture|office hours?|OH|discussion section|lab section|recitation|zoom)\b/i.test(title);
