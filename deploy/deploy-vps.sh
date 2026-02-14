#!/bin/bash
# ============================================
# Deploy AI Companion to VPS
# ============================================
# Usage: bash deploy/deploy-vps.sh [user@host]
# Example: bash deploy/deploy-vps.sh root@123.456.789.0

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET=${1:-""}

if [ -z "$TARGET" ]; then
    read -p "Enter VPS SSH target (e.g., root@123.456.789.0): " TARGET
fi

if [ -z "$TARGET" ]; then
    echo "❌ No SSH target provided."
    exit 1
fi

REMOTE_DIR="/root/ai-companion"

echo ""
echo "🚀 Deploying AI Companion to $TARGET:$REMOTE_DIR"
echo ""

# Create remote directory
ssh "$TARGET" "mkdir -p $REMOTE_DIR"

# Sync files (exclude node_modules, .git, state.json)
echo "📦 Uploading files..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'state.json' \
    --exclude '*.log' \
    --exclude 'booking-shots' \
    "$SCRIPT_DIR/" "$TARGET:$REMOTE_DIR/"

echo ""
echo "📦 Installing dependencies on VPS..."
ssh "$TARGET" "cd $REMOTE_DIR/virtual-home && npm install --production"
ssh "$TARGET" "cd $REMOTE_DIR/memory-system && npm install --production"
ssh "$TARGET" "cd $REMOTE_DIR/emotion && npm install --production"
ssh "$TARGET" "cd $REMOTE_DIR/fridge && npm install --production" 2>/dev/null || true
ssh "$TARGET" "cd $REMOTE_DIR/money && npm install --production" 2>/dev/null || true

echo ""
echo "🔧 Setting up PM2..."
ssh "$TARGET" "command -v pm2 || npm install -g pm2"

# Stop existing instance if running
ssh "$TARGET" "pm2 stop ai-companion 2>/dev/null || true"

# Start with PM2
ssh "$TARGET" "cd $REMOTE_DIR && pm2 start virtual-home/server/server.js --name ai-companion"
ssh "$TARGET" "pm2 save"

echo ""
echo "⏰ Setting up auto-activity cron..."
# Add crontab entry for auto-activity (every 10 minutes)
ssh "$TARGET" "
    CRON_CMD='*/10 * * * * cd $REMOTE_DIR && /usr/bin/node auto-activity/auto-activity.js >> /tmp/auto-activity.log 2>&1'
    (crontab -l 2>/dev/null | grep -v 'auto-activity.js'; echo \"\$CRON_CMD\") | crontab -
"

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║       Deployment Complete! 🎉          ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "🌐 Your virtual home is running at:"
echo "   http://$(echo $TARGET | cut -d'@' -f2):3000"
echo ""
echo "📋 Useful commands:"
echo "   pm2 logs ai-companion --lines 20"
echo "   pm2 restart ai-companion"
echo "   pm2 status"
echo ""
