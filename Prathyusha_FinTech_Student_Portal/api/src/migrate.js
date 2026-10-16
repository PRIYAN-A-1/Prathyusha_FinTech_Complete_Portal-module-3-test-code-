import { readFile } from "node:fs/promises";
import { connect } from "./db.js";
const pool = connect(process.env.DATABASE_URL);
const c = await pool.connect();
try {
  await c.query("SELECT pg_advisory_lock(884011)");
  await c.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
  );
  if (
    !(await c.query("SELECT 1 FROM schema_migrations WHERE version='001'"))
      .rowCount
  ) {
    const sql = (
      await readFile(
        new URL("../../db/001_schema.sql", import.meta.url),
        "utf8",
      )
    )
      .replace(/^BEGIN;\s*/, "")
      .replace(/COMMIT;\s*$/, "");
    await c.query("BEGIN");
    try {
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations(version) VALUES('001')");
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  }
  console.log("Schema current");
} finally {
  await c.query("SELECT pg_advisory_unlock(884011)");
  c.release();
  await pool.end();
}
