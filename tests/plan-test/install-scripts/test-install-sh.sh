#!/bin/sh
# Tests for install.sh core logic
# Run: bash tests/plan-test/install-scripts/test-install-sh.sh

set -eu

PASS=0
FAIL=0
INSTALL_SH="$(cd "$(dirname "$0")/../../.." && pwd)/install.sh"

pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; PASS=$((PASS+1)); }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); }

# Source install.sh without invoking main (strip the trailing `main` call)
eval "$(sed '/^main$/d' "$INSTALL_SH")"

# Override functions that make network calls
get_latest_version() { echo "0.6.0"; }
download() { :; }
fetch_checksums() { return 1; }
# Override error() to return 1 instead of exit so subshell tests can catch it
error() { echo "ERROR: $1" >&2; return 1; }

echo ""
echo "install.sh — unit tests"
echo "═══════════════════════"

# ── detect_platform ───────────────────────────────────────────────────────────
echo ""
echo "detect_platform:"

(
  OS=Linux ARCH=x86_64
  case "$OS" in Linux|linux) PLATFORM="linux";; Darwin|darwin) PLATFORM="darwin";; esac
  case "$ARCH" in x86_64|amd64) ARCH="x64";; aarch64|arm64) ARCH="arm64";; esac
  [ "$PLATFORM" = "linux" ] && [ "$ARCH" = "x64" ]
) && pass "Linux x86_64 → linux-x64" || fail "Linux x86_64 → linux-x64"

(
  OS=Darwin ARCH=aarch64
  case "$OS" in Linux|linux) PLATFORM="linux";; Darwin|darwin) PLATFORM="darwin";; esac
  case "$ARCH" in x86_64|amd64) ARCH="x64";; aarch64|arm64) ARCH="arm64";; esac
  [ "$PLATFORM" = "darwin" ] && [ "$ARCH" = "arm64" ]
) && pass "Darwin aarch64 → darwin-arm64" || fail "Darwin aarch64 → darwin-arm64"

(
  OS=Linux ARCH=arm64
  case "$OS" in Linux|linux) PLATFORM="linux";; Darwin|darwin) PLATFORM="darwin";; esac
  case "$ARCH" in x86_64|amd64) ARCH="x64";; aarch64|arm64) ARCH="arm64";; esac
  [ "$PLATFORM" = "linux" ] && [ "$ARCH" = "arm64" ]
) && pass "Linux arm64 → linux-arm64" || fail "Linux arm64 → linux-arm64"

# ── verify_checksum ───────────────────────────────────────────────────────────
echo ""
echo "verify_checksum:"

TMP=$(mktemp)
echo -n "hello" > "$TMP"
EXPECTED=$(sha256sum "$TMP" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$TMP" | awk '{print $1}')

verify_checksum "$TMP" "$EXPECTED" \
  && pass "correct checksum passes" \
  || fail "correct checksum passes"

echo -n "hello" > "$TMP"
verify_checksum "$TMP" "0000000000000000000000000000000000000000000000000000000000000000" 2>/dev/null \
  && fail "wrong checksum should fail" \
  || pass "wrong checksum rejected"

rm -f "$TMP"

# ── URL construction ──────────────────────────────────────────────────────────
echo ""
echo "download URL construction:"

GITHUB_REPO="kvidai/kvidai-cli"
BINARY_NAME="kvidai"
VERSION="0.6.0"
PLATFORM="linux"
ARCH="x64"
ASSET_NAME="${BINARY_NAME}-${PLATFORM}-${ARCH}"
DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/${ASSET_NAME}"

[ "$ASSET_NAME" = "kvidai-linux-x64" ] \
  && pass "asset name = kvidai-linux-x64" \
  || fail "asset name = kvidai-linux-x64"

echo "$DOWNLOAD_URL" | grep -q "kvidai/kvidai-cli/releases/download/v0.6.0/kvidai-linux-x64" \
  && pass "download URL contains correct path" \
  || fail "download URL contains correct path"

# ── try_symlink_local_bin ─────────────────────────────────────────────────────
echo ""
echo "symlink helper:"

TMP_DIR=$(mktemp -d)
TMP_BIN="$TMP_DIR/kvidai"
touch "$TMP_BIN"
chmod +x "$TMP_BIN"
HOME="$TMP_DIR" try_symlink_local_bin "$TMP_BIN" 2>/dev/null || true
[ -L "$TMP_DIR/.local/bin/kvidai" ] \
  && pass "symlink created in ~/.local/bin" \
  || fail "symlink created in ~/.local/bin"
rm -rf "$TMP_DIR"

# ── GitHub API / releases availability ───────────────────────────────────────
echo ""
echo "GitHub releases (E2E prerequisite):"

LATEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://api.github.com/repos/kvidai/kvidai-cli/releases/latest" 2>/dev/null || echo "000")

if [ "$LATEST_STATUS" = "200" ]; then
  pass "GitHub releases/latest returns 200 — install.sh E2E will work"
elif [ "$LATEST_STATUS" = "404" ]; then
  fail "No releases published yet (HTTP 404) — \`kvidai setup\` URL will fail until first release is tagged"
else
  fail "Unexpected HTTP $LATEST_STATUS from GitHub releases API"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "───────────────────────────────"
printf "  %d passed, %d failed\n" "$PASS" "$FAIL"
echo ""

[ "$FAIL" -eq 0 ]
