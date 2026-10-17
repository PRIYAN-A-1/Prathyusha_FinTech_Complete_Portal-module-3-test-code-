// Disposable full-stack fixture. Never used by the app or production images.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";
import { createApp } from "../api/src/app.js";
const db = await PGlite.create();
const socket = new PGLiteSocketServer({
  db,
  port: 15433,
  host: "127.0.0.1",
  maxConnections: 30,
});
await socket.start();
const pool = new pg.Pool({
  connectionString: "postgres://postgres:testing@127.0.0.1:15433/postgres",
});
await pool.query(
  await readFile(new URL("../db/001_schema.sql", import.meta.url), "utf8"),
);
const uid = randomUUID();
await pool.query(
  "INSERT INTO users(id,email,password_hash,full_name,register_number,role,membership_status) VALUES($1,$2,$3,$4,$5,'STUDENT','APPROVED')",
  [
    uid,
    "student@example.edu",
    await bcrypt.hash("Test-password-123!", 4),
    "Test Student",
    "REG-TEST",
  ],
);
await pool.query("INSERT INTO profiles(user_id,display_name) VALUES($1,$2)", [
  uid,
  "Test Student",
]);
const temp = await mkdtemp(path.join(tmpdir(), "fintech-ui-"));
const java = spawn(
  "java",
  [
    "-jar",
    new URL("../runtime/fintech-auth-1.0.0.jar", import.meta.url).pathname,
    "--server.port=18081",
  ],
  {
    env: {
      ...process.env,
      JDBC_URL: "jdbc:postgresql://127.0.0.1:15433/postgres",
      DB_USER: "postgres",
      DB_PASSWORD: "testing",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
java.stdout.on("data", (b) => (logs += b));
java.stderr.on("data", (b) => (logs += b));
let ready = false;
for (let i = 0; i < 150; i++) {
  try {
    const r = await fetch("http://127.0.0.1:18081/health");
    if (r.ok && (await r.text()).includes("ready")) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
}
if (!ready) {
  console.error(logs);
  java.kill();
  process.exit(1);
}
const server = createApp({
  pool,
  authUrl: "http://127.0.0.1:18081",
  uploadDir: path.join(temp, "uploads"),
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
console.log(
  "READY_JSON:" +
    JSON.stringify({
      apiOrigin: `http://127.0.0.1:${server.address().port}`,
      authOrigin: "http://127.0.0.1:18081",
    }),
);
process.on("SIGTERM", async () => {
  await new Promise((r) => server.close(r));
  java.kill("SIGTERM");
  await new Promise((r) => java.once("exit", r));
  await pool.end();
  await socket.stop();
  await db.close();
  await rm(temp, { recursive: true, force: true });
  process.exit(0);
});
