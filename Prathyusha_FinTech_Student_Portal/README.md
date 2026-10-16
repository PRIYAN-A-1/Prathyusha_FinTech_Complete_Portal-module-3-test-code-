<div align="center">

# 🚀 Prathyusha FinTech — Student Portal
### Enterprise Full-Stack Student Workspace & Academic Contribution System

[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express 5](https://img.shields.io/badge/Express-5.3-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5.7-6DB33F?style=for-the-badge&logo=spring&logoColor=white)](https://spring.io/projects/spring-boot)
[![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vite](https://img.shields.io/badge/Vite-7.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

<p align="center">
  <b>Student Dashboard</b> • <b>Profile & Privacy</b> • <b>Projects & Tasks</b> • <b>Activity Summary</b> • <b>Evidence Verification</b>
</p>

---

</div>

## 📌 Executive Summary

This repository delivers the complete, production-ready full-stack solution for **Priyan's assigned modules**:
- 📊 **Student Dashboard:** Real-time metrics, active projects, next milestone countdown, weekly updates, and unread notifications.
- 👤 **Profile & Privacy:** Profile details, academic year, skills/interests, portfolio links, and privacy consent toggle.
- 📁 **Projects & Tasks:** Propose projects, coordinator approval workflow, member assignment, milestone tracking, and task Kanban boards.
- 📈 **Personal Activity Summary:** Date-filtered activity breakdown, work-area distribution, verified achievements, and CSV export.
- 🛡️ **Contributions & Evidence:** Draft contributions, upload private evidence (PNG/JPEG/PDF up to 5 MiB), and multi-tier verification.

---

## 🏗️ System Architecture & Data Flow

```mermaid
flowchart TB
    subgraph ClientLayer["🖥️ Frontend Tier (Port 5173)"]
        UI["React 19 + TypeScript (Vite)\n• Manrope Font & Figma System\n• Live API Forms & Responsive Layouts"]
    end

    subgraph GatewayProxy["⚡ Reverse Proxy Layer"]
        Proxy["Vite Dev Server / Nginx\n/api/* ➔ Port 4000\n/auth/* ➔ Port 8080"]
    end

    subgraph ServiceLayer["⚙️ Backend Microservices"]
        ExpressAPI["Node.js 24 + Express 5 API (Port 4000)\n• Zod Validation & Route Guards\n• File Upload Gateway (Private Storage)\n• Audit Logging & Relational Queries"]
        SpringAuth["Java 21 + Spring Boot 3.5.7 (Port 8080)\n• Spring Security & BCrypt Verification\n• Secure Random Bearer Sessions\n• Brute-force Throttling"]
    end

    subgraph StorageLayer["💾 Persistence Tier (Port 5432)"]
        Postgres[("PostgreSQL 17 (PGlite Embedded)\n• Relational Schema & Foreign Keys\n• Advisory Locks & Migrations\n• Audit History & Session Hashes")]
        Storage[("📂 Private Filesystem\n• Profile Photos (PNG/JPEG)\n• Evidence Documents (PDF/Images)\n• Non-public Static Storage")]
    end

    UI --> Proxy
    Proxy -->|API Requests| ExpressAPI
    Proxy -->|Auth / Login| SpringAuth
    ExpressAPI -->|Session Introspection /auth/me| SpringAuth
    ExpressAPI -->|Relational Data| Postgres
    ExpressAPI -->|File Writes/Reads| Storage
    SpringAuth -->|Credentials & Sessions| Postgres
```

---

## 🔐 Authentication & Session Handshake

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Student / Faculty
    participant Frontend as 🖥️ React Frontend (5173)
    participant Auth as 🛡️ Spring Boot Auth (8080)
    participant API as 🚀 Express API (4000)
    participant DB as 💾 PostgreSQL (5432)

    User->>Frontend: Enter credentials (email + password)
    Frontend->>Auth: POST /auth/login { email, password }
    Auth->>DB: Query user hash & check membership status
    DB-->>Auth: APPROVED, Hash verified
    Auth->>DB: Store SHA-256 session hash (8h expiry)
    Auth-->>Frontend: HTTP 200 { access_token, user_role, expires_at }
    Note over Frontend: Token kept in memory (never written to localStorage)

    User->>Frontend: Navigate to Dashboard / Projects
    Frontend->>API: GET /api/v1/me/dashboard [Bearer Token]
    API->>Auth: GET /auth/me [Bearer Token]
    Auth-->>API: HTTP 200 { id, role: "STUDENT", status: "APPROVED" }
    API->>DB: Query live counts, active milestones & notifications
    DB-->>API: Computed metrics & active projects
    API-->>Frontend: HTTP 200 { data: { profile, counts, active_work } }
    Frontend-->>User: Render Dashboard UI
```

---

## 🔄 Contribution & Project Lifecycle Workflow

```mermaid
stateDiagram-v2
    [*] --> Proposed: Student Proposes Project
    Proposed --> Approved: Coordinator Approves
    Approved --> Active: Team Activated & Milestones Set
    Active --> OnHold: Blocker Reported
    OnHold --> Active: Issue Resolved
    Active --> Completed: All Milestones Verified
    Completed --> [*]

    state "Contribution Review Workflow" as ContribFlow {
        [*] --> Draft: Student Creates Entry
        Draft --> Submitted: Attached Proof & Submitted
        Submitted --> UnderReview: Mentor Begins Review
        UnderReview --> RevisionRequired: Mentor Requests Changes
        RevisionRequired --> Submitted: Student Re-uploads Evidence
        UnderReview --> Recommended: Mentor Recommends Approval
        Recommended --> Verified: Coordinator Approves & Seals Record
        Verified --> [*]
    }
```

---

## ⚡ Quick Start on Windows

### Option 1: 1-Click Native Runner (Recommended — No Docker Required)

Everything is preconfigured with embedded PostgreSQL and native Spring Boot:

```powershell
# 1. Start all services (Database, Auth, API, Frontend):
.\run-all.ps1
```

```powershell
# 2. Stop all services and free all ports anytime:
.\stop-all.ps1
```

> [!TIP]
> Once launched, open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

### Option 2: Docker Compose

```powershell
# 1. Copy environment template
Copy-Item .env.example .env

# 2. Launch multi-container stack
docker compose up --build -d
```

Open **[http://localhost:8088](http://localhost:8088)** for the Nginx-hosted production bundle.

---

## 👥 Default Seeded Accounts

The development runner automatically sets up three institutional roles:

| Role | Email | Password | Privileges |
|---|---|---|---|
| 🎓 **Student** | `priyan@prathyusha.edu.in` | `Student123!` | Propose projects, update tasks, submit evidence, manage profile |
| 📋 **Coordinator** | `coordinator@prathyusha.edu.in` | `Admin123!` | Approve proposals, verify contributions, manage identity corrections |
| 🧑‍🏫 **Mentor** | `mentor@prathyusha.edu.in` | `Mentor123!` | Review assignments, guide projects, recommend student submissions |

---

## 🌐 Port & Endpoint Directory

| Service | Protocol / Port | Health Check / Probe | Description |
|---|---|---|---|
| **React Web App** | `http://localhost:5173` | Browser ready | Frontend Vite application with reverse proxy |
| **Node Express API** | `http://localhost:4000` | `http://localhost:4000/health/ready` | Core REST APIs (`/api/v1`) |
| **Spring Auth Service** | `http://localhost:8080` | `http://localhost:8080/health` | Spring Security auth provider (`/auth`) |
| **PostgreSQL Database** | `tcp://127.0.0.1:5432` | Socket connection | Relational storage & schema |

---

## 🧪 Terminal Verification Script

You can verify the entire API pipeline directly in PowerShell:

```powershell
# 1. Authenticate and retrieve bearer token
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:5173/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"priyan@prathyusha.edu.in","password":"Student123!"}'

Write-Host "✅ Logged in successfully! Token:" $login.access_token.Substring(0, 12)...

# 2. Query Student Dashboard through the proxy
$headers = @{ Authorization = "Bearer $($login.access_token)" }
$dash = Invoke-RestMethod -Uri "http://localhost:5173/api/v1/me/dashboard" -Headers $headers
$dash.data.profile | Format-List
```

---

## 📊 Feature Comparison Matrix

| Module | Features & Implementation Details |
|---|---|
| **Student Dashboard** | Profile greeting, live counts, active work cards, next incomplete milestone, imported weekly plan/feedback, recent activity, unread notification counter. |
| **Profile & Privacy** | Display name, bio, academics, skills, portfolio links, photo upload, version checks. Consent off by default; explicit coordinator approval required. |
| **Protected Identifiers** | Full name, register number, and email require formal correction requests reviewed and approved by administrators. |
| **Access Control** | Approved membership validation, role guards, project membership verification, file ownership permissions. |
| **Projects & Tasks** | Proposal workflow, coordinator review, assigned lead/mentor roles, milestone tracking, blocker tracking, and task state transitions. |
| **Contributions** | Draft, evidence attachment (PNG/JPEG/PDF), submit, mentor recommendation, coordinator verification. |
| **Summary & Export** | Date-filtered counts, work-area breakdown, submitted vs. verified distinction, CSV export, sync freshness indicator. |

---

## 🧩 External Team Module Integration

Weekly updates, hackathon registrations, and digital magazines remain owned by their respective team members. Data feeds into this student dashboard through an **idempotent admin endpoint**:

```http
PUT /api/v1/admin/integrations/activities/{source}/{externalId}
```

```json
{
  "user_id": "4350c61b-182a-4a2d-b6ef-8ef81b60adc8",
  "project_id": "0d8bb094-d213-4f87-9620-4df1fb834b4f",
  "kind": "HACKATHON",
  "status": "VERIFIED",
  "title": "Smart India Hackathon 2026",
  "occurred_on": "2026-03-15"
}
```

---

## 🛡️ Security & Privacy Guarantees

> [!IMPORTANT]
> **No Fabricated Data or Fake AI Scores:** Dashboard counters and activity metrics are computed strictly from real database records. There is no synthetic LLM score or fabricated summary.

> [!CAUTION]
> **Private Evidence Storage:** Uploaded student files and certificates are stored in a private directory with size and signature validation. They are never exposed as public static folders.

---

## 📂 Project Structure

```
Prathyusha_FinTech_Student_Portal/
├── api/                  # Express 5 REST API source, tests & validation
│   ├── src/              # app.js, db.js, migrate.js, standalone-runner.js
│   └── test/             # 15 automated integration tests
├── auth/                 # Spring Boot 3.5.7 source & Maven pom.xml
├── db/                   # PostgreSQL schema migrations (001_schema.sql)
├── docs/                 # API documentation, Figma mappings & test logs
├── frontend/             # React 19 + TypeScript + Vite web application
│   ├── src/              # Components, pages, routing, state, styles
│   └── dist/             # Production distribution build
├── runtime/              # Compiled fintech-auth-1.0.0.jar & persistent pgdata
├── run-all.ps1           # 1-Click launcher script
└── stop-all.ps1          # 1-Click shutdown script
```

---

<div align="center">
  <sub>Prathyusha Engineering College — FinTech Innovation Team Student Portal</sub>
</div>
