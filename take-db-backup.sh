#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/backend/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

# Export only DB_* variables (full source fails due to special chars in other values)
while IFS='=' read -r key value; do
  [[ "$key" =~ ^DB_ ]] && export "$key=$value"
done < <(grep -E '^DB_' "$ENV_FILE")

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_FILE="$SCRIPT_DIR/backups/email_annotation_${TIMESTAMP}.dump"

echo "Backing up database '$DB_NAME' to $BACKUP_FILE ..."

PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -F c \
  -f "$BACKUP_FILE" \
  "$DB_NAME"

echo "Backup complete: $BACKUP_FILE"
