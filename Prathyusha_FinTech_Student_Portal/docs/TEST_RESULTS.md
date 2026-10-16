# Verification — 16 October 2026

## Result

**16 integration tests passed; 0 failed.** Spring Boot authentication service compiled successfully using Java 17 and Maven 3.9.11. Tests started the actual compiled Spring JAR, exercised HTTP authentication, and called the Express application through Supertest with real bearer sessions.

This environment restricts native PostgreSQL from running under a non-root OS identity. Integration tests therefore used **PGlite (PostgreSQL WASM) with its TCP wire-protocol server**, shared by node-postgres and Spring JDBC. This validates SQL, constraints and the application flow, but does not establish native PostgreSQL concurrency/performance or Docker deployment behavior. Production Compose uses PostgreSQL 17; run the provided default native integration suite and institutional UAT in your deployment environment.

## Checks

- Health, missing authentication and pending account denial.
- Profile editable-field allowlist, stale writes, mandatory versions, consent and publication privacy.
- Protected correction queue, duplicate prevention, admin review.
- Project membership visibility, project review/activation, team assignment.
- Task ownership, invalid transitions, blocked reasons, stale versions.
- Milestones, safe HTTP/HTTPS URLs and access response.
- Contribution task ownership, evidence requirement and locked submissions.
- Mentor recommendation versus coordinator verification; self review denied.
- Idempotent external activity synchronization, exact summary totals and date filters.
- Private file downloads, spoofed file rejection and post-submission evidence lock.
- File-backed evidence submission → mentor revision → student edit → resubmission.
- Migration repeated safely while preserving records.
- Notification ownership and pagination limits.
- Immediate token revocation and suspended member denial.
- Five failed login attempts per email followed by throttling.

## Test output

```text
✔ health, unauthenticated requests and pending membership (6610.172507ms)
✔ profile ownership, strict fields, conflict and privacy approval (140.621896ms)
✔ protected corrections require admin and avoid duplicates (65.221212ms)
✔ project create, hidden access, role and admin status transitions (111.538213ms)
✔ tasks enforce member association and workflow (64.687427ms)
✔ milestones, dates, URL validation and access info (39.09526ms)
✔ contribution creation, evidence requirement, cross-project/task protection (85.908992ms)
✔ reviews distinguish mentor recommendation and admin verification (55.935527ms)
✔ external summaries upsert without double counts and enforce admin permission (136.879192ms)
✔ private uploads reject spoofed files and block direct access (60.939544ms)
✔ private evidence upload, revision and resubmission preserve workflow (122.329758ms)
✔ migration is idempotent and preserves existing records (95.471853ms)
✔ notification ownership and activity pagination (45.968532ms)
✔ review queue enforces mentor assignment and coordinator access (50.988076ms)
✔ revoked and suspended sessions stop access immediately (25.358188ms)
✔ login throttles repeated failures (1497.046543ms)
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 9509.060042
```

## Not verified here

Docker daemon/image builds; native PostgreSQL MVCC/load; pixel-level browser layout; actual college email/reset flows; institutional hosting/HTTPS; malware scanning, backup restore and third-party module synchronization. No live college database or Figma design was modified.
