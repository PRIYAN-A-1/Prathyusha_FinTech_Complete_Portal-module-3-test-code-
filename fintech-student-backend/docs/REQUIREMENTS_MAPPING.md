# Source and scope mapping

Source: supplied Fintech Innovation Team Portal detailed requirements report, dated 02 October 2026; sections 7, 8, 15–19. Figma file `Lr3p1WlqpWXgVklhNV3f9Z`; shared node `37:422` is the module directory, not the student dashboard screen itself. The directory and actual home screen `2:131` were read through the design connector.

| Source requirement | Backend implementation |
|---|---|
| §7 approved student workspace | Spring membership-gated sessions; Node introspection per request |
| §7.1 own profile, photo, academics, skills, interests, links | `/api/me`, `/api/me/profile`, `/api/me/photo` |
| §7.1 team, project role, mentor, history | Project detail members; dashboard mentor/role fields; own audit history |
| §7.1 public visibility | Private by default; edits revoke publication approval; no private public endpoint |
| §7.2 personal activity counts | Real SQL subqueries, date filters, distinct submitted and verified states |
| §7.3 identifier/membership governance | Profile update allowlist; identifiers/role/status cannot be mass assigned |
| §8 project records, team, milestones, evidence | Relational projects, members, tasks, milestones, contributions, documents |
| §8.2 individual review | Project member-only contribution creation, assigned mentor/admin review, self-review denial |
| §15 Node.js + PostgreSQL + Spring Security | Separate Node business API and JVM Spring authentication; PostgreSQL shared schema |
| §15 private college storage | Authenticated filesystem uploads/downloads; UUID filenames |
| §17 auditability and authorization | Transactional audit actions; role, membership, project ownership and assigned mentor checks |

Figma directory workflow labels map to APIs:

- Student overview → dashboard and activity summary.
- Profile & privacy → profile/photos and publication consent flags.
- Projects & tasks / Project detail → project/team/task/milestone endpoints.
- Contributions / Add contribution → contribution/evidence/review endpoints.
- Weekly history, hackathons, notifications → dashboard reads shared weekly/hackathon tables and notification endpoints.

The home design also includes illustrative learning-module content. A learning/LMS subsystem is not described in the requested PDF student backend scope and has not been invented. The design's sample Priyan/FinFam values and numeric demo counts are not seeded as real data. No frontend or visual-match claim is made: this deliverable is backend source plus the integration contract for the existing design.

Out of scope: public landing implementation, student application/admin approval UI, complete weekly editing/mentor workflow, complete hackathon/event editing, award verification UI, magazine, management PDF/Excel export, and email. Their integration boundaries are documented rather than replaced with fabricated activity.
