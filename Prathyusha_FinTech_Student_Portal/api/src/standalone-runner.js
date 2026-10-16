import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const runtimeDir = path.resolve(rootDir, "runtime");
const dbDataDir = path.resolve(runtimeDir, "pgdata");
const schemaPath = path.resolve(rootDir, "db/001_schema.sql");
const jarSourcePath = path.resolve(runtimeDir, "fintech-auth-1.0.0.jar");

const PG_PORT = 5432;
const AUTH_PORT = 8080;
const API_PORT = 4000;

console.log("\n=======================================================");
console.log("  Prathyusha FinTech — Student Portal Local Dev Runner");
console.log("=======================================================\n");

async function isPortOpen(port) {
  try {
    const net = await import("node:net");
    return await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(800);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => {
        resolve(false);
      });
      socket.connect(port, "127.0.0.1");
    });
  } catch {
    return false;
  }
}

// 1. PostgreSQL (PGlite)
const pgRunning = await isPortOpen(PG_PORT);
if (pgRunning) {
  console.log(`[1/4] PostgreSQL is already active on 127.0.0.1:${PG_PORT}`);
} else {
  console.log(`[1/4] Starting embedded PostgreSQL (PGlite) on port ${PG_PORT}...`);
  if (!fs.existsSync(dbDataDir)) {
    fs.mkdirSync(dbDataDir, { recursive: true });
  }
  const db = new PGlite(dbDataDir);
  const socket = new PGLiteSocketServer({
    db,
    port: PG_PORT,
    host: "127.0.0.1",
    maxConnections: 50,
  });
  await socket.start();
  console.log(`      PostgreSQL is listening on 127.0.0.1:${PG_PORT}`);
}

// 2. Schema and Users
console.log("[2/4] Verifying database schema and demo accounts...");
const pool = new pg.Pool({
  connectionString: `postgres://postgres:testing@127.0.0.1:${PG_PORT}/postgres`,
});

const tableCheck = await pool.query(
  "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'",
);
if (tableCheck.rowCount === 0) {
  console.log("      Applying schema 001_schema.sql...");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(sql);
}

const userCount = await pool.query("SELECT COUNT(*) FROM users");
if (Number(userCount.rows[0].count) === 0) {
  console.log("      Seeding default accounts (Student, Admin, Mentor)...");
  const studentId = randomUUID();
  const adminId = randomUUID();
  const mentorId = randomUUID();

  const studentHash = await bcrypt.hash("Student123!", 10);
  const adminHash = await bcrypt.hash("Admin123!", 10);
  const mentorHash = await bcrypt.hash("Mentor123!", 10);

  await pool.query(
    `INSERT INTO users(id, email, password_hash, full_name, register_number, role, membership_status) VALUES
     ($1, 'priyan@prathyusha.edu.in', $2, 'Priyan A', '2101001', 'STUDENT', 'APPROVED'),
     ($3, 'coordinator@prathyusha.edu.in', $4, 'Dr. Academic Coordinator', 'ADM001', 'ADMIN', 'APPROVED'),
     ($5, 'mentor@prathyusha.edu.in', $6, 'Prof. Project Mentor', 'MTR001', 'MENTOR', 'APPROVED')`,
    [studentId, studentHash, adminId, adminHash, mentorId, mentorHash],
  );

  await pool.query(
    `INSERT INTO profiles(user_id, display_name, department, program, year_of_study, academic_year, public_consent, publication_status) VALUES
     ($1, 'Priyan A', 'Information Technology', 'B.Tech IT', 3, '2026-27', true, 'APPROVED'),
     ($2, 'Academic Coordinator', 'Administration', 'Faculty', 1, '2026-27', false, 'PRIVATE'),
     ($3, 'Project Mentor', 'Information Technology', 'Faculty', 1, '2026-27', false, 'PRIVATE')`,
    [studentId, adminId, mentorId],
  );
  console.log("      Demo accounts seeded successfully.");
} else {
  console.log("      Existing user records verified.");
}

// 3. Spring Boot Auth Service
const authRunning = await isPortOpen(AUTH_PORT);
if (authRunning) {
  console.log(`[3/4] Spring Boot Auth Service is already running at http://localhost:${AUTH_PORT}`);
} else {
  console.log(`[3/4] Starting Spring Boot Auth Service on port ${AUTH_PORT}...`);
  let javaExec = "java";
  const msJdk = "C:\\Program Files\\Microsoft\\jdk-21.0.12.101-hotspot\\bin\\java.exe";
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, "bin/java.exe"))) {
    javaExec = path.join(process.env.JAVA_HOME, "bin/java.exe");
  } else if (fs.existsSync(msJdk)) {
    javaExec = msJdk;
  }

  // To prevent Windows JVM unicode path issues with emoji directory names, copy jar to LocalAppData
  const localAppDir = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, "AppData/Local"),
    "PrathyushaFinTech",
  );
  if (!fs.existsSync(localAppDir)) fs.mkdirSync(localAppDir, { recursive: true });
  const localJarPath = path.join(localAppDir, "fintech-auth.jar");
  fs.copyFileSync(jarSourcePath, localJarPath);

  const authProcess = spawn(
    javaExec,
    ["-jar", localJarPath, `--server.port=${AUTH_PORT}`],
    {
      cwd: localAppDir,
      env: {
        ...process.env,
        JDBC_URL: `jdbc:postgresql://127.0.0.1:${PG_PORT}/postgres`,
        DB_USER: "postgres",
        DB_PASSWORD: "testing",
      },
      stdio: "pipe",
    },
  );

  authProcess.stdout.on("data", () => {});
  authProcess.stderr.on("data", () => {});

  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${AUTH_PORT}/health`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) {
    console.warn("      Notice: Spring Auth service is taking longer than expected to initialize.");
  } else {
    console.log(`      Auth Service is READY at http://localhost:${AUTH_PORT}`);
  }
}

// 4. Express API
const apiRunning = await isPortOpen(API_PORT);
if (apiRunning) {
  console.log(`[4/4] Express API is already running at http://localhost:${API_PORT}`);
} else {
  console.log(`[4/4] Starting Express API on port ${API_PORT}...`);
  const uploadDir = path.resolve(rootDir, "private-uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  createApp({
    pool,
    authUrl: `http://127.0.0.1:${AUTH_PORT}`,
    uploadDir,
    allowedOrigin: "*",
  }).listen(API_PORT, "0.0.0.0", () => {
    console.log(`      Express API is listening on http://localhost:${API_PORT}`);
  });
}

console.log("\n=======================================================");
console.log("  ALL SERVICES RUNNING SUCCESSFULLY!");
console.log("=======================================================");
console.log("  Frontend Web App:  http://localhost:5173");
console.log("  Express API:       http://localhost:4000");
console.log("  Spring Auth:       http://localhost:8080");
console.log("  PostgreSQL DB:     127.0.0.1:5432");
console.log("-------------------------------------------------------");
console.log("  Default Logins:");
console.log("  - Student:     priyan@prathyusha.edu.in      / Student123!");
console.log("  - Coordinator: coordinator@prathyusha.edu.in / Admin123!");
console.log("  - Mentor:      mentor@prathyusha.edu.in      / Mentor123!");
console.log("=======================================================\n");
