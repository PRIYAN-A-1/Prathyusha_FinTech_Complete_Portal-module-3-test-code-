import { createApp } from "./app.js";
import { connect } from "./db.js";
const pool = connect(
  process.env.DATABASE_URL ??
    "postgres://fintech:fintech@localhost:5432/fintech",
);
const server = createApp({
  pool,
  authUrl: process.env.AUTH_URL ?? "http://localhost:8080",
  uploadDir: process.env.UPLOAD_DIR ?? "./private-uploads",
  allowedOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
}).listen(Number(process.env.PORT ?? 4000), "0.0.0.0", () =>
  console.log("Student API listening"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
