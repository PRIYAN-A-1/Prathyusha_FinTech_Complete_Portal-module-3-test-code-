# Figma screen → backend contract

Reference file: https://www.figma.com/design/Lr3p1WlqpWXgVklhNV3f9Z

| Screen / control | Endpoint / behavior |
|---|---|
| 33:54 greeting | GET /me/dashboard → profile.display_name |
| Active projects | counts.active_projects (current membership + ACTIVE state) |
| Submitted contributions | counts.submitted_contributions (currently SUBMITTED, not verified) |
| Verified contributions | counts.verified_contributions |
| Update needs revision | counts.updates_needing_revision, from weekly integration |
| This week's priority | priority.plan + priority.feedback; null if no current record |
| My active work | active_work includes next incomplete milestone |
| Activity history | GET /me/activity, own subject only |
| 33:57 profile details | GET/PUT /me/profile; current version in If-Match |
| Photo | POST /me/profile/photo (multipart file) |
| Mentor/role | profile.assignments; read-only student field |
| Public profile controls | public_consent, publication_status; coordinator approves exact version |
| Public preview | GET /me/profile/public-preview; private identifiers never projected |
| Request correction | POST /me/corrections; admin reviews |
| 33:58 project portfolio | GET /projects; role, mentor, status |
| Task board | GET /me/tasks or /projects/:id/tasks; group by status |
| Project detail 33:59 | GET /projects/:id; description, team, milestones, risks |
| Project changes | PUT /projects/:id; lead/admin, optimistic version |
| Task transitions | PATCH /tasks/:id/status |
| Log contribution | POST /contributions; then attach evidence and submit |
| Insights 52:611 | GET /me/activity-summary: totals, verification, work areas, months |
| Verification distinction | mentor RECOMMENDED, coordinator VERIFIED |
| Notifications | GET /me/notifications; PATCH .../:id/read |

API routes above are relative to `/api/v1`. The frontend implements these screens using shared React components and CSS tokens, and calls the listed APIs. Visual tokens observed: maroon #890c25, dark #351321, cream #faf7f2, gold #e9be72, Manrope. Frontend source owns these tokens, the exact local source logo, Manrope fonts and responsive layout.

All illustrative Figma records are examples; API seed deliberately does not assert these achievements or project counts for real students.
