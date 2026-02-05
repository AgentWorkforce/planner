#!/bin/bash
# Development environment startup script
# Manages: agent-relay daemon, backend API, frontend UI

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Load .env file if it exists
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[dev]${NC} $1"; }
success() { echo -e "${GREEN}[dev]${NC} $1"; }
warn() { echo -e "${YELLOW}[dev]${NC} $1"; }
error() { echo -e "${RED}[dev]${NC} $1"; }

# PID files for tracking our processes
BACKEND_PID_FILE="$PROJECT_DIR/.dev-backend.pid"
FRONTEND_PID_FILE="$PROJECT_DIR/.dev-frontend.pid"
IDEATION_FRONTEND_PID_FILE="$PROJECT_DIR/.dev-ideation-frontend.pid"
FORGE_FRONTEND_PID_FILE="$PROJECT_DIR/.dev-forge-frontend.pid"

# Check if a process is running
is_running() {
    local pid=$1
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        return 0
    fi
    return 1
}

# Stop a process by PID file
stop_process() {
    local pid_file=$1
    local name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if is_running "$pid"; then
            log "Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            # Wait for graceful shutdown
            for i in {1..10}; do
                if ! is_running "$pid"; then
                    break
                fi
                sleep 0.5
            done
            # Force kill if still running
            if is_running "$pid"; then
                kill -9 "$pid" 2>/dev/null || true
            fi
            success "$name stopped"
        fi
        rm -f "$pid_file"
    fi
}

# Check agent-relay daemon status
check_relay() {
    agent-relay status 2>/dev/null | grep -qi "running" && return 0 || return 1
}

# Start agent-relay daemon
start_relay() {
    if check_relay; then
        success "Agent-relay daemon already running"
    else
        log "Starting agent-relay daemon..."
        agent-relay up --dashboard &
        sleep 2
        if check_relay; then
            success "Agent-relay daemon started"
        else
            error "Failed to start agent-relay daemon"
            return 1
        fi
    fi
}

# Stop agent-relay daemon
stop_relay() {
    if check_relay; then
        log "Stopping agent-relay daemon..."
        agent-relay down
        success "Agent-relay daemon stopped"
    fi
}

# Start backend
start_backend() {
    stop_process "$BACKEND_PID_FILE" "backend"

    # Check if port 3001 is in use
    if lsof -i :3001 >/dev/null 2>&1; then
        warn "Port 3001 already in use, attempting to free..."
        lsof -ti :3001 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    log "Starting backend API server..."
    npm run start --prefix "$PROJECT_DIR/packages/server" > "$PROJECT_DIR/.dev-backend.log" 2>&1 &
    local pid=$!
    echo "$pid" > "$BACKEND_PID_FILE"

    # Wait for server to be ready
    for i in {1..30}; do
        if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
            success "Backend API running at http://localhost:3001"
            return 0
        fi
        sleep 1
    done

    error "Backend failed to start. Check $PROJECT_DIR/.dev-backend.log"
    return 1
}

# Start frontend
start_frontend() {
    stop_process "$FRONTEND_PID_FILE" "frontend"

    # Check if port 3000 is in use
    if lsof -i :3000 >/dev/null 2>&1; then
        warn "Port 3000 already in use, attempting to free..."
        lsof -ti :3000 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    log "Starting frontend dev server..."
    cd "$PROJECT_DIR/packages/planner-ui"
    npm run dev > "$PROJECT_DIR/.dev-frontend.log" 2>&1 &
    local pid=$!
    echo "$pid" > "$FRONTEND_PID_FILE"
    cd "$PROJECT_DIR"

    # Wait for server to be ready
    for i in {1..30}; do
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            success "Frontend running at http://localhost:3000"
            return 0
        fi
        sleep 1
    done

    error "Frontend failed to start. Check $PROJECT_DIR/.dev-frontend.log"
    return 1
}

# Start ideation frontend
start_ideation_frontend() {
    stop_process "$IDEATION_FRONTEND_PID_FILE" "ideation-frontend"

    # Check if port 3002 is in use
    if lsof -i :3002 >/dev/null 2>&1; then
        warn "Port 3002 already in use, attempting to free..."
        lsof -ti :3002 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    log "Starting ideation frontend dev server..."
    cd "$PROJECT_DIR/packages/ideation-ui"
    npm run dev > "$PROJECT_DIR/.dev-ideation-frontend.log" 2>&1 &
    local pid=$!
    echo "$pid" > "$IDEATION_FRONTEND_PID_FILE"
    cd "$PROJECT_DIR"

    # Wait for server to be ready
    for i in {1..30}; do
        if curl -s http://localhost:3002 >/dev/null 2>&1; then
            success "Ideation frontend running at http://localhost:3002"
            return 0
        fi
        sleep 1
    done

    error "Ideation frontend failed to start. Check $PROJECT_DIR/.dev-ideation-frontend.log"
    return 1
}

# Start forge frontend
start_forge_frontend() {
    stop_process "$FORGE_FRONTEND_PID_FILE" "forge-frontend"

    # Check if port 3003 is in use
    if lsof -i :3003 >/dev/null 2>&1; then
        warn "Port 3003 already in use, attempting to free..."
        lsof -ti :3003 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    log "Starting forge frontend dev server..."
    cd "$PROJECT_DIR/packages/forge-ui"
    npm run dev > "$PROJECT_DIR/.dev-forge-frontend.log" 2>&1 &
    local pid=$!
    echo "$pid" > "$FORGE_FRONTEND_PID_FILE"
    cd "$PROJECT_DIR"

    # Wait for server to be ready
    for i in {1..30}; do
        if curl -s http://localhost:3003 >/dev/null 2>&1; then
            success "Forge frontend running at http://localhost:3003"
            return 0
        fi
        sleep 1
    done

    error "Forge frontend failed to start. Check $PROJECT_DIR/.dev-forge-frontend.log"
    return 1
}

# Show status
show_status() {
    echo ""
    log "=== Development Environment Status ==="
    echo ""

    # Relay status
    if check_relay; then
        success "Agent-relay: running"
    else
        warn "Agent-relay: not running"
    fi

    # Backend status
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        if is_running "$pid" && curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
            success "Backend API: running (PID: $pid) at http://localhost:3001"
        else
            warn "Backend API: not running"
        fi
    else
        warn "Backend API: not running"
    fi

    # Frontend status
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if is_running "$pid" && curl -s http://localhost:3000 >/dev/null 2>&1; then
            success "Planner UI: running (PID: $pid) at http://localhost:3000"
        else
            warn "Planner UI: not running"
        fi
    else
        warn "Planner UI: not running"
    fi

    # Ideation frontend status
    if [ -f "$IDEATION_FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$IDEATION_FRONTEND_PID_FILE")
        if is_running "$pid" && curl -s http://localhost:3002 >/dev/null 2>&1; then
            success "Ideation UI: running (PID: $pid) at http://localhost:3002"
        else
            warn "Ideation UI: not running"
        fi
    else
        warn "Ideation UI: not running"
    fi

    # Forge frontend status
    if [ -f "$FORGE_FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FORGE_FRONTEND_PID_FILE")
        if is_running "$pid" && curl -s http://localhost:3003 >/dev/null 2>&1; then
            success "Forge UI: running (PID: $pid) at http://localhost:3003"
        else
            warn "Forge UI: not running"
        fi
    else
        warn "Forge UI: not running"
    fi

    echo ""
}

# Main commands
case "${1:-start}" in
    start)
        log "Starting development environment..."
        echo ""
        start_relay
        start_backend
        start_frontend
        start_ideation_frontend
        start_forge_frontend
        show_status
        success "Development environment ready!"
        echo ""
        log "Logs:"
        log "  Backend:           tail -f $PROJECT_DIR/.dev-backend.log"
        log "  Planner UI:        tail -f $PROJECT_DIR/.dev-frontend.log"
        log "  Ideation UI:       tail -f $PROJECT_DIR/.dev-ideation-frontend.log"
        log "  Forge UI:          tail -f $PROJECT_DIR/.dev-forge-frontend.log"
        echo ""
        ;;
    stop)
        log "Stopping development environment..."
        stop_process "$FORGE_FRONTEND_PID_FILE" "forge-frontend"
        stop_process "$IDEATION_FRONTEND_PID_FILE" "ideation-frontend"
        stop_process "$FRONTEND_PID_FILE" "frontend"
        stop_process "$BACKEND_PID_FILE" "backend"
        stop_relay
        success "Development environment stopped"
        ;;
    restart)
        log "Restarting development environment..."
        "$0" stop
        sleep 1
        "$0" start
        ;;
    status)
        show_status
        ;;
    relay)
        case "${2:-start}" in
            start) start_relay ;;
            stop) stop_relay ;;
            restart) stop_relay; sleep 1; start_relay ;;
            *) log "Usage: $0 relay [start|stop|restart]" ;;
        esac
        ;;
    backend)
        case "${2:-start}" in
            start) start_backend ;;
            stop) stop_process "$BACKEND_PID_FILE" "backend" ;;
            restart) stop_process "$BACKEND_PID_FILE" "backend"; sleep 1; start_backend ;;
            logs) tail -f "$PROJECT_DIR/.dev-backend.log" ;;
            *) log "Usage: $0 backend [start|stop|restart|logs]" ;;
        esac
        ;;
    frontend)
        case "${2:-start}" in
            start) start_frontend ;;
            stop) stop_process "$FRONTEND_PID_FILE" "frontend" ;;
            restart) stop_process "$FRONTEND_PID_FILE" "frontend"; sleep 1; start_frontend ;;
            logs) tail -f "$PROJECT_DIR/.dev-frontend.log" ;;
            *) log "Usage: $0 frontend [start|stop|restart|logs]" ;;
        esac
        ;;
    ideation)
        case "${2:-start}" in
            start) start_ideation_frontend ;;
            stop) stop_process "$IDEATION_FRONTEND_PID_FILE" "ideation-frontend" ;;
            restart) stop_process "$IDEATION_FRONTEND_PID_FILE" "ideation-frontend"; sleep 1; start_ideation_frontend ;;
            logs) tail -f "$PROJECT_DIR/.dev-ideation-frontend.log" ;;
            *) log "Usage: $0 ideation [start|stop|restart|logs]" ;;
        esac
        ;;
    forge)
        case "${2:-start}" in
            start) start_forge_frontend ;;
            stop) stop_process "$FORGE_FRONTEND_PID_FILE" "forge-frontend" ;;
            restart) stop_process "$FORGE_FRONTEND_PID_FILE" "forge-frontend"; sleep 1; start_forge_frontend ;;
            logs) tail -f "$PROJECT_DIR/.dev-forge-frontend.log" ;;
            *) log "Usage: $0 forge [start|stop|restart|logs]" ;;
        esac
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo "       $0 relay {start|stop|restart}"
        echo "       $0 backend {start|stop|restart|logs}"
        echo "       $0 frontend {start|stop|restart|logs}"
        echo "       $0 ideation {start|stop|restart|logs}"
        echo "       $0 forge {start|stop|restart|logs}"
        exit 1
        ;;
esac
