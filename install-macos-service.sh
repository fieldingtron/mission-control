#!/usr/bin/env bash
set -e

echo "🚀 Starting Mission Control macOS Service Installer..."

# Command existence check helper
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Dependency Checks
echo "🔍 Checking system dependencies..."

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js (e.g., via 'brew install node')."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

if ! command_exists caddy; then
    echo "⚠️ Caddy is not installed. Attempting to install via Homebrew..."
    if command_exists brew; then
        brew install caddy
    else
        echo "❌ Homebrew is not installed. Please install Caddy manually from https://caddyserver.com/."
        exit 1
    fi
fi


# 2. Build the project
echo "📦 Installing npm packages and compiling for production..."
npm install --ignore-scripts
npm run build

# 3. Plist Generation
echo "🔧 Generating Launch Agent plist file..."

PLIST_NAME="com.fieldingtron.mission-control"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/$PLIST_NAME.plist"
SCRIPT_PATH="$PWD/src/scripts/service-wrapper.js"
NODE_PATH=$(which node)

# Ensure the LaunchAgents directory exists
mkdir -p "$PLIST_DIR"

cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>

    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>--max-old-space-size=256</string>
        <string>$SCRIPT_PATH</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$PWD</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/tmp/$PLIST_NAME.log</string>
    
    <key>StandardErrorPath</key>
    <string>/tmp/$PLIST_NAME.error.log</string>
</dict>
</plist>
EOF

echo "✅ Generated $PLIST_PATH"

# 4. Service loading
echo "⚙️ Loading and starting the Launch Agent..."
launchctl bootout gui/$(id -u) "$PLIST_PATH" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST_PATH"
launchctl enable gui/$(id -u)/$PLIST_NAME

# 5. Verify Health automatically
echo "🧪 Invoking Automated Health Checks..."
node src/scripts/verify-service-health.js || true

echo "✅ Mission Control macOS background service has been installed and started!"
echo "📂 Monitor logs at: /tmp/$PLIST_NAME.log"
