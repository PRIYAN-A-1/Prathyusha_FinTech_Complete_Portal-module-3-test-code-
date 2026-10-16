# API integration reference

Node base: `http://localhost:4000/api/v1`. Spring base: `http://localhost:8080`.
All protected requests: `Authorization: Bearer TOKEN`. JSON responses: `{ "data": ... }`. Lists have `page` and `limit` where paginated; default 20, max 100. Errors: `{ "error": { "code", "message", "details?", "request_id" } }`.

Versioned writes use **numeric `If-Match: 1`**, matching the resource's `version`. 428 means missing version; 409 means reload the record. Do not blindly retry writes with a guessed version. List pagination is offset-based with a stable tie breaker, but no snapshot is preserved across separate requests.

## Authentication

| Method | Spring path | Body / result |
|---|---|---|
| POST | /auth/login | `{ "email": "student@example.edu", "password": "..." }` → access_token, expires_at, user |
| GET | /auth/me | Current user ID/role/status |
| POST | /auth/logout | Revoke current bearer session |
| POST | /auth/logout-all | Revoke every session for current user |

There is no default password or public admin signup. A shared institutional auth system can replace this service later if its verified identity response is adapted at the Node authentication boundary.

## Student dashboard and personal summary

`GET /me/dashboard`, `/me/activity-summary`, `/me/activity`, `/me/contributions` accept `from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive). The default period is 2000-01-01 through 2100-12-31. UI should send the current academic-term boundaries. Project/task counts represent current assignments regardless of date range, as declared in `definitions`. Dashboard priority always comes from the most recent weekly record dated within the last seven days.

`GET /me/activity-summary/export` returns CSV metric/value pairs. Charts come from `monthly` and `by_work_area` arrays. All counts are computed from stored data. Other-module counts only appear after activity read-model synchronization.

`GET /me/access`: effective role, approval and accessible project assignments. Navigation flags are for UI display; server authorization is enforced independently.

## Profile

`GET /me/profile` includes private own identifiers, editable fields, assignments and version. `PUT /me/profile` requires If-Match and the complete editable object:

```json
{"display_name":"Priyan A","bio":"Building fintech tools","department":"IT","program":"B.Tech","year_of_study":3,"academic_year":"2026-27","skills":["React","Node.js"],"interests":["Financial AI"],"portfolio_links":["https://github.com/example"],"public_consent":false}
```

`POST /me/profile/photo`: multipart field `file`; authenticated private download at `GET /files/:id`. Profile updates with consent true always reset publication to PENDING. Consent false immediately hides the public profile. `GET /me/profile/public-preview` projects allowed fields with consent/publication state.

`GET /public/profiles/:id` is unauthenticated and returns only an approved, consented, active member profile. Email, register number, contact details, evidence, audit and mentor feedback never appear here. Photo is intentionally private; there is no public photo route.

`POST /me/corrections` body `{ "field":"register_number", "requested_value":"NEW_NUMBER", "reason":"Correct a typo" }`. Supported fields: full_name, register_number, email. `GET /me/corrections` lists own requests.

## Projects

`GET /projects[?status=ACTIVE&page=1&limit=20]` returns only assigned member/mentor projects (admins see all). `GET /projects/:id` returns team roles and milestones.

`POST /projects`: creates PROPOSED project and adds caller as Team Lead. `PUT /projects/:id`: same full object plus If-Match, lead/admin only; editing revokes public approval.

```json
{"title":"Expense categorization","domain":"Financial AI","abstract":"Categorize sample expenses","problem_statement":"Inconsistent labels","objectives":"Build and evaluate a classifier","expected_outcome":"Tested prototype","technologies":["Node.js","React"],"repository_url":"https://github.com/example/project","demo_url":null,"start_date":"2026-10-01","target_date":"2026-11-30","risks":"Need category review"}
```

`PUT /projects/:id/members/:userId` body `{ "assigned_role":"Tester" }` (lead/admin; approved students only).

`POST /projects/:id/milestones` body `{ "title":"Prototype demo", "due_date":"2026-11-01" }`.
`PATCH /projects/:id/milestones/:milestoneId` body `{ "status":"COMPLETED" }` (lead/admin; milestone updates are serialized through the project lock; no separate If-Match).

`POST /projects/:id/tasks`:

```json
{"title":"Build validation","description":"Validate forms","due_date":"2026-10-20","assignee_id":"UUID","milestone_id":null}
```

Assignee must be a project member; milestone must belong to that project. `GET /me/tasks` and `GET /projects/:id/tasks` return paginated tasks.

`PATCH /tasks/:id/status`, If-Match required: `{ "status":"BLOCKED", "blocker":"Need mentor category definitions" }`.
Transitions: NOT_STARTED → IN_PROGRESS/BLOCKED; IN_PROGRESS → BLOCKED/SUBMITTED; BLOCKED → IN_PROGRESS; SUBMITTED → IN_PROGRESS/REVIEWED; REVIEWED → IN_PROGRESS/COMPLETED. Only lead/admin can mark reviewed/completed. COMPLETED is terminal.

## Contributions

`POST /contributions` or `PUT /contributions/:id` (PUT requires If-Match). Current student must belong to the project and own any linked task. Owner can edit only DRAFT/REVISION_REQUIRED.

```json
{"project_id":"UUID","task_id":null,"contribution_date":"2026-10-16","work_area":"Coding","description":"Implemented validation routes","outcome":"Invalid inputs rejected","evidence_links":["https://github.com/example/project/commit/abc"]}
```

`POST /contributions/:id/files` uploads multipart `file` while editable. Upload increments contribution version; reload before submitting. `GET /contributions/:id` includes evidence file metadata; only project participants/assigned mentor/admin can inspect it. `GET /me/contributions` lists own records.

`POST /contributions/:id/submit`, If-Match: requires evidence link or uploaded file. DRAFT/REVISION_REQUIRED → SUBMITTED. Submitted records are locked.

`POST /contributions/:id/review`, If-Match:

```json
{"status":"RECOMMENDED","note":"Evidence checked; recommend coordinator verification"}
```

Assigned mentor/admin can move SUBMITTED → UNDER_REVIEW/RECOMMENDED/REVISION_REQUIRED; admin can also VERIFIED. UNDER_REVIEW → RECOMMENDED/REVISION_REQUIRED/VERIFIED. RECOMMENDED → REVISION_REQUIRED/VERIFIED. Self review is blocked; VERIFIED is admin only and terminal. A student cannot overwrite verified claims.

## Coordinator support / integration

These routes support the assigned student module; they are not a complete coordinator frontend or membership module.

- `GET /admin/corrections`: pending queue.
- `POST /admin/corrections/:id/review`: `{ "approve":true,"note":"Institutional record checked" }`.
- `GET /admin/profiles`: pending publication queue.
- `GET /admin/profiles/:id`: full profile for authorized review.
- `POST /admin/profiles/:id/publication`: `{ "approve":true,"version":2,"note":"Public fields checked" }`.
- `POST /admin/projects/:id/review`, If-Match: `{ "status":"APPROVED","mentor_id":"UUID or null","note":"Reviewed","public_approved":false }`.
- Project transitions: PROPOSED → APPROVED/ARCHIVED; APPROVED → ACTIVE/ARCHIVED; ACTIVE → ON_HOLD/COMPLETED/ARCHIVED; ON_HOLD → ACTIVE/ARCHIVED; COMPLETED → ARCHIVED.
- `PUT /admin/integrations/activities/:source/:externalId`:

```json
{"user_id":"UUID","project_id":null,"kind":"WEEKLY_UPDATE","status":"REVISION_REQUIRED","title":"Week of 12 October","plan":"Complete validation","feedback":"Attach tests","occurred_on":"2026-10-12"}
```

Kinds: WEEKLY_UPDATE/HACKATHON/ACHIEVEMENT. Statuses: DRAFT/SUBMITTED/UNDER_REVIEW/REVISION_REQUIRED/VERIFIED/PARTICIPATED (last only hackathon). Integration is trusted admin input from the owning module; it does not independently verify external evidence. Reusing source/externalId updates one record without multiplying counts; student and kind cannot change. Send a revised status to withdraw verification. Deleting external records requires the owning team's retention/withdrawal agreement; this version has no delete endpoint.

## Notifications

`GET /me/notifications`; `PATCH /me/notifications/:id/read` with no body. Foreign notification IDs return 404. Audit events can be read only for the current student via `/me/activity`; project members do not receive another student's private audit trail.

## Limits and file behavior

JSON ≤256 KiB; files ≤5 MiB; HTTP/HTTPS URLs only; arrays capped; unknown fields rejected on editable bodies. File signatures are checked, not just client MIME. File bodies are returned as attachments with nosniff; files are never executed. Add institutional content scanning and quotas at rollout. Single-object ownership violations return 404 where appropriate to hide existence. Version conflicts use 409, missing versions 428, invalid input 422.


`GET /reviews/contributions`: paginated queue of submitted/under-review/recommended records. Assigned mentors see only assigned projects, coordinators see all eligible records; self-review records are excluded and students are denied.
