#!/usr/bin/env bash
# Modul: Commit-Vorbereitung aus _uploades/ (prepare_upload_commit.sh)
# Zweck: Prüft alle Dateien in _uploades/, übernimmt sie in das Repository,
#   staged ausschließlich diese Dateien für Git und erstellt optional den Commit.
# Hinweis: Führt NIEMALS 'git push' aus (Push erfolgt manuell durch den Nutzer).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPLOAD_DIR="$ROOT_DIR/_uploades"

"$ROOT_DIR/scripts/verify_uploades.sh"

while IFS= read -r -d '' file; do
  rel="${file#"$UPLOAD_DIR"/}"
  dest="$ROOT_DIR/$rel"
  mkdir -p "$(dirname "$dest")"
  cp "$file" "$dest"
  git -C "$ROOT_DIR" add -- "$rel"
done < <(find "$UPLOAD_DIR" -type f -print0)

# Erneute Prüfung mit aktiver Staging-Area
"$ROOT_DIR/scripts/verify_uploades.sh"

echo "📦 Dateien aus '_uploades/' wurden geprüft und für Git gestaged:"
git -C "$ROOT_DIR" status --short
