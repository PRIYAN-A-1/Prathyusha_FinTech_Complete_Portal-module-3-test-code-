# Run the complete student portal

## Easiest: Docker Desktop

1. Copy `.env.example` to `.env` and set a private database password.
2. Run `docker compose up --build -d` from the project root.
3. Create an approved account with the CLI in README.md. Create a separate coordinator account if reviewing projects or publications.
4. Open **http://localhost:8088**.

No fake account or default login password is included. New accounts start with zero activity. To assign someone to a project, they can copy their user ID from **My access**; the project lead enters it in **Team & milestones → Add or update a member**.

## Complete journey

1. Student signs in → Profile → completes academic details and saves.
2. Projects & tasks → Propose project → fills required information.
3. Coordinator signs in → Projects & tasks → opens proposed project → coordinator review → APPROVED → ACTIVE.
4. Lead opens Team & milestones → assigns members and sets milestones.
5. Lead opens Tasks → assigns a task to a member.
6. Member moves task from Not started to In progress, then Submitted. Blocked requires a reason.
7. Contributions → New contribution → enters work/outcome, evidence URL/file → Save draft & open review.
8. Saved contribution → checks evidence → Submit for review.
9. Assigned mentor → Review workspace → reviews contribution, recommends or requests revision.
10. Student revises a revision-required record and resubmits. Coordinator verifies accepted evidence.
11. Activity summary reflects current stored records. Notifications show feedback.

Profile publication follows separate consent + coordinator review. Register number, email and official name remain protected; Request correction routes a change to the coordinator.

## Local development

Run PostgreSQL and backend services as in README.md. `cd frontend`, `npm ci`, `npm run dev`. Website: http://localhost:5173. For a backend on another machine, use frontend/.env.example and configure the backend permitted origin.

The included frontend/dist build requires a web server with API/auth proxies and SPA route fallback. It does not run as a file:// document. Nginx configuration and Dockerfile are supplied.

## Known scope boundaries

The assigned student modules are implemented. Entire college-wide membership onboarding, password reset/email, magazine and hackathon workflows are owned by other modules. UI does not pretend those flows exist; backend integration contracts are documented.
