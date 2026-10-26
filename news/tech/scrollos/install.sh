#!/usr/bin/env bash
# ScrollOS — set up a home LLM machine on Ubuntu 24.04 and put the Scrolls on it.
#
#   curl -fsSL https://bboldt86.github.io/lanscape-navigator/news/tech/scrollos/install.sh -o install.sh
#   less install.sh          # read it first; it's short
#   bash install.sh          # add --kiosk to boot straight into the ScrollOS desktop
#
# What it does, in order:
#   1. NVIDIA driver (if an NVIDIA card is present and no driver is loaded)
#   2. Ollama, the local model server, as a systemd service on localhost:11434
#   3. Tells Ollama to accept requests from web pages (OLLAMA_ORIGINS) and to use memory well
#   4. Pulls the default model (gpt-oss:20b, 128K context, ~14 GB) — change with SCROLLOS_MODEL=...
#   5. Downloads the Scrolls (single HTML files) to ~/scrollos and serves them at http://localhost:8080
#   6. Optionally autostarts Chromium in kiosk mode on the ScrollOS desktop (--kiosk)
#   7. A nightly backup of the browser's local storage, where the Scrolls keep your data
# Nothing here talks to any cloud service except to download the software itself.
set -euo pipefail

MODEL="${SCROLLOS_MODEL:-gpt-oss:20b}"
DIR="${SCROLLOS_DIR:-$HOME/scrollos}"
PORT="${SCROLLOS_PORT:-8080}"
BASE="https://bboldt86.github.io/lanscape-navigator/news/tech/scrollos"
TOOLS="scrollos goals flashcards meals charts replies docs lab"
KIOSK=0; for a in "$@"; do [ "$a" = "--kiosk" ] && KIOSK=1; done

say() { printf '\n\033[1;35m⟐ %s\033[0m\n' "$*"; }
need() { command -v "$1" >/dev/null 2>&1; }

say "Basics"
sudo apt-get update -qq
sudo apt-get install -y -qq curl ca-certificates python3 pciutils

# 1. NVIDIA driver
if lspci | grep -qi nvidia; then
  if ! need nvidia-smi; then
    say "NVIDIA card found, no driver yet — installing the recommended one (a reboot will be needed)"
    sudo apt-get install -y -qq ubuntu-drivers-common
    sudo ubuntu-drivers install || echo "ubuntu-drivers could not pick a driver; install one from Software & Updates › Additional Drivers and re-run."
    NEED_REBOOT=1
  else
    say "NVIDIA driver present: $(nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader | head -1)"
  fi
else
  say "No NVIDIA card seen — Ollama will use the CPU (fine for small models, slow for big ones) or AMD ROCm if present"
fi

# 2. Ollama
if ! need ollama; then
  say "Installing Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
else
  say "Ollama already installed: $(ollama --version 2>/dev/null | head -1)"
fi

# 3. Let web pages talk to it, keep one model warm, use the KV cache efficiently
say "Configuring Ollama for ScrollOS"
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/scrollos.conf >/dev/null <<EOF
[Service]
# Pages opened from disk or from The Watch may call the local API (CORS). Tighten to specific origins if you prefer:
# Environment="OLLAMA_ORIGINS=http://localhost:${PORT},https://bboldt86.github.io"
Environment="OLLAMA_ORIGINS=*"
# Keep the model loaded between requests so the first token is quick
Environment="OLLAMA_KEEP_ALIVE=24h"
# Flash attention and an 8-bit KV cache: more context fits in the same memory
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="OLLAMA_KV_CACHE_TYPE=q8_0"
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now ollama
sudo systemctl restart ollama
sleep 2
curl -fsS http://localhost:11434/api/version >/dev/null && echo "Ollama answers on :11434" || { echo "Ollama is not answering on :11434 yet; check: journalctl -u ollama -e"; }

# 4. The model
say "Pulling $MODEL (this is the long part; ~14 GB for gpt-oss:20b)"
ollama pull "$MODEL"

# 5. The Scrolls
say "Downloading the Scrolls to $DIR"
mkdir -p "$DIR"
for t in $TOOLS; do curl -fsSL "$BASE/tools/$t.html" -o "$DIR/$t.html"; echo "  $t.html"; done
cat > "$DIR/README.txt" <<EOF
ScrollOS — the Scrolls live here as single HTML files.
Open http://localhost:$PORT/scrollos.html for the desktop, or any file directly.
Your data is in the browser's local storage; each tool has Export. Backups: $DIR/backups
New versions: re-run install.sh, or download fresh files from $BASE
EOF

say "Serving $DIR at http://localhost:$PORT (a user service; survives logout)"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/scrollos-web.service" <<EOF
[Unit]
Description=ScrollOS — serves the Scrolls on localhost:$PORT
After=network.target
[Service]
ExecStart=/usr/bin/python3 -m http.server $PORT --bind 127.0.0.1 --directory $DIR
Restart=always
[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now scrollos-web.service
loginctl enable-linger "$USER" >/dev/null 2>&1 || true

# 6. Kiosk
if [ "$KIOSK" = "1" ]; then
  say "Kiosk: Chromium will open the ScrollOS desktop full-screen at login"
  need chromium || need chromium-browser || sudo snap install chromium || sudo apt-get install -y -qq chromium-browser || true
  CHROME="$(command -v chromium || command -v chromium-browser || echo chromium)"
  mkdir -p "$HOME/.config/autostart"
  cat > "$HOME/.config/autostart/scrollos-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=ScrollOS
Exec=$CHROME --kiosk --noerrdialogs --disable-session-crashed-bubble --app=http://localhost:$PORT/scrollos.html
X-GNOME-Autostart-enabled=true
EOF
  echo "  (press Alt+F4 or F11 to leave the kiosk)"
fi

# 7. Nightly backup of browser local storage (where the Scrolls keep your data)
say "Nightly backup at 03:30 to $DIR/backups"
mkdir -p "$DIR/backups"
cat > "$DIR/backup.sh" <<'EOF'
#!/usr/bin/env bash
# Copies the browser profiles' Local Storage (the Scrolls' data) into a dated tarball; keeps 30 days.
set -e
OUT="$(dirname "$0")/backups"; mkdir -p "$OUT"
SRC=""
for d in "$HOME/.config/chromium/Default" "$HOME/snap/chromium/common/chromium/Default" "$HOME/.config/google-chrome/Default" "$HOME/.mozilla/firefox"; do [ -d "$d" ] && SRC="$SRC $d"; done
[ -n "$SRC" ] && tar -czf "$OUT/scrollos-$(date +%F).tgz" $SRC 2>/dev/null || true
find "$OUT" -name 'scrollos-*.tgz' -mtime +30 -delete
EOF
chmod +x "$DIR/backup.sh"
( crontab -l 2>/dev/null | grep -v scrollos/backup.sh; echo "30 3 * * * $DIR/backup.sh" ) | crontab -

say "Done."
echo "  Desktop:   http://localhost:$PORT/scrollos.html"
echo "  Model:     $MODEL on http://localhost:11434   (ollama list · ollama ps)"
echo "  Files:     $DIR"
echo "  Test it:   open the AI Lab › Machine › Run the test, and read your real tokens per second"
[ "${NEED_REBOOT:-0}" = "1" ] && echo "  Reboot now so the NVIDIA driver loads, then re-run: ollama run $MODEL"
exit 0
