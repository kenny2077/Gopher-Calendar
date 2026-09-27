// Minimal Canvas API responses with the fields observed on canvas.umn.edu.

const json = (body, link) => ({
  ok: true, status: 200, url: 'https://canvas.umn.edu/api',
  text: async () => `while(1);${JSON.stringify(body)}`,
  headers: new Map([['link', link || '']]),
});

const FALL = { id: 99, name: '2026 Fall (08/10/2026-01/06/2027)', start_at: '2026-08-11T04:59:00Z', end_at: '2027-01-07T04:59:00Z' };

export const courses = [
  { id: 1001, course_code: 'CSCI 4821 (001)', name: 'CSCI 4821 (001) GenAI for Software Engineering (Fall 2026)', term: FALL, syllabus_body: '' },
  {
    id: 1002, course_code: 'MATH 4242 (010)', name: 'MATH 4242 (010) Applied Linear Algebra (Fall 2026)', term: FALL,
    syllabus_body: '<p>Homework is due every Monday in class.</p><p><a href="/courses/1002/files/777?wrap=1">Syllabus</a></p>',
  },
  { id: 1003, course_code: 'CSCI 2041 (001 & 010)', name: 'Old course', term: { id: 98, name: '2025 Fall', start_at: '2025-08-06T05:00:00Z', end_at: '2026-01-02T05:59:00Z' } },
  { id: 1004, course_code: 'Transition', name: 'Transition', term: { id: 1, name: 'Default Term' } },
];

export const planner = [
  {
    plannable_type: 'assignment', plannable_id: 2001, course_id: 1001,
    context_name: 'CSCI 4821 (001) GenAI for Software Engineering (Fall 2026)', plannable_date: '2026-09-10T16:15:00Z',
    html_url: '/courses/1001/assignments/2001',
    plannable: { title: 'Participation "Introduction"', due_at: '2026-09-10T16:15:00Z', points_possible: 100 },
    submissions: { graded: true, submitted: false, missing: false }, planner_override: { marked_complete: true },
  },
  {
    plannable_type: 'calendar_event', plannable_id: 1, course_id: 1001, context_name: 'CSCI 4821',
    plannable_date: '2026-09-15T16:15:00Z',
    plannable: { title: 'CSCI 4821 Class', start_at: '2026-09-15T16:15:00Z', end_at: '2026-09-15T17:30:00Z', all_day: false },
  },
];

export const planner2 = [
  {
    plannable_type: 'assignment', plannable_id: 600, course_id: 1001, context_name: 'CSCI 4821',
    plannable_date: '2026-10-08T04:59:59Z', html_url: '/courses/1001/assignments/600',
    plannable: { title: 'Development Assignment "Set Up"', due_at: '2026-10-08T04:59:59Z', points_possible: 100 },
    submissions: { submitted: true },
  },
  {
    plannable_type: 'announcement', plannable_id: 2, course_id: 1002, context_name: 'MATH 4242',
    plannable_date: '2026-09-13T03:01:00Z', plannable: { title: 'Office hours moved' },
  },
];

export const mathAssignments = [
  { id: 1, name: 'HW 1', due_at: null, points_possible: 15, submission_types: ['online_text_entry'], published: true },
  { id: 2, name: 'Midterm 1', due_at: null, points_possible: 100, submission_types: ['online_text_entry'], published: true },
  { id: 3, name: 'Quiz 1', due_at: '2026-09-17T14:05:00Z', points_possible: 15, submission_types: ['external_tool'], published: true },
];

const unauthorized = () => ({ ok: false, status: 401, url: 'https://canvas.umn.edu/api', text: async () => '{"status":"unauthorized","errors":[{"message":"user not authorized to perform that action"}]}', headers: new Map() });

const notFound = () => ({ ok: false, status: 404, url: 'https://canvas.umn.edu/api', text: async () => '{"errors":[{"message":"The page could not be found"}]}', headers: new Map() });

export const mathFiles = [
  { id: 778, display_name: 'Math_4242_Syllabus (2).pdf', 'content-type': 'application/pdf', size: 210000, updated_at: '2026-09-01T12:00:00Z', url: 'https://canvas.umn.edu/files/778/download?verifier=b' },
  { id: 777, display_name: 'Syllabus.pdf', 'content-type': 'application/pdf', size: 120000, updated_at: '2026-08-20T12:00:00Z', url: 'https://canvas.umn.edu/files/777/download?verifier=abc' },
  { id: 779, display_name: 'Lecture 3 slides.pdf', 'content-type': 'application/pdf', size: 900000, updated_at: '2026-09-15T12:00:00Z', url: 'x' },
];
export const mathModules = [{ id: 1, items: [
  { title: 'Course Schedule', type: 'Page', page_url: 'course-schedule' },
  { title: 'Course website schedule', type: 'ExternalUrl', external_url: 'https://math.umn.edu/4242/schedule' },
  { title: 'Week 1 notes', type: 'File', content_id: 779 },
] }];

export function canvasRoutes(url) {
  if (url.startsWith('/api/v1/courses?')) return json(courses);
  if (url.startsWith('/api/v1/planner/items')) {
    return json(planner, '<https://canvas.umn.edu/api/v1/planner/items?page=2>; rel="next"');
  }
  if (url.includes('planner/items?page=2')) return json(planner2);
  if (url.startsWith('/api/v1/courses/1001/assignments')) return json([]);
  if (url.startsWith('/api/v1/courses/1002/assignments')) return json(mathAssignments);
  if (url.startsWith('/api/v1/courses/1002/files?')) return json(mathFiles);
  if (url.startsWith('/api/v1/courses/1002/modules')) return json(mathModules);
  if (url.startsWith('/api/v1/courses/1002/pages')) return json([{ title: 'Course Schedule', url: 'course-schedule', updated_at: '2026-09-02T00:00:00Z' }]);
  if (url === '/api/v1/courses/1002/front_page') return notFound();
  if (url === '/api/v1/courses/1001/front_page') {
    return json({ title: 'CSCI 4821 — Fall 2026', url: 'csci-4821-fall-2026', updated_at: '2026-09-01T00:00:00Z',
      body: '<table><tr><td>Wed, Sept. 9</td><td>Intro</td></tr><tr><td>Mon, Sept. 14</td><td>A0 due</td></tr><tr><td>Oct 12</td><td>FP1</td></tr></table>' });
  }
  if (url.startsWith('/api/v1/courses/1001/files')) return unauthorized();
  if (url.startsWith('/api/v1/courses/1001/modules') || url.startsWith('/api/v1/courses/1001/pages')) return json([]);
  throw new Error(`unexpected ${url}`);
}
