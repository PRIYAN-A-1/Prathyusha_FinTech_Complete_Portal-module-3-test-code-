import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import bcrypt from "bcryptjs";
import request from "supertest";
import { connect } from "../src/db.js";
import { createApp } from "../src/app.js";
let pg,
  pool,
  app,
  temp,
  java,
  logs = "",
  tokens = {},
  project,
  task,
  contribution;
const ids = {
  student: randomUUID(),
  other: randomUUID(),
  admin: randomUUID(),
  mentor: randomUUID(),
  unassigned: randomUUID(),
  pending: randomUUID(),
};
const password = "Test-password-123!";
const authPort = Number(process.env.TEST_AUTH_PORT ?? 18080),
  pgPort = Number(process.env.TEST_PG_PORT ?? 15432);
const jar =
  process.env.AUTH_JAR ??
  new URL("../../auth/target/fintech-auth-1.0.0.jar", import.meta.url).pathname;
const api = (method, url, role = "student") =>
  request(app)
    [method]("/api/v1" + url)
    .set("Authorization", `Bearer ${tokens[role]}`);
const draft = {
  title: "Expense categorization",
  domain: "Financial AI",
  abstract: "Classify sample transactions",
  problem_statement: "Inconsistent labels",
  objectives: "Build a classifier",
  expected_outcome: "Tested prototype",
  technologies: ["Node.js", "React"],
  repository_url: "https://github.com/example/test",
  demo_url: null,
  start_date: "2026-01-01",
  target_date: "2027-01-01",
  risks: "",
};
const profile = {
  display_name: "Priyan",
  bio: "Building fintech",
  department: "IT",
  program: "B.Tech",
  year_of_study: 3,
  academic_year: "2026-27",
  skills: ["React", "Node.js"],
  interests: ["Financial AI"],
  portfolio_links: ["https://example.com"],
  public_consent: true,
};
async function migrate() {
  const child = spawn(
    process.execPath,
    [new URL("../src/migrate.js", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        DATABASE_URL: `postgres://postgres:test-password@127.0.0.1:${pgPort}/postgres`,
      },
    },
  );
  let output = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (output += b));
  const code = await new Promise((r) => child.on("exit", r));
  assert.equal(code, 0, output);
}
before(
  async () => {
    temp = await mkdtemp(path.join(tmpdir(), "fintech-tests-"));
    if (process.env.TEST_DB_MODE === "pglite") {
      const db = await PGlite.create();
      const server = new PGLiteSocketServer({
        db,
        port: pgPort,
        host: "127.0.0.1",
        maxConnections: 30,
      });
      await server.start();
      pg = {
        stop: async () => {
          await server.stop();
          await db.close();
        },
      };
    } else {
      pg = new EmbeddedPostgres({
        databaseDir: path.join(temp, "pg"),
        user: "postgres",
        password: "test-password",
        port: pgPort,
        persistent: false,
        onLog: () => {},
        onError: () => {},
      });
      await pg.initialise();
      await pg.start();
    }
    pool = connect(
      `postgres://postgres:test-password@localhost:${pgPort}/postgres`,
    );
    await migrate();
    const hash = await bcrypt.hash(password, 12);
    for (const [key, id] of Object.entries(ids)) {
      await pool.query(
        "INSERT INTO users(id,email,password_hash,full_name,register_number,role,membership_status) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          `${key}@example.edu`,
          hash,
          key,
          `REG-${key}`,
          ["admin", "mentor", "unassigned"].includes(key)
            ? key === "admin"
              ? "ADMIN"
              : "MENTOR"
            : "STUDENT",
          key === "pending" ? "PENDING" : "APPROVED",
        ],
      );
      await pool.query(
        "INSERT INTO profiles(user_id,display_name) VALUES($1,$2)",
        [id, key],
      );
    }
    java = spawn("java", ["-jar", jar, `--server.port=${authPort}`], {
      env: {
        ...process.env,
        JDBC_URL: `jdbc:postgresql://127.0.0.1:${pgPort}/postgres`,
        DB_USER: "postgres",
        DB_PASSWORD: "test-password",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    java.stdout.on("data", (b) => (logs += b));
    java.stderr.on("data", (b) => (logs += b));
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`http://localhost:${authPort}/health`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(ready, logs);
    for (const key of ["student", "other", "admin", "mentor", "unassigned"]) {
      const r = await fetch(`http://localhost:${authPort}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${key}@example.edu`, password }),
      });
      const loginText = await r.text();
      assert.equal(r.status, 200, logs);
      assert.ok(loginText, logs);
      tokens[key] = JSON.parse(loginText).access_token;
    }
    app = createApp({
      pool,
      authUrl: `http://localhost:${authPort}`,
      uploadDir: path.join(temp, "uploads"),
    });
  },
  { timeout: 60000 },
);
after(async () => {
  if (java) {
    java.kill("SIGTERM");
    await new Promise((r) => {
      if (java.exitCode !== null) return r();
      java.once("exit", r);
    });
  }
  await pool?.end();
  await pg?.stop();
  if (temp) await rm(temp, { recursive: true, force: true });
});
test("health, unauthenticated requests and pending membership", async () => {
  assert.equal((await request(app).get("/health/ready")).status, 200);
  assert.equal((await request(app).get("/api/v1/me/profile")).status, 401);
  const r = await fetch(`http://localhost:${authPort}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "pending@example.edu", password }),
  });
  assert.equal(r.status, 401);
});
test("profile ownership, strict fields, conflict and privacy approval", async () => {
  assert.equal(
    (await api("get", "/me/profile")).body.data.email,
    "student@example.edu",
  );
  assert.equal(
    (
      await api("put", "/me/profile")
        .set("If-Match", "1")
        .send({ ...profile, role: "ADMIN" })
    ).status,
    422,
  );
  assert.equal((await api("put", "/me/profile").send(profile)).status, 428);
  assert.equal(
    (await api("put", "/me/profile").set("If-Match", "1").send(profile)).status,
    200,
  );
  assert.equal(
    (await api("put", "/me/profile").set("If-Match", "1").send(profile)).status,
    409,
  );
  assert.equal(
    (await request(app).get(`/api/v1/public/profiles/${ids.student}`)).status,
    404,
  );
  assert.equal(
    (
      await api(
        "post",
        `/admin/profiles/${ids.student}/publication`,
        "admin",
      ).send({ approve: true, version: 2, note: "Approved public fields" })
    ).status,
    200,
  );
  const publicData = (
    await request(app).get(`/api/v1/public/profiles/${ids.student}`)
  ).body.data;
  assert.equal(publicData.display_name, "Priyan");
  assert.equal(publicData.email, undefined);
  assert.equal(publicData.register_number, undefined);
  assert.equal(
    (
      await api("put", "/me/profile")
        .set("If-Match", "3")
        .send({ ...profile, public_consent: false })
    ).status,
    200,
  );
  assert.equal(
    (await request(app).get(`/api/v1/public/profiles/${ids.student}`)).status,
    404,
  );
});
test("protected corrections require admin and avoid duplicates", async () => {
  const b = {
    field: "register_number",
    requested_value: "REG-CORRECTED",
    reason: "Typo in identifier",
  };
  const a = await api("post", "/me/corrections").send(b);
  assert.equal(a.status, 201);
  assert.equal((await api("post", "/me/corrections").send(b)).status, 409);
  assert.equal(
    (
      await api("post", `/admin/corrections/${a.body.data.id}/review`).send({
        approve: true,
        note: "Verified",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api(
        "post",
        `/admin/corrections/${a.body.data.id}/review`,
        "admin",
      ).send({ approve: true, note: "Verified" })
    ).status,
    200,
  );
  assert.equal(
    (await api("get", "/me/profile")).body.data.register_number,
    "REG-CORRECTED",
  );
});
test("project create, hidden access, role and admin status transitions", async () => {
  let r = await api("post", "/projects").send(draft);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  project = r.body.data;
  assert.equal(
    (await api("get", `/projects/${project.id}`, "other")).status,
    404,
  );
  assert.equal((await api("get", "/projects", "other")).body.data.length, 0);
  assert.equal(
    (
      await api("post", `/admin/projects/${project.id}/review`)
        .set("If-Match", "1")
        .send({ status: "APPROVED", mentor_id: ids.mentor, note: "Approved" })
    ).status,
    403,
  );
  r = await api("post", `/admin/projects/${project.id}/review`, "admin")
    .set("If-Match", "1")
    .send({ status: "APPROVED", mentor_id: ids.mentor, note: "Approved" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await api("post", `/admin/projects/${project.id}/review`, "admin")
    .set("If-Match", "2")
    .send({ status: "ACTIVE", mentor_id: ids.mentor, note: "Begin work" });
  assert.equal(r.status, 200);
  assert.equal(
    (
      await api("put", `/projects/${project.id}/members/${ids.other}`).send({
        assigned_role: "Tester",
      })
    ).status,
    200,
  );
});
test("tasks enforce member association and workflow", async () => {
  let r = await api("post", `/projects/${project.id}/tasks`).send({
    title: "Implement flow",
    description: "Create API",
    due_date: "2027-01-01",
    assignee_id: ids.student,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  task = r.body.data;
  assert.equal(
    (
      await api("patch", `/tasks/${task.id}/status`, "other")
        .set("If-Match", "1")
        .send({ status: "IN_PROGRESS" })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("patch", `/tasks/${task.id}/status`)
        .set("If-Match", "1")
        .send({ status: "COMPLETED" })
    ).status,
    409,
  );
  assert.equal(
    (
      await api("patch", `/tasks/${task.id}/status`)
        .set("If-Match", "1")
        .send({ status: "BLOCKED" })
    ).status,
    422,
  );
  r = await api("patch", `/tasks/${task.id}/status`)
    .set("If-Match", "1")
    .send({ status: "IN_PROGRESS" });
  assert.equal(r.status, 200);
  assert.equal(
    (
      await api("patch", `/tasks/${task.id}/status`)
        .set("If-Match", "1")
        .send({ status: "SUBMITTED" })
    ).status,
    409,
  );
});
test("milestones, dates, URL validation and access info", async () => {
  assert.equal(
    (
      await api("post", `/projects/${project.id}/milestones`).send({
        title: "Demo",
        due_date: "2027-01-01",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await api("post", "/projects").send({
        ...draft,
        repository_url: "javascript:alert(1)",
      })
    ).status,
    422,
  );
  assert.equal(
    (await api("get", "/me/access")).body.data.projects[0].assigned_role,
    "Team Lead",
  );
  assert.equal((await api("get", "/me/tasks")).body.data.length, 1);
});
test("contribution creation, evidence requirement, cross-project/task protection", async () => {
  const b = {
    project_id: project.id,
    task_id: task.id,
    contribution_date: "2026-10-01",
    work_area: "Coding",
    description: "Implemented API validation",
    outcome: "Requests validated",
    evidence_links: [],
  };
  assert.equal(
    (await api("post", "/contributions", "other").send(b)).status,
    422,
  );
  let r = await api("post", "/contributions").send(b);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  contribution = r.body.data;
  assert.equal(
    (
      await api("post", `/contributions/${contribution.id}/submit`).set(
        "If-Match",
        "1",
      )
    ).status,
    422,
  );
  assert.equal(
    (await api("get", `/contributions/${contribution.id}`, "unassigned"))
      .status,
    404,
  );
  r = await api("put", `/contributions/${contribution.id}`)
    .set("If-Match", "1")
    .send({ ...b, evidence_links: ["https://github.com/example/commit/abc"] });
  assert.equal(r.status, 200);
  assert.equal(
    (
      await api("post", `/contributions/${contribution.id}/submit`).set(
        "If-Match",
        "2",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await api("put", `/contributions/${contribution.id}`)
        .set("If-Match", "3")
        .send(b)
    ).status,
    409,
  );
});
test("reviews distinguish mentor recommendation and admin verification", async () => {
  assert.equal(
    (
      await api("post", `/contributions/${contribution.id}/review`)
        .set("If-Match", "3")
        .send({ status: "VERIFIED", note: "Self approve" })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("post", `/contributions/${contribution.id}/review`, "mentor")
        .set("If-Match", "3")
        .send({ status: "VERIFIED", note: "Approve" })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("post", `/contributions/${contribution.id}/review`, "mentor")
        .set("If-Match", "3")
        .send({ status: "RECOMMENDED", note: "Evidence checked" })
    ).status,
    200,
  );
  assert.equal(
    (
      await api("post", `/contributions/${contribution.id}/review`, "admin")
        .set("If-Match", "4")
        .send({ status: "VERIFIED", note: "Verified evidence" })
    ).status,
    200,
  );
});
test("external summaries upsert without double counts and enforce admin permission", async () => {
  const b = {
    user_id: ids.student,
    project_id: project.id,
    kind: "WEEKLY_UPDATE",
    status: "REVISION_REQUIRED",
    title: "Week 1",
    plan: "Finish API",
    feedback: "Add tests",
    occurred_on: new Date().toISOString().slice(0, 10),
  };
  assert.equal(
    (await api("put", "/admin/integrations/activities/weekly/w1").send(b))
      .status,
    403,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await api(
          "put",
          "/admin/integrations/activities/weekly/w1",
          "admin",
        ).send(b)
      ).status,
      200,
    );
  const d = (await api("get", "/me/dashboard")).body.data;
  assert.equal(d.counts.active_projects, 1);
  assert.equal(d.counts.verified_contributions, 1);
  assert.equal(d.counts.submitted_contributions, 0);
  assert.equal(d.counts.updates_needing_revision, 1);
  assert.equal(d.priority.title, "Week 1");
  const summary = (
    await api("get", "/me/activity-summary?from=2026-10-01&to=2026-10-31")
  ).body.data;
  assert.equal(summary.total_contributions, 1);
  assert.equal(summary.verified_contributions, 1);
  assert.equal(
    (await api("get", "/me/activity-summary?from=2026-11-01&to=2026-11-30"))
      .body.data.verified_contributions,
    0,
  );
  assert.equal(
    (await api("get", "/me/activity-summary?from=2027-01-01&to=2026-01-01"))
      .status,
    422,
  );
  assert.match(
    (await api("get", "/me/activity-summary/export")).text,
    /verified_contributions,1/,
  );
});
test("private uploads reject spoofed files and block direct access", async () => {
  const photo = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0]);
  assert.equal(
    (
      await api("post", "/me/profile/photo").attach(
        "file",
        Buffer.from("malicious"),
        "image.png",
      )
    ).status,
    415,
  );
  let r = await api("post", "/me/profile/photo").attach(
    "file",
    photo,
    "photo.png",
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const fid = r.body.data.id;
  assert.equal((await api("get", `/files/${fid}`, "other")).status, 404);
  assert.equal((await api("get", `/files/${fid}`)).status, 200);
  assert.equal(
    (
      await api("post", `/contributions/${contribution.id}/files`).attach(
        "file",
        photo,
        "proof.png",
      )
    ).status,
    409,
  );
});
test("private evidence upload, revision and resubmission preserve workflow", async () => {
  const b = {
    project_id: project.id,
    task_id: null,
    contribution_date: "2026-10-02",
    work_area: "Testing",
    description: "Added edge case tests",
    outcome: "Test report attached",
    evidence_links: [],
  };
  let r = await api("post", "/contributions").send(b);
  assert.equal(r.status, 201);
  const id = r.body.data.id;
  r = await api("post", `/contributions/${id}/files`).attach(
    "file",
    Buffer.from("%PDF-1.7\nTest report"),
    "report.pdf",
  );
  assert.equal(r.status, 201);
  const fileId = r.body.data.id;
  assert.equal(
    (await api("get", `/files/${fileId}`, "unassigned")).status,
    404,
  );
  assert.equal((await api("get", `/files/${fileId}`, "mentor")).status, 200);
  assert.equal(
    (await api("post", `/contributions/${id}/submit`).set("If-Match", "2"))
      .status,
    200,
  );
  assert.equal(
    (
      await api("post", `/contributions/${id}/review`, "mentor")
        .set("If-Match", "3")
        .send({ status: "REVISION_REQUIRED", note: "Explain edge cases" })
    ).status,
    200,
  );
  assert.equal(
    (
      await api("put", `/contributions/${id}`)
        .set("If-Match", "4")
        .send({ ...b, outcome: "Explained the edge cases" })
    ).status,
    200,
  );
  assert.equal(
    (await api("post", `/contributions/${id}/submit`).set("If-Match", "5"))
      .status,
    200,
  );
});
test("migration is idempotent and preserves existing records", async () => {
  await migrate();
  assert.equal(
    (await pool.query("SELECT count(*)::int AS n FROM users")).rows[0].n,
    6,
  );
});
test("notification ownership and activity pagination", async () => {
  const r = await api("get", "/me/notifications");
  assert.ok(r.body.data.length > 0);
  const id = r.body.data[0].id;
  assert.equal(
    (await api("patch", `/me/notifications/${id}/read`, "other")).status,
    404,
  );
  assert.equal(
    (await api("patch", `/me/notifications/${id}/read`)).status,
    200,
  );
  assert.equal((await api("get", "/me/activity?limit=2")).body.data.length, 2);
  assert.equal((await api("get", "/projects?limit=10000")).status, 422);
});
test("review queue enforces mentor assignment and coordinator access", async () => {
  assert.equal((await api("get", "/reviews/contributions")).status, 403);
  assert.ok(
    (await api("get", "/reviews/contributions", "admin")).body.data.length > 0,
  );
  assert.ok(
    (await api("get", "/reviews/contributions", "mentor")).body.data.length > 0,
  );
  assert.equal(
    (await api("get", "/reviews/contributions", "unassigned")).body.data.length,
    0,
  );
});
test("revoked and suspended sessions stop access immediately", async () => {
  const token = tokens.other;
  const logout = await fetch(`http://localhost:${authPort}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(logout.status, 200);
  assert.equal((await api("get", "/me/profile", "other")).status, 401);
  await pool.query(
    "UPDATE users SET membership_status='SUSPENDED' WHERE id=$1",
    [ids.student],
  );
  assert.equal((await api("get", "/me/profile")).status, 401);
});
test("login throttles repeated failures", async () => {
  let last;
  for (let i = 0; i < 6; i++) {
    last = await fetch(`http://localhost:${authPort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unknown@example.edu", password: "wrong" }),
    });
  }
  assert.equal(last.status, 429);
});
