#!/usr/bin/env bash
# Modul: Sicherheits- & Qualitätsprüfung für _Upload/ (verify_uploades.sh)
# Zweck: Prüft vor jedem Commit und Push, dass ausschließlich geprüfte Dateien
#   aus _Upload/ ohne Geheimnisse, Syntaxfehler oder iOS-Anti-Patterns vorliegen.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPLOAD_DIR="$ROOT_DIR/_Upload"

if [[ ! -d "$UPLOAD_DIR" ]]; then
  echo "❌ Fehler: Ordner '_Upload/' fehlt. Bitte zuerst '_Upload/' befüllen." >&2
  exit 1
fi

UPLOAD_FILES=()
while IFS= read -r -d '' file; do
  rel="${file#"$UPLOAD_DIR"/}"
  UPLOAD_FILES+=("$rel")
done < <(find "$UPLOAD_DIR" -type f -print0)

if [[ ${#UPLOAD_FILES[@]} -eq 0 ]]; then
  echo "❌ Fehler: '_Upload/' ist leer. Nichts zum Prüfen vorhanden." >&2
  exit 1
fi

echo "🔍 Prüfe ${#UPLOAD_FILES[@]} Datei(en) in '_Upload/'..."

for rel in "${UPLOAD_FILES[@]}"; do
  target="$UPLOAD_DIR/$rel"

  # 1. Verbotene Dateien (.env, .DS_Store, Keys)
  case "$rel" in
    *.env|*.env.*|*.pem|*.key|*.DS_Store|*/.DS_Store)
      if [[ "$rel" != ".env.example" ]]; then
        echo "🚨 Blocker: Verbotene Datei in '_Upload/': $rel" >&2
        exit 1
      fi
      ;;
  esac

  # 2. Einfacher Secret-Scan
  if grep -E -q "(AIza[0-9A-Za-z_-]{35}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[0-9A-Za-z]{36}|sk-[0-9A-Za-z]{20,})" "$target"; then
    echo "🚨 Blocker: Mögliches Secret / API-Key in '$rel' gefunden!" >&2
    exit 1
  fi

  # 3. JavaScript-Syntaxprüfung
  if [[ "$rel" == *.js ]]; then
    node --check "$target"
  fi

  # 4. iOS-PWA-Regel: kein black-translucent Meta-Tag
  if [[ "$rel" == *.html ]]; then
    if grep -q "black-translucent" "$target"; then
      echo "🚨 Blocker: Verbotenes 'black-translucent' Meta-Tag in '$rel' gefunden!" >&2
      exit 1
    fi
  fi
done

# 5. Abgleich mit Git-Staging-Area (falls Dateien gestaged sind)
if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  STAGED_FILES=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && STAGED_FILES+=("$line")
  done < <(git -C "$ROOT_DIR" diff --cached --name-only --diff-filter=ACMR)

  if [[ ${#STAGED_FILES[@]} -gt 0 ]]; then
    for staged in "${STAGED_FILES[@]}"; do
      if [[ ! -f "$UPLOAD_DIR/$staged" ]]; then
        echo "🚨 Blocker: Gestagete Datei '$staged' liegt NICHT in '_Upload/'!" >&2
        echo "   Nur Dateien aus '_Upload/' dürfen committet werden." >&2
        exit 1
      fi
    done
  fi
fi

echo "✅ Alle ${#UPLOAD_FILES[@]} Datei(en) in '_Upload/' erfolgreich geprüft."
