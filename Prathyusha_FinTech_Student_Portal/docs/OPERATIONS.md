# Operations

## Health

Node `GET /health/live`: process health. `GET /health/ready`: database query. Spring `GET /health`: database readiness. Auth outage causes protected API requests to return 503, not bypass authorization.

## Backups (Docker Compose)

```bash
docker compose exec -T db pg_dump -U fintech -d fintech -Fc > fintech.dump
```

Also snapshot the `private-uploads` Docker volume while writes are paused. Treat dumps and uploads as private student data. To restore, start a separate empty stack and use `pg_restore -U fintech -d fintech --clean --if-exists`; restore matching upload files and verify a known evidence file as its owner and confirm another student cannot download it. Do not overwrite a live database as a test.

## Session maintenance

Login purges expired sessions. Periodically purge old auth attempts (older than 1 day) and expired sessions through a trusted DB maintenance job. Keep audit records according to college retention policy. Run role/membership changes through the shared identity module and revoke sessions as appropriate.

## Integration ownership

Membership owner creates users + profiles transactionally and stores BCrypt hashes (cost 12). Never permit a student to set role or membership_status. This backend intentionally supplies an offline CLI instead of opening a public registration/approval surface in another student's module.

Weekly/hackathon/achievement owners synchronize their records through the restricted activity upsert after validation/review in their own workflow. `source` + `externalId` is stable; the same ID must not change student or record kind. The current schema restricts assignment to one project per external record. Do not assert verification before coordinator review.

## Before institutional launch

Configure HTTPS, edge auth rate limiting, secret injection, volume backups, disk quotas, campus scanning, log collection, role provisioning, privacy consent policy and college UAT. Docker configuration has not been launched in environments without a Docker daemon; see test evidence for exact verification coverage.
