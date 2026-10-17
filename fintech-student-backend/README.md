# Prathyusha FinTech — Student Module Backend

Scope: Student Dashboard, Profile & Privacy, Projects & Tasks, Individual Contributions and Personal Activity Summary. Backend source only; connect the existing Figma-based React + TypeScript frontend to these APIs.

## Stack — matches the supplied PDF, section 15

| Layer | Implementation |
|---|---|
| Business API | Node.js, native HTTP server; JavaScript |
| Database | PostgreSQL; SQL migration; `pg` database driver |
| Authentication | Java 17, Spring Boot + Spring Security, BCrypt, database-backed opaque bearer sessions |
| Files | College-managed private filesystem, outside the public web root |
| Notifications | In-portal database records |
| Frontend contract | Existing React + TypeScript design, not rebuilt in this backend delivery |

The PDF specifies Node.js **and** Spring Security. Spring Security runs on the JVM, so it is a separate authentication service, not a Node.js package. Node calls its private introspection endpoint on every protected request. No Express, Firebase, Supabase, MongoDB or alternative authentication platform is used. PostgreSQL is one of the two database choices explicitly permitted by the PDF. No generative AI is needed: “summarization” here means the PDF's Personal Activity Summary, not an LLM-generated score.

## What is implemented

- Approved-member sign-in; BCrypt password verification; 8-hour hashed sessions; revocation on logout/password change; account lockout after five failed logins; local per-IP login throttling.
- Membership rechecked on every API call: suspension invalidates access immediately without waiting for token expiry.
- Own-profile edits with strict field allowlist; academic fields, skills, interests, portfolio, GitHub, photo and privacy. Institutional registration number, role, membership and verification flags cannot be changed by students.
- Profile changes invalidate public publication approval; this backend does not expose private student data publicly.
- Dashboard with projects, team roles, mentor names, own tasks, weekly records, hackathons, notifications and verified achievements.
- Project proposals, lead-owned edits, member assignment, mentor/admin review, tasks and milestones.
- Contribution submission, assigned-mentor/admin review, revision and resubmission; no self verification or editing verified evidence.
- Private evidence uploads (PDF/PNG/JPEG; signature checks; 5 MiB maximum), private photo uploads (2 MiB), authenticated download with reviewer/owner checks.
- Database-derived counts with date range filters; submitted and verified counts remain separate. Active projects and pending-review counts describe current state; period filters apply to dated activity counts.
- Audit records written in the same transactions as important mutations.

## Requirements

Node.js 22+; Java 17+; Maven 3.9+; PostgreSQL 15+; `psql`. Use HTTPS through the college reverse proxy. Services bind to `127.0.0.1`; proxy only `/api/*` and `/auth/*`, never `/internal/*` or the storage directory.

## Setup

1. Copy `.env.example` to `.env`. Replace database passwords and `AUTH_INTERNAL_KEY`. Generate the internal key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Configure the same key for both services.
2. As the PostgreSQL operator, create a dedicated login and database:

```sql
CREATE ROLE fintech LOGIN PASSWORD 'replace-with-a-strong-password';
CREATE DATABASE fintech OWNER fintech;
```

3. Export the environment and migrate an **empty database**, once:

```bash
set -a
. ./.env
set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/001_schema.sql
cd api
npm ci
npm test
cd ../auth
mvn test
mvn package
cd ..
```

PowerShell: the supplied `scripts/Start-Backend.ps1` loads `.env` for startup. For database migration and provisioning, set the variables in `.env` as `$env:DATABASE_URL=...`, `$env:SPRING_DATASOURCE_URL=...`, etc. before running the same `psql`, npm and Maven commands. Spring does not automatically read `.env`; export its variables in the shell.

4. Provision approved accounts using a trusted server operator shell. There is deliberately no public role-selection or auto-approval endpoint in this student module. The separate application/approval module can insert approved identities using the same schema and BCrypt encoding.

```bash
export PROVISION_EMAIL='student@prathyusha.edu.in'
export PROVISION_REGISTER='PEC-IT-001'
export PROVISION_NAME='Student Name'
export PROVISION_ROLE='STUDENT'
read -rs -p 'Initial password (12+ characters): ' PROVISION_PASSWORD
export PROVISION_PASSWORD
java -jar auth/target/fintech-auth-1.0.0.jar --spring.profiles.active=provision
unset PROVISION_PASSWORD
```

Run provisioning when the auth service is stopped (the same port is used), or add `--server.port=0`. Use a separate operator-created ADMIN account for project approval, and MENTOR for assigned reviews. No accounts or default passwords are seeded in the package.

5. Start services in separate terminals, with the exported environment:

```bash
java -jar auth/target/fintech-auth-1.0.0.jar
```

```bash
cd api
npm start
```

On Windows, after migrating and provisioning, `powershell -File scripts/Start-Backend.ps1` loads `.env` and starts both services. It stops its auth child process when the Node process exits. Install API dependencies with `cd api; npm ci` first. The prebuilt auth JAR is included, so Maven is only needed to rebuild it.

`GET http://127.0.0.1:3001/health` checks PostgreSQL connectivity. Login uses port 8080; business APIs use 3001. Set `FRONTEND_ORIGIN` to the exact frontend origin. Do not store the internal service key in React or Vite environment variables.

## Frontend connection

```ts
const login = await fetch('http://localhost:8080/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error('Sign-in failed');
const { access_token } = await login.json();
// Keep the token in application memory; send it as a bearer header.
const response = await fetch('http://localhost:3001/api/me/dashboard', {
  headers: { Authorization: `Bearer ${access_token}` },
});
if (!response.ok) throw new Error('Dashboard unavailable');
const dashboard = await response.json();
```

Use HTTPS URLs in deployment. Never send `X-Internal-Key` from the browser. Never display API text via `dangerouslySetInnerHTML`. See `docs/API.md` and the importable Postman collection.

## Tests and verification

22 automated tests passed during authoring (13 Node + 9 Java), and the executable auth JAR was built.

`cd api && npm test` runs validation and HTTP access-control tests. The latter use isolated auth/database stubs and are **not** proof of a live PostgreSQL + Spring deployment. `npm run check` checks API syntax.

After starting both services against an isolated migrated test database, provision two STUDENT accounts and one ADMIN, set `TEST_STUDENT_EMAIL/PASSWORD`, `TEST_OTHER_EMAIL/PASSWORD`, `TEST_MENTOR_EMAIL/PASSWORD` (the last pair is the ADMIN), and run:

```bash
node scripts/integration.mjs
```

This runs real login, cross-student denial, profile protection, project approval, contribution review/revision, count deltas and revoked-session checks. It retains test records for inspection; never point it at the college production database. See `docs/BUILD_STATUS.md` for what was actually executed in the authoring environment.

## Integration boundaries

The weekly, hackathon, achievement, registration/admin and magazine modules belong to other workstreams. This delivery includes relational integration tables for dashboard reads, not fake records or new write endpoints for those modules. Their owners should use the same tables or agree migrations before combining systems. Until their records exist, related counts correctly return zero. Management PDF/Excel exports and institutional email are other modules in the PDF and are not added to this student backend.

Public-profile publishing, membership/identifier approval and award verification remain admin-owned. Student privacy edits alone never publish a profile. A photo is private until a separate approved publishing pipeline is connected. Files are signature-checked, not antivirus-scanned: connect college malware scanning before allowing uploads from untrusted users in production. No password-reset email flow is claimed; connect the institution's verified reset workflow separately. Do not add an unauthenticated password-reset shortcut.

## Operations

- Apply migrations under source control and back up the database and private storage together. Test restores. See `scripts/backup.sh`.
- Keep PostgreSQL and the auth introspection port private. Give the running database login only required table privileges in institutional deployment; the setup owner account is for initial migration.
- Configure reverse-proxy TLS, bounded request sizes (6 MiB), login rate limits and request logging. Preserve the real client IP only through a trusted proxy. The in-process throttle is per instance and sees proxy IPs if proxied.
- Use persistent college-managed storage, not an ephemeral cloud filesystem. Clean up expired sessions (login already removes them) and orphaned old profile photos under an institutional retention policy.
- File/SQL transactions cannot be atomically committed across a filesystem: ordinary errors remove uploaded bytes; a process crash can leave an orphan file. Backups and retention tooling should account for that.
- Evidence signatures do not guarantee safe content; downloads force attachment and `nosniff`. Do not serve this directory statically.
