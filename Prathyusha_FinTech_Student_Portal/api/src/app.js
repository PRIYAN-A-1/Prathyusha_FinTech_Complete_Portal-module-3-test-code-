import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import * as v from "./validation.js";
import { transaction } from "./db.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (code, message) => {
  throw new HttpError(code, message);
};
const admin = (u) => ["ADMIN", "SUPER_ADMIN"].includes(u.role);
const one = async (c, sql, args = []) => (await c.query(sql, args)).rows[0];
const rows = async (c, sql, args = []) => (await c.query(sql, args)).rows;
const json = JSON.stringify;
function version(req) {
  const n = Number(req.get("If-Match"));
  if (!Number.isInteger(n) || n < 1)
    fail(428, "Supply current numeric version in If-Match");
  return n;
}
function paged(req) {
  const p = v.page.parse(req.query);
  return { ...p, offset: (p.page - 1) * p.limit };
}
async function audit(c, u, subject, action, type, id, details = {}) {
  await c.query(
    "INSERT INTO audit_logs(id,actor_id,subject_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [randomUUID(), u.id, subject, action, type, id, json(details)],
  );
}
async function notify(c, user, message, type, id) {
  await c.query(
    "INSERT INTO notifications(id,user_id,message,target_type,target_id) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), user, message, type, id],
  );
}
async function projectAccess(c, u, id, { write = false, lock = false } = {}) {
  const p = await one(
    c,
    `SELECT * FROM projects WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
    [v.id.parse(id)],
  );
  if (!p) fail(404, "Project not found");
  const member = await one(
    c,
    "SELECT * FROM project_members WHERE project_id=$1 AND user_id=$2",
    [id, u.id],
  );
  if (!admin(u) && p.mentor_id !== u.id && !member)
    fail(404, "Project not found");
  if (write && !admin(u) && p.lead_id !== u.id)
    fail(403, "Project lead or admin required");
  return p;
}
async function contributionAccess(c, u, id, lock = false) {
  const item = await one(
    c,
    `SELECT * FROM contributions WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
    [v.id.parse(id)],
  );
  if (!item) fail(404, "Contribution not found");
  await projectAccess(c, u, item.project_id);
  return item;
}
export function createApp({
  pool,
  authUrl,
  uploadDir,
  allowedOrigin = "http://localhost:5173",
  authenticate,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigin,
      allowedHeaders: ["Authorization", "Content-Type", "If-Match"],
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    req.requestId = randomUUID();
    res.set("X-Request-Id", req.requestId);
    next();
  });
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.get("/health/live", (req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", async (req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  });
  app.get("/api/v1/public/profiles/:id", async (req, res) => {
    const p = await one(
      pool,
      `SELECT p.display_name,p.bio,p.department,p.program,p.year_of_study,p.skills,p.interests,p.portfolio_links FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1 AND p.public_consent=true AND p.publication_status='APPROVED' AND u.membership_status='APPROVED'`,
      [v.id.parse(req.params.id)],
    );
    if (!p) fail(404, "Profile not published");
    res.json({ data: p });
  });
  app.use("/api/v1", async (req, res, next) => {
    const token = req.get("authorization");
    if (!token?.startsWith("Bearer ")) fail(401, "Bearer token required");
    let identity;
    if (authenticate) identity = await authenticate(token);
    else {
      let response;
      try {
        response = await fetch(`${authUrl}/auth/me`, {
          headers: { Authorization: token },
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        fail(503, "Authentication service unavailable");
      }
      if (response.status === 401 || response.status === 403)
        fail(401, "Invalid or expired session");
      if (!response.ok) fail(503, "Authentication service unavailable");
      identity = await response.json();
    }
    const user = await one(
      pool,
      "SELECT id,role,membership_status FROM users WHERE id=$1",
      [identity.id],
    );
    if (!user) fail(401, "Account not found");
    if (user.membership_status !== "APPROVED")
      fail(403, "Approved membership required");
    req.user = user;
    next();
  });
  const api = express.Router();
  app.use("/api/v1", api);
  api.get("/reviews/contributions", async (req, res) => {
    if (!admin(req.user) && req.user.role !== "MENTOR")
      fail(403, "Assigned mentor or admin required");
    const p = paged(req);
    res.json({
      data: await rows(
        pool,
        `SELECT c.*,p.title AS project_title FROM contributions c JOIN projects p ON p.id=c.project_id WHERE c.status IN ('SUBMITTED','UNDER_REVIEW','RECOMMENDED') AND c.user_id<>$1 AND ($2 OR p.mentor_id=$1) ORDER BY c.created_at,c.id LIMIT $3 OFFSET $4`,
        [req.user.id, admin(req.user), p.limit, p.offset],
      ),
      page: p.page,
      limit: p.limit,
    });
  });
  api.get("/me/access", async (req, res) => {
    const projects = await rows(
      pool,
      `SELECT p.id,p.lead_id,p.mentor_id,m.assigned_role FROM projects p LEFT JOIN project_members m ON m.project_id=p.id AND m.user_id=$1 WHERE m.user_id=$1 OR p.mentor_id=$1 OR $2`,
      [req.user.id, admin(req.user)],
    );
    res.json({
      data: {
        role: req.user.role,
        membership_status: req.user.membership_status,
        can_review: admin(req.user) || req.user.role === "MENTOR",
        can_verify: admin(req.user),
        projects,
      },
    });
  });
  api.get("/me/profile", async (req, res) => {
    const data = await one(
      pool,
      `SELECT p.*,u.email,u.full_name,u.register_number,u.membership_status FROM profiles p JOIN users u ON u.id=p.user_id WHERE user_id=$1`,
      [req.user.id],
    );
    if (!data) fail(404, "Profile not provisioned");
    const assignments = await rows(
      pool,
      `SELECT p.id,p.title,m.assigned_role,u.full_name AS mentor FROM project_members m JOIN projects p ON p.id=m.project_id LEFT JOIN users u ON u.id=p.mentor_id WHERE m.user_id=$1`,
      [req.user.id],
    );
    res.json({ data: { ...data, assignments } });
  });
  api.put("/me/profile", async (req, res) => {
    const body = v.profile.parse(req.body),
      ver = version(req);
    const data = await transaction(pool, async (c) => {
      const old = await one(
        c,
        "SELECT * FROM profiles WHERE user_id=$1 FOR UPDATE",
        [req.user.id],
      );
      if (!old) fail(404, "Profile not found");
      if (old.version !== ver)
        fail(409, "Profile changed; reload before saving");
      const status = body.public_consent ? "PENDING" : "PRIVATE";
      const result = await one(
        c,
        `UPDATE profiles SET display_name=$2,bio=$3,department=$4,program=$5,year_of_study=$6,academic_year=$7,skills=$8,interests=$9,portfolio_links=$10,public_consent=$11,publication_status=$12,version=version+1,updated_at=now() WHERE user_id=$1 RETURNING *`,
        [
          req.user.id,
          body.display_name,
          body.bio,
          body.department,
          body.program,
          body.year_of_study,
          body.academic_year,
          json(body.skills),
          json(body.interests),
          json(body.portfolio_links),
          body.public_consent,
          status,
        ],
      );
      await audit(
        c,
        req.user,
        req.user.id,
        "PROFILE_UPDATED",
        "PROFILE",
        req.user.id,
        { fields: Object.keys(body), publication_status: status },
      );
      return result;
    });
    res.json({ data });
  });
  api.get("/me/profile/public-preview", async (req, res) => {
    const data = await one(
      pool,
      "SELECT display_name,bio,department,program,year_of_study,skills,interests,portfolio_links,public_consent,publication_status FROM profiles WHERE user_id=$1",
      [req.user.id],
    );
    res.json({ data });
  });
  api.post("/me/corrections", async (req, res) => {
    const b = z
      .object({
        field: z.enum(["full_name", "register_number", "email"]),
        requested_value: z.string().trim().min(1).max(200),
        reason: v.text,
      })
      .strict()
      .parse(req.body);
    if (b.field === "email")
      b.requested_value = z
        .string()
        .email()
        .parse(b.requested_value.toLowerCase());
    const data = await transaction(pool, async (c) => {
      const d = await one(
        c,
        "INSERT INTO corrections(id,user_id,field,requested_value,reason) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [randomUUID(), req.user.id, b.field, b.requested_value, b.reason],
      );
      await audit(
        c,
        req.user,
        req.user.id,
        "CORRECTION_REQUESTED",
        "CORRECTION",
        d.id,
      );
      return d;
    });
    res.status(201).json({ data });
  });
  api.get("/me/corrections", async (req, res) => {
    res.json({
      data: await rows(
        pool,
        "SELECT * FROM corrections WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
        [req.user.id],
      ),
    });
  });
  api.get("/projects", async (req, res) => {
    const p = paged(req);
    const status = z
      .enum([
        "PROPOSED",
        "APPROVED",
        "ACTIVE",
        "ON_HOLD",
        "COMPLETED",
        "ARCHIVED",
      ])
      .optional()
      .parse(req.query.status);
    const data = await rows(
      pool,
      `SELECT p.*,m.assigned_role,u.full_name AS mentor_name FROM projects p LEFT JOIN project_members m ON m.project_id=p.id AND m.user_id=$1 LEFT JOIN users u ON u.id=p.mentor_id WHERE (m.user_id=$1 OR p.mentor_id=$1 OR $2) AND ($3::text IS NULL OR p.status=$3) ORDER BY p.created_at DESC,p.id LIMIT $4 OFFSET $5`,
      [req.user.id, admin(req.user), status ?? null, p.limit, p.offset],
    );
    res.json({ data, page: p.page, limit: p.limit });
  });
  api.post("/projects", async (req, res) => {
    if (!["STUDENT", "ADMIN", "SUPER_ADMIN"].includes(req.user.role))
      fail(403, "Student or admin required");
    const b = v.project.parse(req.body);
    const data = await transaction(pool, async (c) => {
      const id = randomUUID();
      const d = await one(
        c,
        `INSERT INTO projects(id,title,domain,abstract,problem_statement,objectives,expected_outcome,technologies,repository_url,demo_url,start_date,target_date,lead_id,risks) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          id,
          b.title,
          b.domain,
          b.abstract,
          b.problem_statement,
          b.objectives,
          b.expected_outcome,
          json(b.technologies),
          b.repository_url,
          b.demo_url,
          b.start_date,
          b.target_date,
          req.user.id,
          b.risks,
        ],
      );
      await c.query("INSERT INTO project_members VALUES($1,$2,$3)", [
        id,
        req.user.id,
        "Team Lead",
      ]);
      await audit(c, req.user, req.user.id, "PROJECT_PROPOSED", "PROJECT", id);
      return d;
    });
    res.status(201).json({ data });
  });
  api.get("/projects/:id", async (req, res) => {
    const data = await projectAccess(pool, req.user, req.params.id);
    const members = await rows(
      pool,
      "SELECT m.user_id,m.assigned_role,p.display_name FROM project_members m JOIN profiles p ON p.user_id=m.user_id WHERE project_id=$1",
      [data.id],
    );
    const milestones = await rows(
      pool,
      "SELECT * FROM milestones WHERE project_id=$1 ORDER BY due_date,id",
      [data.id],
    );
    res.json({ data: { ...data, members, milestones } });
  });
  api.put("/projects/:id", async (req, res) => {
    const b = v.project.parse(req.body),
      ver = version(req);
    const data = await transaction(pool, async (c) => {
      const p = await projectAccess(c, req.user, req.params.id, {
        write: true,
        lock: true,
      });
      if (p.version !== ver) fail(409, "Project changed");
      const d = await one(
        c,
        `UPDATE projects SET title=$2,domain=$3,abstract=$4,problem_statement=$5,objectives=$6,expected_outcome=$7,technologies=$8,repository_url=$9,demo_url=$10,start_date=$11,target_date=$12,risks=$13,public_approved=false,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,
        [
          p.id,
          b.title,
          b.domain,
          b.abstract,
          b.problem_statement,
          b.objectives,
          b.expected_outcome,
          json(b.technologies),
          b.repository_url,
          b.demo_url,
          b.start_date,
          b.target_date,
          b.risks,
        ],
      );
      await audit(c, req.user, p.lead_id, "PROJECT_UPDATED", "PROJECT", p.id);
      return d;
    });
    res.json({ data });
  });
  api.put("/projects/:id/members/:userId", async (req, res) => {
    const b = z
      .object({ assigned_role: z.string().trim().min(1).max(100) })
      .strict()
      .parse(req.body);
    const uid = v.id.parse(req.params.userId);
    await transaction(pool, async (c) => {
      const p = await projectAccess(c, req.user, req.params.id, {
        write: true,
        lock: true,
      });
      const u = await one(
        c,
        "SELECT id FROM users WHERE id=$1 AND membership_status='APPROVED' AND role='STUDENT'",
        [uid],
      );
      if (!u) fail(422, "Approved student required");
      await c.query(
        "INSERT INTO project_members VALUES($1,$2,$3) ON CONFLICT(project_id,user_id) DO UPDATE SET assigned_role=$3",
        [p.id, uid, b.assigned_role],
      );
      await audit(c, req.user, uid, "MEMBER_ASSIGNED", "PROJECT", p.id);
      await notify(c, uid, `Assigned to ${p.title}`, "PROJECT", p.id);
    });
    res.json({ data: { assigned: true } });
  });
  api.post("/projects/:id/milestones", async (req, res) => {
    const b = z
      .object({ title: z.string().min(1).max(200), due_date: v.date })
      .strict()
      .parse(req.body);
    const data = await transaction(pool, async (c) => {
      const p = await projectAccess(c, req.user, req.params.id, {
        write: true,
        lock: true,
      });
      const d = await one(
        c,
        "INSERT INTO milestones(id,project_id,title,due_date) VALUES($1,$2,$3,$4) RETURNING *",
        [randomUUID(), p.id, b.title, b.due_date],
      );
      await audit(
        c,
        req.user,
        p.lead_id,
        "MILESTONE_CREATED",
        "MILESTONE",
        d.id,
      );
      return d;
    });
    res.status(201).json({ data });
  });
  api.patch("/projects/:id/milestones/:milestoneId", async (req, res) => {
    const b = z
      .object({
        status: z.enum([
          "NOT_STARTED",
          "IN_PROGRESS",
          "BLOCKED",
          "SUBMITTED",
          "REVIEWED",
          "COMPLETED",
        ]),
      })
      .strict()
      .parse(req.body);
    const data = await transaction(pool, async (c) => {
      const p = await projectAccess(c, req.user, req.params.id, {
        write: true,
        lock: true,
      });
      const d = await one(
        c,
        "UPDATE milestones SET status=$3 WHERE id=$1 AND project_id=$2 RETURNING *",
        [v.id.parse(req.params.milestoneId), p.id, b.status],
      );
      if (!d) fail(404, "Milestone not found");
      await audit(
        c,
        req.user,
        p.lead_id,
        "MILESTONE_UPDATED",
        "MILESTONE",
        d.id,
        b,
      );
      return d;
    });
    res.json({ data });
  });
  api.get("/projects/:id/tasks", async (req, res) => {
    await projectAccess(pool, req.user, req.params.id);
    const p = paged(req);
    res.json({
      data: await rows(
        pool,
        "SELECT * FROM tasks WHERE project_id=$1 ORDER BY due_date,id LIMIT $2 OFFSET $3",
        [req.params.id, p.limit, p.offset],
      ),
      page: p.page,
      limit: p.limit,
    });
  });
  api.post("/projects/:id/tasks", async (req, res) => {
    const b = v.task.parse(req.body);
    const data = await transaction(pool, async (c) => {
      const p = await projectAccess(c, req.user, req.params.id, {
        write: true,
        lock: true,
      });
      if (
        !(await one(
          c,
          "SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2",
          [p.id, b.assignee_id],
        ))
      )
        fail(422, "Assignee must be a project member");
      if (
        b.milestone_id &&
        !(await one(
          c,
          "SELECT 1 FROM milestones WHERE id=$1 AND project_id=$2",
          [b.milestone_id, p.id],
        ))
      )
        fail(422, "Milestone belongs to another project");
      const d = await one(
        c,
        "INSERT INTO tasks(id,project_id,milestone_id,assignee_id,title,description,due_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          randomUUID(),
          p.id,
          b.milestone_id,
          b.assignee_id,
          b.title,
          b.description,
          b.due_date,
        ],
      );
      await audit(c, req.user, b.assignee_id, "TASK_ASSIGNED", "TASK", d.id);
      await notify(c, b.assignee_id, `Task assigned: ${b.title}`, "TASK", d.id);
      return d;
    });
    res.status(201).json({ data });
  });
  api.get("/me/tasks", async (req, res) => {
    const p = paged(req);
    res.json({
      data: await rows(
        pool,
        "SELECT t.*,p.title AS project_title FROM tasks t JOIN projects p ON p.id=t.project_id WHERE assignee_id=$1 ORDER BY due_date,t.id LIMIT $2 OFFSET $3",
        [req.user.id, p.limit, p.offset],
      ),
      page: p.page,
      limit: p.limit,
    });
  });
  api.patch("/tasks/:id/status", async (req, res) => {
    const b = z
        .object({
          status: z.enum([
            "NOT_STARTED",
            "IN_PROGRESS",
            "BLOCKED",
            "SUBMITTED",
            "REVIEWED",
            "COMPLETED",
          ]),
          blocker: z.string().max(2000).default(""),
        })
        .strict()
        .parse(req.body),
      ver = version(req);
    if (b.status === "BLOCKED" && !b.blocker.trim())
      fail(422, "Blocker explanation required");
    const data = await transaction(pool, async (c) => {
      const t = await one(c, "SELECT * FROM tasks WHERE id=$1 FOR UPDATE", [
        v.id.parse(req.params.id),
      ]);
      if (!t) fail(404, "Task not found");
      const p = await projectAccess(c, req.user, t.project_id);
      const manager = admin(req.user) || p.lead_id === req.user.id;
      if (t.assignee_id !== req.user.id && !manager)
        fail(403, "Only assignee or project lead can update task");
      if (t.version !== ver) fail(409, "Task changed");
      const transitions = {
        NOT_STARTED: ["IN_PROGRESS", "BLOCKED"],
        IN_PROGRESS: ["BLOCKED", "SUBMITTED"],
        BLOCKED: ["IN_PROGRESS"],
        SUBMITTED: ["IN_PROGRESS", "REVIEWED"],
        REVIEWED: ["IN_PROGRESS", "COMPLETED"],
        COMPLETED: [],
      };
      if (!transitions[t.status].includes(b.status))
        fail(409, "Invalid task transition");
      if (["REVIEWED", "COMPLETED"].includes(b.status) && !manager)
        fail(403, "Project lead must review completion");
      const d = await one(
        c,
        "UPDATE tasks SET status=$2,blocker=$3,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
        [t.id, b.status, b.blocker],
      );
      await audit(
        c,
        req.user,
        t.assignee_id,
        "TASK_STATUS_CHANGED",
        "TASK",
        t.id,
        { from: t.status, to: b.status },
      );
      return d;
    });
    res.json({ data });
  });
  api.get("/me/contributions", async (req, res) => {
    const p = paged(req),
      period = v.period.parse(req.query);
    res.json({
      data: await rows(
        pool,
        "SELECT c.*,p.title AS project_title FROM contributions c JOIN projects p ON p.id=c.project_id WHERE user_id=$1 AND contribution_date BETWEEN $2 AND $3 ORDER BY c.created_at DESC,c.id LIMIT $4 OFFSET $5",
        [req.user.id, period.from, period.to, p.limit, p.offset],
      ),
      page: p.page,
      limit: p.limit,
    });
  });
  api.post("/contributions", async (req, res) => {
    const b = v.contribution.parse(req.body);
    const data = await transaction(pool, async (c) => {
      await projectAccess(c, req.user, b.project_id);
      if (
        !(await one(
          c,
          "SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2",
          [b.project_id, req.user.id],
        ))
      )
        fail(403, "Only project members can contribute");
      if (
        b.task_id &&
        !(await one(
          c,
          "SELECT 1 FROM tasks WHERE id=$1 AND project_id=$2 AND assignee_id=$3",
          [b.task_id, b.project_id, req.user.id],
        ))
      )
        fail(422, "Task must belong to your project and be assigned to you");
      const d = await one(
        c,
        "INSERT INTO contributions(id,project_id,user_id,task_id,contribution_date,work_area,description,outcome,evidence_links) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
        [
          randomUUID(),
          b.project_id,
          req.user.id,
          b.task_id,
          b.contribution_date,
          b.work_area,
          b.description,
          b.outcome,
          json(b.evidence_links),
        ],
      );
      await audit(
        c,
        req.user,
        req.user.id,
        "CONTRIBUTION_DRAFTED",
        "CONTRIBUTION",
        d.id,
      );
      return d;
    });
    res.status(201).json({ data });
  });
  api.get("/contributions/:id", async (req, res) => {
    const c = await contributionAccess(pool, req.user, req.params.id);
    res.json({
      data: {
        ...c,
        files: await rows(
          pool,
          "SELECT id,original_name,mime_type,size_bytes FROM files WHERE contribution_id=$1",
          [c.id],
        ),
      },
    });
  });
  api.put("/contributions/:id", async (req, res) => {
    const b = v.contribution.parse(req.body),
      ver = version(req);
    const data = await transaction(pool, async (c) => {
      const old = await contributionAccess(c, req.user, req.params.id, true);
      if (old.user_id !== req.user.id) fail(403, "Owner required");
      if (!["DRAFT", "REVISION_REQUIRED"].includes(old.status))
        fail(409, "Submitted or verified contributions are immutable");
      if (old.version !== ver) fail(409, "Contribution changed");
      if (old.project_id !== b.project_id)
        fail(422, "Project cannot be changed");
      if (
        b.task_id &&
        !(await one(
          c,
          "SELECT 1 FROM tasks WHERE id=$1 AND project_id=$2 AND assignee_id=$3",
          [b.task_id, b.project_id, req.user.id],
        ))
      )
        fail(422, "Invalid task");
      const d = await one(
        c,
        "UPDATE contributions SET task_id=$2,contribution_date=$3,work_area=$4,description=$5,outcome=$6,evidence_links=$7,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
        [
          old.id,
          b.task_id,
          b.contribution_date,
          b.work_area,
          b.description,
          b.outcome,
          json(b.evidence_links),
        ],
      );
      await audit(
        c,
        req.user,
        old.user_id,
        "CONTRIBUTION_UPDATED",
        "CONTRIBUTION",
        old.id,
      );
      return d;
    });
    res.json({ data });
  });
  api.post("/contributions/:id/submit", async (req, res) => {
    const ver = version(req);
    const data = await transaction(pool, async (c) => {
      const d = await contributionAccess(c, req.user, req.params.id, true);
      if (d.user_id !== req.user.id) fail(403, "Owner required");
      if (d.version !== ver) fail(409, "Contribution changed");
      if (!["DRAFT", "REVISION_REQUIRED"].includes(d.status))
        fail(409, "Contribution cannot be submitted");
      if (
        !d.evidence_links.length &&
        !(await one(c, "SELECT 1 FROM files WHERE contribution_id=$1", [d.id]))
      )
        fail(422, "Attach evidence before submission");
      const out = await one(
        c,
        "UPDATE contributions SET status='SUBMITTED',version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
        [d.id],
      );
      await audit(
        c,
        req.user,
        d.user_id,
        "CONTRIBUTION_SUBMITTED",
        "CONTRIBUTION",
        d.id,
      );
      return out;
    });
    res.json({ data });
  });
  api.post("/contributions/:id/review", async (req, res) => {
    const b = z
        .object({
          status: z.enum([
            "UNDER_REVIEW",
            "RECOMMENDED",
            "REVISION_REQUIRED",
            "VERIFIED",
          ]),
          note: v.text,
        })
        .strict()
        .parse(req.body),
      ver = version(req);
    const data = await transaction(pool, async (c) => {
      const d = await contributionAccess(c, req.user, req.params.id, true),
        p = await projectAccess(c, req.user, d.project_id);
      if (
        !admin(req.user) &&
        !(req.user.role === "MENTOR" && p.mentor_id === req.user.id)
      )
        fail(403, "Assigned mentor or admin required");
      if (d.user_id === req.user.id)
        fail(403, "Self verification is forbidden");
      if (b.status === "VERIFIED" && !admin(req.user))
        fail(403, "Only admin can verify");
      if (d.version !== ver) fail(409, "Contribution changed");
      const transitions = {
        SUBMITTED: [
          "UNDER_REVIEW",
          "RECOMMENDED",
          "REVISION_REQUIRED",
          "VERIFIED",
        ],
        UNDER_REVIEW: ["RECOMMENDED", "REVISION_REQUIRED", "VERIFIED"],
        RECOMMENDED: ["REVISION_REQUIRED", "VERIFIED"],
      };
      if (!transitions[d.status]?.includes(b.status))
        fail(409, "Invalid review transition");
      const out = await one(
        c,
        "UPDATE contributions SET status=$2,review_note=$3,reviewer_id=$4,reviewed_at=now(),version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
        [d.id, b.status, b.note, req.user.id],
      );
      await audit(
        c,
        req.user,
        d.user_id,
        "CONTRIBUTION_REVIEWED",
        "CONTRIBUTION",
        d.id,
        { from: d.status, to: b.status },
      );
      await notify(
        c,
        d.user_id,
        `Contribution ${b.status}: ${b.note}`,
        "CONTRIBUTION",
        d.id,
      );
      return out;
    });
    res.json({ data });
  });
  async function summary(c, userId, period) {
    const projects = await one(
      c,
      `SELECT count(*)::int AS assigned_projects,count(*) FILTER(WHERE p.status='ACTIVE')::int AS active_projects FROM project_members m JOIN projects p ON p.id=m.project_id WHERE m.user_id=$1`,
      [userId],
    );
    const contributions = await one(
      c,
      `SELECT count(*)::int AS total_contributions,count(*) FILTER(WHERE status<>'DRAFT')::int AS reported_contributions,count(*) FILTER(WHERE status='SUBMITTED')::int AS submitted_contributions,count(*) FILTER(WHERE status IN ('SUBMITTED','UNDER_REVIEW','RECOMMENDED'))::int AS awaiting_review,count(*) FILTER(WHERE status='VERIFIED')::int AS verified_contributions,count(*) FILTER(WHERE status='REVISION_REQUIRED')::int AS contributions_needing_revision FROM contributions WHERE user_id=$1 AND contribution_date BETWEEN $2 AND $3`,
      [userId, period.from, period.to],
    );
    const activities = await one(
      c,
      `SELECT count(*) FILTER(WHERE kind='WEEKLY_UPDATE' AND status<>'DRAFT')::int AS submitted_weekly_updates,count(*) FILTER(WHERE kind='WEEKLY_UPDATE' AND status='REVISION_REQUIRED')::int AS updates_needing_revision,count(*) FILTER(WHERE kind='HACKATHON' AND status IN ('PARTICIPATED','VERIFIED'))::int AS hackathon_participations,count(*) FILTER(WHERE kind='ACHIEVEMENT' AND status='VERIFIED')::int AS verified_achievements FROM activity_records WHERE user_id=$1 AND occurred_on BETWEEN $2 AND $3`,
      [userId, period.from, period.to],
    );
    const tasks = await one(
      c,
      `SELECT count(*) FILTER(WHERE status<>'COMPLETED')::int AS open_tasks,count(*) FILTER(WHERE status='BLOCKED')::int AS blocked_tasks,count(*) FILTER(WHERE status<>'COMPLETED' AND due_date<CURRENT_DATE)::int AS overdue_tasks FROM tasks WHERE assignee_id=$1`,
      [userId],
    );
    const by_work_area = await rows(
      c,
      `SELECT work_area,count(*)::int AS total,count(*) FILTER(WHERE status='VERIFIED')::int AS verified FROM contributions WHERE user_id=$1 AND contribution_date BETWEEN $2 AND $3 GROUP BY work_area ORDER BY work_area`,
      [userId, period.from, period.to],
    );
    const monthly = await rows(
      c,
      `SELECT to_char(contribution_date,'YYYY-MM') AS month,count(*)::int AS total,count(*) FILTER(WHERE status='VERIFIED')::int AS verified FROM contributions WHERE user_id=$1 AND contribution_date BETWEEN $2 AND $3 GROUP BY 1 ORDER BY 1`,
      [userId, period.from, period.to],
    );
    return {
      period,
      ...projects,
      ...contributions,
      ...activities,
      ...tasks,
      by_work_area,
      monthly,
      definitions: {
        project_and_task_counts: "Current assignments; not date-filtered",
        activity_counts:
          "Contribution date / external activity date, inclusive",
        reported_contributions:
          "All non-draft records, including revision required and verified",
        submitted_contributions: "Currently SUBMITTED only",
        awaiting_review: "SUBMITTED + UNDER_REVIEW + RECOMMENDED",
      },
      source_sync: await rows(
        c,
        "SELECT source,max(updated_at) AS last_received_at FROM activity_records WHERE user_id=$1 GROUP BY source",
        [userId],
      ),
    };
  }
  api.get("/me/activity-summary", async (req, res) => {
    const period = v.period.parse(req.query);
    const data = await transaction(pool, async (c) => {
      await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      return summary(c, req.user.id, period);
    });
    res.json({ data });
  });
  api.get("/me/activity-summary/export", async (req, res) => {
    const data = await summary(pool, req.user.id, v.period.parse(req.query));
    const metrics = Object.entries(data).filter(
      ([, val]) => typeof val === "number",
    );
    res
      .type("text/csv")
      .attachment("activity-summary.csv")
      .send(
        "metric,value\r\n" +
          metrics.map(([k, val]) => `${k},${val}`).join("\r\n"),
      );
  });
  api.get("/me/activity", async (req, res) => {
    const p = paged(req),
      period = v.period.parse(req.query);
    res.json({
      data: await rows(
        pool,
        "SELECT id,action,target_type,target_id,details,created_at FROM audit_logs WHERE subject_id=$1 AND created_at >= $2::date AND created_at < $3::date + interval '1 day' ORDER BY created_at DESC,id LIMIT $4 OFFSET $5",
        [req.user.id, period.from, period.to, p.limit, p.offset],
      ),
      page: p.page,
      limit: p.limit,
    });
  });
  api.get("/me/dashboard", async (req, res) => {
    const data = await transaction(pool, async (c) => {
      await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const uid = req.user.id;
      const profile = await one(
        c,
        "SELECT display_name,department,year_of_study,academic_year,photo_id FROM profiles WHERE user_id=$1",
        [uid],
      );
      const counts = await summary(c, uid, v.period.parse(req.query));
      const active_work = await rows(
        c,
        `SELECT p.id,p.title,p.status,m.assigned_role,(SELECT title FROM milestones WHERE project_id=p.id AND status<>'COMPLETED' ORDER BY due_date,id LIMIT 1) AS next_milestone FROM project_members m JOIN projects p ON p.id=m.project_id WHERE m.user_id=$1 AND p.status='ACTIVE' ORDER BY p.target_date,p.id LIMIT 10`,
        [uid],
      );
      const priority = await one(
        c,
        `SELECT * FROM activity_records WHERE user_id=$1 AND kind='WEEKLY_UPDATE' AND occurred_on <= CURRENT_DATE AND occurred_on > CURRENT_DATE - 7 ORDER BY occurred_on DESC,updated_at DESC LIMIT 1`,
        [uid],
      );
      const recent_activity = await rows(
        c,
        "SELECT action,target_type,target_id,details,created_at FROM audit_logs WHERE subject_id=$1 ORDER BY created_at DESC,id LIMIT 10",
        [uid],
      );
      const notifications = await rows(
        c,
        "SELECT * FROM notifications WHERE user_id=$1 AND read_at IS NULL ORDER BY created_at DESC,id LIMIT 5",
        [uid],
      );
      const unread = await one(
        c,
        "SELECT count(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL",
        [uid],
      );
      return {
        profile,
        counts,
        active_work,
        priority: priority ?? null,
        recent_activity,
        notifications,
        unread_notifications: unread.count,
      };
    });
    res.json({ data });
  });
  api.get("/me/notifications", async (req, res) => {
    const p = paged(req);
    res.json({
      data: await rows(
        pool,
        "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3",
        [req.user.id, p.limit, p.offset],
      ),
      page: p.page,
      limit: p.limit,
    });
  });
  api.patch("/me/notifications/:id/read", async (req, res) => {
    const data = await one(
      pool,
      "UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING *",
      [v.id.parse(req.params.id), req.user.id],
    );
    if (!data) fail(404, "Notification not found");
    res.json({ data });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  }).single("file");
  function fileType(b) {
    if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
    if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      return "image/png";
    if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
    return null;
  }
  async function saveUpload(req, res, kind) {
    if (!req.file) fail(422, "Multipart file required");
    const mime = fileType(req.file.buffer);
    if (!mime || (kind === "PHOTO" && mime === "application/pdf"))
      fail(415, "Only JPEG/PNG photos or PDF/JPEG/PNG evidence supported");
    const fid = randomUUID(),
      key = randomUUID(),
      dest = path.join(uploadDir, key);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(dest, req.file.buffer, { mode: 0o600, flag: "wx" });
    let data;
    try {
      data = await transaction(pool, async (c) => {
        let contribution = null;
        if (kind === "EVIDENCE") {
          contribution = await contributionAccess(
            c,
            req.user,
            req.params.id,
            true,
          );
          if (contribution.user_id !== req.user.id) fail(403, "Owner required");
          if (!["DRAFT", "REVISION_REQUIRED"].includes(contribution.status))
            fail(409, "Evidence locked after submission");
        }
        const d = await one(
          c,
          "INSERT INTO files(id,owner_id,contribution_id,kind,original_name,storage_key,mime_type,size_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,original_name,mime_type,size_bytes",
          [
            fid,
            req.user.id,
            contribution?.id ?? null,
            kind,
            path.basename(req.file.originalname).slice(0, 200),
            key,
            mime,
            req.file.size,
          ],
        );
        if (kind === "PHOTO")
          await c.query(
            "UPDATE profiles SET photo_id=$2,publication_status=CASE WHEN public_consent THEN 'PENDING' ELSE 'PRIVATE' END,version=version+1,updated_at=now() WHERE user_id=$1",
            [req.user.id, fid],
          );
        else
          await c.query(
            "UPDATE contributions SET version=version+1,updated_at=now() WHERE id=$1",
            [contribution.id],
          );
        await audit(c, req.user, req.user.id, "FILE_UPLOADED", "FILE", fid, {
          kind,
        });
        return d;
      });
    } catch (e) {
      await unlink(dest).catch(() => {});
      throw e;
    }
    res.status(201).json({ data });
  }
  api.post("/me/profile/photo", upload, async (req, res) =>
    saveUpload(req, res, "PHOTO"),
  );
  api.post("/contributions/:id/files", upload, async (req, res) =>
    saveUpload(req, res, "EVIDENCE"),
  );
  api.get("/files/:id", async (req, res) => {
    const f = await one(pool, "SELECT * FROM files WHERE id=$1", [
      v.id.parse(req.params.id),
    ]);
    if (!f) fail(404, "File not found");
    if (f.owner_id !== req.user.id && !admin(req.user)) {
      if (!f.contribution_id) fail(404, "File not found");
      await contributionAccess(pool, req.user, f.contribution_id);
    }
    res.type(f.mime_type).attachment(f.original_name);
    res.sendFile(path.resolve(uploadDir, f.storage_key));
  });
  api.use("/admin", (req, res, next) => {
    if (!admin(req.user)) fail(403, "Admin required");
    next();
  });
  api.get("/admin/profiles", async (req, res) => {
    const p = paged(req);
    res.json({
      data: await rows(
        pool,
        "SELECT user_id,display_name,publication_status,version FROM profiles WHERE publication_status='PENDING' ORDER BY updated_at,user_id LIMIT $1 OFFSET $2",
        [p.limit, p.offset],
      ),
    });
  });
  api.get("/admin/profiles/:id", async (req, res) => {
    const d = await one(
      pool,
      "SELECT p.*,u.email,u.full_name,u.register_number,u.membership_status FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1",
      [v.id.parse(req.params.id)],
    );
    if (!d) fail(404, "Profile not found");
    res.json({ data: d });
  });
  api.get("/admin/corrections", async (req, res) => {
    const p = paged(req);
    res.json({
      data: await rows(
        pool,
        "SELECT * FROM corrections WHERE status='PENDING' ORDER BY created_at,id LIMIT $1 OFFSET $2",
        [p.limit, p.offset],
      ),
    });
  });
  api.post("/admin/corrections/:id/review", async (req, res) => {
    const b = z
      .object({ approve: z.boolean(), note: v.text })
      .strict()
      .parse(req.body);
    await transaction(pool, async (c) => {
      const d = await one(
        c,
        "SELECT * FROM corrections WHERE id=$1 FOR UPDATE",
        [v.id.parse(req.params.id)],
      );
      if (!d) fail(404, "Correction not found");
      if (d.status !== "PENDING") fail(409, "Already reviewed");
      if (b.approve) {
        const field = z
          .enum(["full_name", "register_number", "email"])
          .parse(d.field);
        await c.query(`UPDATE users SET ${field}=$2 WHERE id=$1`, [
          d.user_id,
          d.requested_value,
        ]);
        if (field === "email")
          await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [
            d.user_id,
          ]);
        await c.query(
          "UPDATE profiles SET publication_status=CASE WHEN public_consent THEN 'PENDING' ELSE 'PRIVATE' END,version=version+1 WHERE user_id=$1",
          [d.user_id],
        );
      }
      await c.query(
        "UPDATE corrections SET status=$2,review_note=$3,reviewer_id=$4 WHERE id=$1",
        [d.id, b.approve ? "APPROVED" : "REJECTED", b.note, req.user.id],
      );
      await audit(
        c,
        req.user,
        d.user_id,
        "CORRECTION_REVIEWED",
        "CORRECTION",
        d.id,
        { approved: b.approve },
      );
      await notify(c, d.user_id, b.note, "CORRECTION", d.id);
    });
    res.json({ data: { reviewed: true } });
  });
  api.post("/admin/profiles/:id/publication", async (req, res) => {
    const b = z
      .object({
        approve: z.boolean(),
        version: z.number().int().positive(),
        note: v.text,
      })
      .strict()
      .parse(req.body);
    await transaction(pool, async (c) => {
      const uid = v.id.parse(req.params.id),
        p = await one(c, "SELECT * FROM profiles WHERE user_id=$1 FOR UPDATE", [
          uid,
        ]);
      if (!p) fail(404, "Profile not found");
      if (p.version !== b.version) fail(409, "Profile changed");
      if (!p.public_consent || p.publication_status !== "PENDING")
        fail(409, "No pending consented publication request");
      await c.query(
        "UPDATE profiles SET publication_status=$2,version=version+1 WHERE user_id=$1",
        [uid, b.approve ? "APPROVED" : "REJECTED"],
      );
      await audit(c, req.user, uid, "PUBLICATION_REVIEWED", "PROFILE", uid, {
        approved: b.approve,
      });
      await notify(c, uid, b.note, "PROFILE", uid);
    });
    res.json({ data: { reviewed: true } });
  });
  api.post("/admin/projects/:id/review", async (req, res) => {
    const b = z
        .object({
          status: z.enum([
            "APPROVED",
            "ACTIVE",
            "ON_HOLD",
            "COMPLETED",
            "ARCHIVED",
          ]),
          mentor_id: v.id.nullable(),
          note: v.text,
          public_approved: z.boolean().default(false),
        })
        .strict()
        .parse(req.body),
      ver = version(req);
    const data = await transaction(pool, async (c) => {
      const p = await projectAccess(c, req.user, req.params.id, {
        write: true,
        lock: true,
      });
      if (p.version !== ver) fail(409, "Project changed");
      const allowed = {
        PROPOSED: ["APPROVED", "ARCHIVED"],
        APPROVED: ["ACTIVE", "ARCHIVED"],
        ACTIVE: ["ON_HOLD", "COMPLETED", "ARCHIVED"],
        ON_HOLD: ["ACTIVE", "ARCHIVED"],
        COMPLETED: ["ARCHIVED"],
        ARCHIVED: [],
      };
      if (!allowed[p.status].includes(b.status))
        fail(409, "Invalid project status transition");
      if (
        b.mentor_id &&
        !(await one(
          c,
          "SELECT 1 FROM users WHERE id=$1 AND role='MENTOR' AND membership_status='APPROVED'",
          [b.mentor_id],
        ))
      )
        fail(422, "Approved mentor required");
      const d = await one(
        c,
        "UPDATE projects SET status=$2,mentor_id=$3,review_notes=$4,public_approved=$5,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
        [p.id, b.status, b.mentor_id, b.note, b.public_approved],
      );
      await audit(c, req.user, p.lead_id, "PROJECT_REVIEWED", "PROJECT", p.id, {
        status: b.status,
      });
      await notify(c, p.lead_id, b.note, "PROJECT", p.id);
      return d;
    });
    res.json({ data });
  });
  api.put(
    "/admin/integrations/activities/:source/:externalId",
    async (req, res) => {
      const source = z
          .string()
          .regex(/^[a-zA-Z0-9_-]{1,64}$/)
          .parse(req.params.source),
        external = z.string().min(1).max(200).parse(req.params.externalId);
      const b = z
        .object({
          user_id: v.id,
          project_id: v.id.nullable().default(null),
          kind: z.enum(["WEEKLY_UPDATE", "HACKATHON", "ACHIEVEMENT"]),
          status: z.enum([
            "DRAFT",
            "SUBMITTED",
            "UNDER_REVIEW",
            "REVISION_REQUIRED",
            "VERIFIED",
            "PARTICIPATED",
          ]),
          title: z.string().min(1).max(200),
          plan: z.string().max(5000).default(""),
          feedback: z.string().max(5000).default(""),
          occurred_on: v.date,
        })
        .strict()
        .parse(req.body);
      if (b.status === "PARTICIPATED" && b.kind !== "HACKATHON")
        fail(422, "PARTICIPATED applies only to hackathons");
      const data = await transaction(pool, async (c) => {
        if (
          b.project_id &&
          !(await one(
            c,
            "SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2",
            [b.project_id, b.user_id],
          ))
        )
          fail(422, "Student is not a project member");
        const old = await one(
          c,
          "SELECT * FROM activity_records WHERE source=$1 AND external_id=$2 FOR UPDATE",
          [source, external],
        );
        if (old && (old.user_id !== b.user_id || old.kind !== b.kind))
          fail(409, "External record identity cannot change");
        const d = await one(
          c,
          `INSERT INTO activity_records(source,external_id,user_id,project_id,kind,status,title,plan,feedback,occurred_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(source,external_id) DO UPDATE SET project_id=$4,status=$6,title=$7,plan=$8,feedback=$9,occurred_on=$10,updated_at=now() RETURNING *`,
          [
            source,
            external,
            b.user_id,
            b.project_id,
            b.kind,
            b.status,
            b.title,
            b.plan,
            b.feedback,
            b.occurred_on,
          ],
        );
        await audit(
          c,
          req.user,
          b.user_id,
          "EXTERNAL_ACTIVITY_SYNCED",
          "PROFILE",
          b.user_id,
          { source, external_id: external, kind: b.kind },
        );
        return d;
      });
      res.json({ data });
    },
  );
  app.use((req, res) =>
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Route not found" } }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    let status = err.status ?? 500,
      message = err.message;
    if (err instanceof z.ZodError) {
      status = 422;
      message = "Validation failed";
    }
    if (err.code === "23505") {
      status = 409;
      message = "Duplicate record";
    }
    if (["23503", "23514", "22P02"].includes(err.code)) {
      status = 422;
      message = "Invalid related record or value";
    }
    if (err instanceof multer.MulterError) {
      status = err.code === "LIMIT_FILE_SIZE" ? 413 : 422;
      message = err.message;
    }
    if (status >= 500) {
      console.error(req.requestId, err.code ?? err.name);
      message = "Service unavailable";
    }
    res.status(status).json({
      error: {
        code: status === 500 ? "INTERNAL_ERROR" : String(status),
        message,
        details: err instanceof z.ZodError ? err.issues : undefined,
        request_id: req.requestId,
      },
    });
  });
  return app;
}
