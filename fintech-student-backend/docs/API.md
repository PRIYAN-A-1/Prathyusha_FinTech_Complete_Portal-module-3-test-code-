# HTTP API contract

JSON requests use `Content-Type: application/json`. Protected requests use `Authorization: Bearer <access_token>`. Lists support `?limit=20&offset=0` (max limit 100); dashboard panels return the latest 10 rows. Dates use `YYYY-MM-DD`, IDs are UUIDs. Unknown/protected input properties are rejected. Auth port: 8080. API port: 3001. Errors: `{ "error": "message", "requestId": "uuid" }` on Node; Spring uses its standard error envelope. HTTP statuses: 400 invalid input, 401 missing/expired session, 403 denied, 404 missing, 409 database/workflow conflict, 413 size limit, 415 unsupported request content type, 503 auth unavailable.

## Authentication

| Method | Path | Body / behaviour |
|---|---|---|
| POST | `/auth/login` | `{email,password}` → `access_token,token_type,expires_in,user` |
| POST | `/auth/logout` | Revokes current bearer session |
| POST | `/auth/password` | `{current_password,new_password}`; new password 12–72 bytes; revokes all sessions |
| GET | `/internal/introspect` | Node-only; bearer plus `X-Internal-Key`; returns `id,role,email` |

No role selector is trusted by the server. The stored role and approved membership determine access. Auth failures do not reveal whether an email exists. Lockout is 15 minutes after five failures; successful login resets counters. Sessions expire after eight hours; there is no refresh-token endpoint. Log in again after expiry.

## Profile, dashboard, activity

| Method | Path | Access / fields |
|---|---|---|
| GET | `/api/me` | Own profile + email, register number, membership |
| PATCH | `/api/me/profile` | `display_name,bio,department,academic_year,skills[],interests[],portfolio_url,github_url,public_visible` |
| POST | `/api/me/photo` | Raw PNG/JPEG body; max 2 MiB; returns document ID |
| GET | `/api/me/photo` | Own photo bytes |
| GET | `/api/me/dashboard` | `summary,projects,tasks,notifications,weekly_updates,achievements,hackathons` |
| GET | `/api/me/activity-summary` | Database counts; optional `from,to` dates |
| GET | `/api/me/history` | Own audit action history |
| GET | `/api/me/notifications` | Own notifications |
| POST | `/api/me/notifications/{id}/read` | Marks own notification read; repeat-safe |

`summary` fields: `active_projects`, `submitted_weekly_updates`, `reported_contributions`, `verified_contributions`, `hackathon_participations`, `verified_achievements`, `pending_contribution_reviews`, `unread_notifications`, `period`, `active_projects_scope`, `notice`. There is no numeric quality score. `weekly_updates` excludes drafts from submitted counts. Participations count PARTICIPATED/VERIFIED, not registrations alone. Achievements require VERIFIED. Pending counts refer to current submitted contribution reviews, not weekly/module-wide reviews.

## Projects, teams, tasks, milestones

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/projects` | Own/mentored projects; admin can see all |
| POST | `/api/projects` | Propose; caller becomes lead and member |
| GET | `/api/projects/{id}` | Authorized details, members, tasks, milestones |
| PATCH | `/api/projects/{id}` | Lead/assigned mentor/admin; descriptive fields only |
| POST | `/api/projects/{id}/members` | Lead/assigned mentor/admin; approved students only |
| POST | `/api/projects/{id}/review` | Assigned mentor/admin; status/review notes; only admin may assign mentor |
| POST | `/api/projects/{id}/tasks` | Lead/assigned mentor/admin creates task for member |
| PATCH | `/api/tasks/{id}` | Assignee changes unreviewed task status |
| POST | `/api/tasks/{id}/review` | Assigned mentor/admin marks submitted task reviewed/completed |
| POST | `/api/projects/{id}/milestones` | Lead/assigned mentor/admin creates milestone |
| PATCH | `/api/milestones/{id}` | Assigned mentor/admin sets `completed` |

Project creation requires `title,domain,abstract,problem_statement,objectives,expected_outcome,start_date,target_date`. Optional: `technology_stack[]`, `repository_url`, `demo_url`. Starts as PROPOSED. `mentor_id`, lead, status and review fields cannot be supplied at creation.

Project PATCH allows `title,abstract,problem_statement,objectives,expected_outcome,repository_url,demo_url,technology_stack,target_date`. Member body: `{user_id,assigned_role}`. Review body: `{status,review_notes,mentor_id?}`; accepted statuses APPROVED, ACTIVE, ON_HOLD, COMPLETED, ARCHIVED. This student scope does not provide membership removal or project deletion.

Task create: `{title,assignee_id,due_date}`. Task PATCH: `{status}` where NOT_STARTED, IN_PROGRESS, BLOCKED, SUBMITTED. Reviewed/completed tasks cannot be edited by assignees. Review: `{status:"REVIEWED"|"COMPLETED"}`. Milestone create: `{title,due_date}`; PATCH `{completed:true}`.

## Contributions and evidence

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/me/contributions` | Own contributions with project titles |
| POST | `/api/me/contributions` | Project member submits own work |
| GET | `/api/projects/{id}/contributions` | Authorized project members/reviewers |
| PATCH | `/api/contributions/{id}` | Owner resubmits REVISION_REQUIRED record |
| POST | `/api/contributions/{id}/review` | Assigned mentor/admin; never self review |
| GET | `/api/contributions/{id}/documents` | Evidence metadata for owner/reviewer |
| POST | `/api/contributions/{id}/documents` | Owner uploads before verification |
| GET | `/api/documents/{id}` | Owner/assigned reviewer; authenticated attachment |

Create: `{project_id,task_id?,contribution_date,work_area,description,outcome,evidence_url?}`. No future contribution date. Optional task must belong to the same project. Creator must be an actual member, not only an admin or mentor.

Review: `{status:"VERIFIED"|"REVISION_REQUIRED",review_notes}`. Resubmission PATCH: `{description,outcome,evidence_url?}`. Reviewer identity/time are cleared on resubmission; previous review action remains in the audit trail. Verified contribution contents are immutable to students.

Upload sends raw bytes, not multipart or Base64 JSON. Set `Content-Type: application/pdf` (or image MIME) and `X-Filename: <URI-encoded-name>`. Header name must have no directory separators/control characters. Type is detected from bytes; permitted PDF/PNG/JPEG; max 5 MiB. The stored name is a server-generated UUID. Evidence is never a public URL. SQL stores metadata; bytes stay in private storage.

```bash
curl -X POST http://localhost:3001/api/contributions/CONTRIBUTION_UUID/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/pdf' -H 'X-Filename: report.pdf' \
  --data-binary @report.pdf
```

## Workflows

1. Operator provisions approved student → student signs in → loads `/api/me/dashboard`.
2. Student proposes project → admin assigns mentor/approves → lead adds approved members → lead assigns tasks.
3. Member submits contribution and evidence → assigned mentor requests revision or verifies → student receives notification → summary counts reflect persisted records.
4. Student changes privacy/profile → publication approval is invalidated; admin-owned publishing workflow must review before any public showcase.
