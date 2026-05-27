#!/usr/bin/env bash
# install.sh — SnowRaven one-command installer for Raspberry Pi / Debian / Ubuntu
# https://github.com/dtgibson/snowraven
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/dtgibson/snowraven/main/install.sh | bash
#   bash install.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
REPO_URL="https://github.com/dtgibson/snowraven.git"
# NodeSource setup script — update here if NodeSource changes their URL
NODESOURCE_URL="https://deb.nodesource.com/setup_20.x"
DEFAULT_INSTALL_DIR="$HOME/snowraven"
MIN_NODE_VERSION=18

# ---------------------------------------------------------------------------
# State (populated during main flow)
# ---------------------------------------------------------------------------
INSTALL_DIR=""
INSTALL_MODE=""
STEP_NUM=0
TOTAL_STEPS=5
STEP_NAME="startup"
READ_RESULT=""

# ---------------------------------------------------------------------------
# Colors (disabled when stdout is not a terminal)
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
    GRN='\033[0;32m'
    CYN='\033[0;36m'
    BLD='\033[1m'
    DIM='\033[2m'
    RST='\033[0m'
else
    GRN='' CYN='' BLD='' DIM='' RST=''
fi

# ---------------------------------------------------------------------------
# Error trap — names the step that failed so the user knows where to look
# ---------------------------------------------------------------------------
on_error() {
    echo -e "\n  ✗ Installation failed during: ${STEP_NAME}"
    echo -e "    Check the output above, then re-run the installer.\n"
}
trap 'on_error' ERR

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
step() {
    STEP_NAME="$2"
    STEP_NUM=$(( STEP_NUM + 1 ))
    echo -e "\n${CYN}[${STEP_NUM}/${TOTAL_STEPS}]${RST} $1"
}

ok()   { echo -e "  ${GRN}✓${RST} $1"; }
note() { echo -e "  ${DIM}  $1${RST}"; }

# read_input — interactive prompt that works even when stdin is a pipe (curl | bash)
# Sets global READ_RESULT.
read_input() {
    local prompt="$1"
    READ_RESULT=""
    if [[ -t 0 ]]; then
        read -rp "  ${prompt}" READ_RESULT || true
    else
        # When piped from curl, stdin is the script itself — read from the terminal directly
        read -rp "  ${prompt}" READ_RESULT < /dev/tty || true
    fi
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
print_banner() {
    echo -e "${GRN}"
    cat << 'BANNER'
  ███████╗███╗   ██╗ ██████╗ ██╗    ██╗██████╗  █████╗ ██╗   ██╗███████╗███╗   ██╗
  ██╔════╝████╗  ██║██╔═══██╗██║    ██║██╔══██╗██╔══██╗██║   ██║██╔════╝████╗  ██║
  ███████╗██╔██╗ ██║██║   ██║██║ █╗ ██║██████╔╝███████║██║   ██║█████╗  ██╔██╗ ██║
  ╚════██║██║╚██╗██║██║   ██║██║███╗██║██╔══██╗██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║
  ███████║██║ ╚████║╚██████╔╝╚███╔███╔╝██║  ██║██║  ██║ ╚████╔╝ ███████╗██║ ╚████║
  ╚══════╝╚═╝  ╚═══╝ ╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝
BANNER
    echo -e "${RST}"
    echo "  Your backyard bird data, on your own server."
    echo ""
}

# ---------------------------------------------------------------------------
# Pre-flight checks (run before anything modifies the system)
# ---------------------------------------------------------------------------
preflight_checks() {
    STEP_NAME="pre-flight checks"
    echo "Checking system requirements..."

    # OS check — must be Debian, Ubuntu, or a derivative (including Raspberry Pi OS)
    if [[ ! -f /etc/os-release ]]; then
        echo "  ✗ Cannot detect OS — /etc/os-release not found."
        echo "  This installer supports Debian and Ubuntu (including Raspberry Pi OS)."
        echo "  No changes were made to your system."
        exit 1
    fi

    . /etc/os-release
    if ! echo "${ID:-} ${ID_LIKE:-}" | grep -qiE 'debian|ubuntu|raspbian'; then
        echo "  ✗ Unsupported OS: ${PRETTY_NAME:-${ID:-unknown}}"
        echo "  This installer supports Debian and Ubuntu (including Raspberry Pi OS)."
        echo "  No changes were made to your system."
        exit 1
    fi
    ok "OS: ${PRETTY_NAME:-${ID:-}}"

    # sudo check
    if ! command -v sudo &>/dev/null; then
        echo "  ✗ sudo not found. Install sudo or re-run as root."
        echo "  No changes were made to your system."
        exit 1
    fi
    ok "sudo available"
}

# ---------------------------------------------------------------------------
# Mode selection
# ---------------------------------------------------------------------------
select_mode() {
    echo ""
    echo "How would you like to install SnowRaven?"
    echo ""
    echo "  1) Service install  — runs automatically on boot (recommended for Pi)"
    echo "  2) Local install    — set up dependencies; you start it manually"
    echo ""

    local attempts=0
    while true; do
        read_input "Enter 1 or 2: "
        case "$READ_RESULT" in
            1)
                INSTALL_MODE="service"
                TOTAL_STEPS=6
                ok "Service install selected"
                break
                ;;
            2)
                INSTALL_MODE="local"
                TOTAL_STEPS=5
                ok "Local install selected"
                break
                ;;
            *)
                attempts=$(( attempts + 1 ))
                if (( attempts >= 2 )); then
                    echo "  ✗ Invalid input. Re-run the installer and enter 1 or 2."
                    exit 1
                fi
                echo "  Please enter 1 or 2."
                ;;
        esac
    done
}

# ---------------------------------------------------------------------------
# Install directory selection
# ---------------------------------------------------------------------------
select_install_dir() {
    echo ""
    read_input "Install directory [${DEFAULT_INSTALL_DIR}]: "
    INSTALL_DIR="${READ_RESULT:-$DEFAULT_INSTALL_DIR}"
    ok "Install directory: ${INSTALL_DIR}"
}

# ---------------------------------------------------------------------------
# Step 1 — System dependencies
# ---------------------------------------------------------------------------
install_dependencies() {
    step "Installing system packages..." "dependency installation"

    sudo apt-get update -y -qq
    sudo apt-get install -y -qq git python3 python3-pip python3-venv
    ok "git, python3, python3-pip, python3-venv"

    # Check for Node.js >= MIN_NODE_VERSION; install Node.js 20 via NodeSource if needed
    if command -v node &>/dev/null; then
        local node_major
        node_major=$(node --version | sed 's/v\([0-9]*\).*/\1/')
        if (( node_major >= MIN_NODE_VERSION )); then
            ok "Node.js $(node --version)"
            return
        fi
        note "Node.js $(node --version) found but version ${MIN_NODE_VERSION}+ is required — upgrading..."
    else
        note "Node.js not found — installing Node.js 20 LTS via NodeSource..."
    fi

    # NodeSource adds a signed apt repository for Node.js
    curl -fsSL "${NODESOURCE_URL}" | sudo -E bash - > /dev/null 2>&1
    sudo apt-get install -y -qq nodejs
    ok "Node.js $(node --version)"
}

# ---------------------------------------------------------------------------
# Step 2 — Repository
# ---------------------------------------------------------------------------
setup_repo() {
    step "Setting up SnowRaven repository..." "repository setup"

    if [[ -d "$INSTALL_DIR" && -f "$INSTALL_DIR/start.sh" ]]; then
        echo ""
        note "SnowRaven is already installed at ${INSTALL_DIR}."
        read_input "Update the existing install? [y/N]: "
        if [[ ! "${READ_RESULT:-N}" =~ ^[Yy]$ ]]; then
            echo "  Aborting. Your existing install was not changed."
            exit 0
        fi
        note "Updating repository..."
        git -C "$INSTALL_DIR" pull
    else
        git clone "$REPO_URL" "$INSTALL_DIR"
    fi

    ok "Repository ready at ${INSTALL_DIR}"
}

# ---------------------------------------------------------------------------
# Step 3 — Frontend build
# ---------------------------------------------------------------------------
build_frontend() {
    step "Building frontend (this may take a minute)..." "frontend build"

    cd "${INSTALL_DIR}/frontend"
    npm ci --silent
    npm run build --silent
    ok "Frontend built"
}

# ---------------------------------------------------------------------------
# Step 4 — Python virtual environment
# ---------------------------------------------------------------------------
setup_python() {
    step "Setting up Python environment..." "Python environment setup"

    python3 -m venv "${INSTALL_DIR}/backend/.venv"
    "${INSTALL_DIR}/backend/.venv/bin/pip" install -q -r "${INSTALL_DIR}/backend/requirements.txt"
    ok "Python environment ready"
}

# ---------------------------------------------------------------------------
# Step 5 — API key configuration
# ---------------------------------------------------------------------------
configure_env() {
    step "Configuring API keys..." "API key configuration"

    local env_file="${INSTALL_DIR}/backend/.env"

    if [[ -f "$env_file" ]]; then
        ok "Existing .env found — leaving it in place."
        note "To update your keys, edit ${env_file} or use the Settings tab in the app."
        return
    fi

    echo ""
    note "You can press Enter to skip either key and add it later in the app's Settings."
    echo ""

    local ebird_key="" openweather_key=""
    read_input "eBird API key (Enter to skip): "
    ebird_key="$READ_RESULT"

    read_input "OpenWeather API key (Enter to skip): "
    openweather_key="$READ_RESULT"

    printf 'EBIRD_API_KEY=%s\nOPENWEATHER_API_KEY=%s\n' \
        "${ebird_key}" "${openweather_key}" > "$env_file"
    chmod 600 "$env_file"

    ok ".env written"
}

# ---------------------------------------------------------------------------
# Step 6 — Systemd service (service mode only)
# ---------------------------------------------------------------------------
install_service() {
    step "Installing systemd service..." "service installation"

    local service_src="${INSTALL_DIR}/deploy/snowraven.service"
    local service_dst="/etc/systemd/system/snowraven.service"

    # Substitute hardcoded 'pi' user and paths with the current user and install dir
    sed \
        -e "s|User=pi|User=${USER}|g" \
        -e "s|/home/pi/snowraven|${INSTALL_DIR}|g" \
        "$service_src" | sudo tee "$service_dst" > /dev/null

    ok "Service file written"

    sudo systemctl daemon-reload
    sudo systemctl enable snowraven
    ok "Service enabled (will start on boot)"

    # Start and verify — on failure, print logs and give a clear next step
    if ! sudo systemctl start snowraven; then
        echo ""
        echo "  ✗ Service failed to start. Last 20 log lines:"
        echo ""
        sudo journalctl -u snowraven -n 20 --no-pager || true
        echo ""
        echo "  Check your API keys in the Settings tab, then run:"
        echo "    sudo systemctl start snowraven"
        exit 1
    fi

    ok "Service is running"
}

# ---------------------------------------------------------------------------
# Success message
# ---------------------------------------------------------------------------
print_success() {
    local host_url lan_ip lan_url
    host_url="http://$(hostname).local:1620"
    lan_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    lan_url="http://${lan_ip}:1620"

    echo ""
    echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo -e "${BLD}  ✓ SnowRaven installed successfully!${RST}"
    echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo ""

    if [[ "$INSTALL_MODE" == "service" ]]; then
        echo "  Mode: Service install — SnowRaven starts automatically on boot."
    else
        echo "  Mode: Local install."
        echo ""
        echo "  To start SnowRaven:"
        echo -e "    ${BLD}cd ${INSTALL_DIR} && ./start.sh${RST}"
    fi

    echo ""
    echo "  Open in your browser:"
    echo -e "    → ${CYN}${host_url}${RST}  (requires mDNS / Avahi on your network)"
    echo -e "    → ${CYN}${lan_url}${RST}"
    echo ""
    echo "  API keys and data files: Settings tab in the app."
    echo ""
    echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    echo ""
}

# ---------------------------------------------------------------------------
# Entry point — all logic is inside main() so a partial download via
# `curl | bash` cannot execute an incomplete script.
# ---------------------------------------------------------------------------
main() {
    print_banner
    preflight_checks
    select_mode
    select_install_dir
    install_dependencies
    setup_repo
    build_frontend
    setup_python
    configure_env
    [[ "$INSTALL_MODE" == "service" ]] && install_service
    print_success
}

main "$@"
