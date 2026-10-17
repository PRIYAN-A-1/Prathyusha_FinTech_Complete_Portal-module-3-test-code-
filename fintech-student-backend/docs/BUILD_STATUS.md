# Build and verification status

## Executed successfully

- Node.js dependency installation, with committed package-lock.json.
- Node API syntax check (`npm run check`).
- 13 Node tests: field allowlists, URL/date/UUID/pagination/file validation, real local HTTP requests exercising missing authentication, profile privilege escalation denial, cross-student project access denial, CORS origin checks and invalid identifiers. Auth/database are stubbed for HTTP tests.
- Spring Java source compilation and executable JAR packaging with Java 17 and Maven. The runnable JAR is included under `auth/target/`.
- 7 Java/JUnit controller tests: strict bearer parsing, token hashing, internal-key denial, unknown-account denial, suspended membership denial, successful session generation and wrong-password counter updates. JDBC is mocked; these do not execute against PostgreSQL.
- 2 additional Spring Boot HTTP integration tests start the real server and check HTTP 401 for missing internal authorization and empty login password, without a running database. These also verify Spring Security error dispatch preserves the correct status.
- Total: 22 automated tests passed (13 Node + 9 Java).
- Integration-script JavaScript syntax and backup-script Bash syntax.

## Not executed here

- PostgreSQL schema migration against a running database.
- Real Spring + PostgreSQL + Node end-to-end flow. PostgreSQL was unavailable in the authoring environment. The supplied `scripts/integration.mjs` runs this flow after you configure the isolated database and services.
- Institutional reverse-proxy deployment, college storage/backup restore, frontend rendering, or load testing.

This is a backend source implementation with tested validation/access logic, not a claim of a deployed or fully production-verified college portal. No sample activities or fake dashboard totals are presented as live data.
