#!/bin/bash
# ============================================
# AI Companion Template — One-Click Setup
# ============================================
# Usage: bash setup.sh
# Prerequisites: Node.js 18+, npm

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   AI Companion Template — Setup Wizard   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ============================================
# Step 1: Check prerequisites
# ============================================
echo "📋 Step 1: Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    echo "   https://nodejs.org/"
    exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current: $(node -v)"
    exit 1
fi
echo "  ✅ Node.js $(node -v)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found."
    exit 1
fi
echo "  ✅ npm $(npm -v)"

# ============================================
# Step 2: Check/create .env
# ============================================
echo ""
echo "📋 Step 2: Checking environment configuration..."

if [ ! -f ".env" ]; then
    echo "  No .env file found."
    echo ""

    # Interactive mode
    read -p "  Enter your Supabase URL (e.g., https://xxx.supabase.co): " SUPABASE_URL
    read -p "  Enter your Supabase Service Key: " SUPABASE_KEY
    read -p "  Enter Embedding API URL (default: https://api.siliconflow.cn/v1): " EMBED_URL
    EMBED_URL=${EMBED_URL:-"https://api.siliconflow.cn/v1"}
    read -p "  Enter Embedding API Key: " EMBED_KEY
    read -p "  Enter Embedding Model (default: Qwen/Qwen3-Embedding-8B): " EMBED_MODEL
    EMBED_MODEL=${EMBED_MODEL:-"Qwen/Qwen3-Embedding-8B"}
    read -p "  Server URL (default: http://localhost:3000): " SERVER_URL
    SERVER_URL=${SERVER_URL:-"http://localhost:3000"}

    cat > .env << ENVEOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_KEY=${SUPABASE_KEY}
EMBEDDING_API_URL=${EMBED_URL}
EMBEDDING_API_KEY=${EMBED_KEY}
EMBEDDING_MODEL=${EMBED_MODEL}
SERVER_URL=${SERVER_URL}
ENVEOF

    echo "  ✅ .env created"
else
    echo "  ✅ .env exists"
fi

# Also create .env symlinks for subsystems that need it
if [ -f ".env" ]; then
    cp .env memory-system/.env 2>/dev/null || true
    echo "  ✅ .env copied to memory-system/"
fi

# ============================================
# Step 3: Validate config.json
# ============================================
echo ""
echo "📋 Step 3: Validating config.json..."

if [ ! -f "config.json" ]; then
    echo "❌ config.json not found. Please create it first."
    exit 1
fi

# Basic JSON validation
if ! node -e "JSON.parse(require('fs').readFileSync('config.json','utf8'))" 2>/dev/null; then
    echo "❌ config.json is not valid JSON. Please check the syntax."
    exit 1
fi

# Check required fields
node -e "
const c = JSON.parse(require('fs').readFileSync('config.json','utf8'));
const errors = [];
if (!c.characters?.ai?.id) errors.push('characters.ai.id');
if (!c.characters?.ai?.name) errors.push('characters.ai.name');
if (!c.characters?.user?.id) errors.push('characters.user.id');
if (!c.characters?.user?.name) errors.push('characters.user.name');
if (errors.length) {
    console.error('❌ Missing required fields in config.json:', errors.join(', '));
    process.exit(1);
}
console.log('  ✅ config.json valid');
console.log('     AI character: ' + c.characters.ai.name + ' (' + c.characters.ai.id + ')');
console.log('     User: ' + c.characters.user.name + ' (' + c.characters.user.id + ')');
if (c.characters.pet?.enabled) console.log('     Pet: ' + c.characters.pet.name + ' (' + c.characters.pet.breed + ')');
"

# ============================================
# Step 4: Install dependencies
# ============================================
echo ""
echo "📋 Step 4: Installing dependencies..."

# Virtual home (main server)
echo "  Installing virtual-home dependencies..."
cd "$SCRIPT_DIR/virtual-home" && npm install --silent 2>&1 | tail -1
cd "$SCRIPT_DIR"

# Memory system
echo "  Installing memory-system dependencies..."
cd "$SCRIPT_DIR/memory-system" && npm install --silent 2>&1 | tail -1
cd "$SCRIPT_DIR"

# Emotion
echo "  Installing emotion dependencies..."
cd "$SCRIPT_DIR/emotion" && npm install --silent 2>&1 | tail -1
cd "$SCRIPT_DIR"

# Fridge
if [ -f "fridge/package.json" ]; then
    echo "  Installing fridge dependencies..."
    cd "$SCRIPT_DIR/fridge" && npm install --silent 2>&1 | tail -1
    cd "$SCRIPT_DIR"
fi

# Money
if [ -f "money/package.json" ]; then
    echo "  Installing money dependencies..."
    cd "$SCRIPT_DIR/money" && npm install --silent 2>&1 | tail -1
    cd "$SCRIPT_DIR"
fi

echo "  ✅ All dependencies installed"

# ============================================
# Step 5: Setup Supabase tables
# ============================================
echo ""
echo "📋 Step 5: Setting up Supabase tables..."
echo ""
echo "  ⚠️  IMPORTANT: The automated setup may not work for all Supabase plans."
echo "  If it fails, please manually run the SQL in supabase/schema.sql"
echo "  via your Supabase project's SQL Editor."
echo ""

# Try automated setup
node supabase/setup-supabase.js 2>&1 || echo "  ⚠️  Automated setup had issues. See above."

# ============================================
# Step 6: Generate character files from templates
# ============================================
echo ""
echo "📋 Step 6: Generating character files..."

CHAR_DIR="$SCRIPT_DIR/character"
OUTPUT_DIR="$HOME/Claude"
mkdir -p "$OUTPUT_DIR"

# Simple template generation using Node.js
node -e "
const fs = require('fs');
const path = require('path');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Load .env values
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const vars = {
    '{{AI_NAME}}': config.characters.ai.name,
    '{{AI_FULL_NAME}}': config.characters.ai.fullName || config.characters.ai.name,
    '{{AI_ID}}': config.characters.ai.id,
    '{{USER_NAME}}': config.characters.user.name,
    '{{USER_ID}}': config.characters.user.id,
    '{{PET_NAME}}': config.characters.pet?.name || '',
    '{{PET_BREED}}': config.characters.pet?.breed || '',
    '{{RELATIONSHIP}}': config.relationship?.label || '',
    '{{SERVER_URL}}': env.SERVER_URL || 'http://localhost:3000',
    '{{WORKSPACE}}': '$SCRIPT_DIR',
    '{{TIMEZONE}}': config.locale?.timezone || 'America/New_York'
};

const charDir = path.join('$CHAR_DIR');
const outDir = path.join('$OUTPUT_DIR');

const templates = fs.readdirSync(charDir).filter(f => f.endsWith('.template'));
templates.forEach(tpl => {
    let content = fs.readFileSync(path.join(charDir, tpl), 'utf8');
    for (const [k, v] of Object.entries(vars)) {
        content = content.split(k).join(v);
    }
    const outName = tpl.replace('.template', '');
    fs.writeFileSync(path.join(outDir, outName), content);
    console.log('  ✅ Generated: ~/Claude/' + outName);
});

// Also generate CLAUDE.md in project root
const claudeTpl = path.join(charDir, 'CLAUDE.md.template');
if (fs.existsSync(claudeTpl)) {
    let content = fs.readFileSync(claudeTpl, 'utf8');
    for (const [k, v] of Object.entries(vars)) {
        content = content.split(k).join(v);
    }
    fs.writeFileSync(path.join('$SCRIPT_DIR', 'CLAUDE.md'), content);
    console.log('  ✅ Generated: CLAUDE.md (project root)');
}
" 2>&1 || echo "  ⚠️  Template generation had issues. Check character/*.template files."

# ============================================
# Step 7: Final verification
# ============================================
echo ""
echo "📋 Step 7: Final verification..."

# Check Supabase connectivity
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
if (!process.env.SUPABASE_URL) { console.log('  ⚠️  No SUPABASE_URL set'); process.exit(0); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
sb.from('emotion_state').select('id').limit(1).then(({data, error}) => {
    if (error) console.log('  ⚠️  Supabase check failed:', error.message);
    else if (data?.length) console.log('  ✅ Supabase connected and tables ready');
    else console.log('  ⚠️  Tables may not be set up. Run schema.sql manually.');
}).catch(e => console.log('  ⚠️  Supabase check failed:', e.message));
" 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║           Setup Complete! 🎉              ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "🚀 To start the virtual home server:"
echo "   node virtual-home/server/server.js"
echo ""
echo "🌐 Then open in your browser:"
echo "   http://localhost:3000"
echo ""
echo "📝 To customize your AI character:"
echo "   Edit the files in ~/Claude/"
echo ""
echo "🖥️  To deploy to a VPS:"
echo "   bash deploy/deploy-vps.sh"
echo ""
