#!/usr/bin/env node
/**
 * setup-supabase.js — Initialize Supabase tables for AI Companion Template
 *
 * Reads schema.sql and executes it against the configured Supabase instance.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
 *
 * Usage: node supabase/setup-supabase.js
 */

const fs = require('fs');
const path = require('path');

// Load .env from project root
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    // Try memory-system/.env as fallback
    const fallbackEnv = path.join(__dirname, '..', 'memory-system', '.env');
    if (fs.existsSync(fallbackEnv)) {
        require('dotenv').config({ path: fallbackEnv });
    }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    console.error('   Copy .env.example to .env and fill in your Supabase credentials.');
    process.exit(1);
}

async function run() {
    console.log('🔧 Setting up Supabase tables...\n');

    // Read schema SQL
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
        console.error('❌ schema.sql not found at', schemaPath);
        process.exit(1);
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Split into individual statements (split on semicolons at end of line)
    const statements = schemaSql
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    // Execute via Supabase REST SQL endpoint
    let success = 0;
    let failed = 0;

    for (const stmt of statements) {
        // Extract a short description from the statement
        const firstLine = stmt.split('\n').find(l => l.trim() && !l.trim().startsWith('--')) || stmt.substring(0, 60);
        const desc = firstLine.trim().substring(0, 80);

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: stmt + ';' })
            });

            // If RPC doesn't work, try the SQL endpoint directly
            if (!res.ok) {
                // Use the pg_query approach via the SQL editor API
                const sqlRes = await fetch(`${SUPABASE_URL}/pg/query`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: stmt + ';' })
                });

                if (sqlRes.ok) {
                    console.log(`  ✅ ${desc}`);
                    success++;
                } else {
                    throw new Error(`HTTP ${sqlRes.status}`);
                }
            } else {
                console.log(`  ✅ ${desc}`);
                success++;
            }
        } catch (e) {
            // Many errors are expected (e.g., "table already exists") — log but continue
            console.log(`  ⚠️  ${desc} — ${e.message}`);
            failed++;
        }
    }

    console.log(`\n📊 Results: ${success} succeeded, ${failed} warnings/skipped`);
    console.log('\n💡 If some statements failed, you may need to run schema.sql manually:');
    console.log('   1. Go to your Supabase project → SQL Editor');
    console.log('   2. Paste the contents of supabase/schema.sql');
    console.log('   3. Click "Run"\n');

    // Test connectivity by reading emotion_state
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await supabase.from('emotion_state').select('id').limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
            console.log('✅ Supabase connection verified — emotion_state table accessible');
        } else {
            console.log('⚠️  emotion_state table exists but no seed data found. Run schema.sql manually.');
        }
    } catch (e) {
        console.log('⚠️  Could not verify tables:', e.message);
        console.log('   Please run schema.sql manually via Supabase SQL Editor.');
    }
}

run().catch(e => {
    console.error('❌ Setup failed:', e.message);
    process.exit(1);
});
