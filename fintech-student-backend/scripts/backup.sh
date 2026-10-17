#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Export DATABASE_URL}"
: "${STORAGE_DIR:?Export STORAGE_DIR}"
backup_dir="${1:?Usage: backup.sh /absolute/backup/directory}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
backup_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
pg_dump --format=custom --file="$backup_dir/database-$backup_stamp.dump" "$DATABASE_URL"
tar -czf "$backup_dir/evidence-$backup_stamp.tar.gz" -C "$STORAGE_DIR" .
chmod 600 "$backup_dir/database-$backup_stamp.dump" "$backup_dir/evidence-$backup_stamp.tar.gz"
# Schedule during a maintenance window to keep file and database snapshots consistent.
