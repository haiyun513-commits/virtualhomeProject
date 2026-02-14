/**
 * config-loader.js — Central configuration reader for AI Companion Template
 *
 * All modules import this instead of hardcoding character names, room definitions,
 * dialogues, recipes, etc. Template variables {ai}, {user}, {pet} are auto-replaced.
 *
 * Usage:
 *   const config = require('../config-loader');
 *   console.log(config.ai.name);            // "Awen"
 *   console.log(config.user.name);           // "Dabao"
 *   console.log(config.interpolate("{ai} is cooking with {user}"));
 *                                            // "Awen is cooking with Dabao"
 */

const fs = require('fs');
const path = require('path');

// Find config.json — walk up from current file location
function findConfig() {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        const candidate = path.join(dir, 'config.json');
        if (fs.existsSync(candidate)) return candidate;
        dir = path.dirname(dir);
    }
    throw new Error('config.json not found. Run setup.sh first or place config.json in the project root.');
}

const raw = JSON.parse(fs.readFileSync(findConfig(), 'utf8'));

// ============================================
// Template interpolation
// ============================================
const vars = {
    ai:      raw.characters.ai.name,
    user:    raw.characters.user.name,
    pet:     raw.characters.pet.name,
    ai_id:   raw.characters.ai.id,
    user_id: raw.characters.user.id,
    pet_id:  raw.characters.pet.id
};

function interpolate(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/\{(ai|user|pet|ai_id|user_id|pet_id)\}/g, (_, key) => vars[key] || _);
}

function interpolateDeep(obj) {
    if (typeof obj === 'string') return interpolate(obj);
    if (Array.isArray(obj)) return obj.map(interpolateDeep);
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            out[k] = interpolateDeep(v);
        }
        return out;
    }
    return obj;
}

// ============================================
// Shorthand accessors (pre-interpolated)
// ============================================
const ai   = { ...raw.characters.ai };
const user = { ...raw.characters.user };
const pet  = { ...raw.characters.pet };

// ============================================
// Rooms
// ============================================
const rooms = raw.rooms || {};
const roomDefs = rooms.definitions || {};
const inferRules = (rooms.inferRules || []).map(r => ({
    keywords: r.keywords,
    room: r.room
}));

function inferRoomFromStatus(status) {
    if (!status) return null;
    const lower = status.toLowerCase();
    for (const rule of inferRules) {
        if (rule.keywords.some(kw => lower.includes(kw.toLowerCase()))) return rule.room;
    }
    return null;
}

function roomActivity(role, room) {
    // role: 'ai' or 'user'
    const def = roomDefs[room];
    if (!def || !def.activities) return 'Here';
    return def.activities[role] || 'Here';
}

// ============================================
// Following system
// ============================================
const followMap = interpolateDeep(raw.activities?.followMap || {});
const followFuzzyRules = (raw.activities?.followFuzzyRules || []).map(r => ({
    keyword: r.keyword,
    text: interpolate(r.text)
}));
const followDefault = interpolate(raw.activities?.followDefault || 'With {user}');
const followDurationMs = (raw.infrastructure?.followDurationMin || 30) * 60 * 1000;

function followActivityText(userActivity) {
    if (!userActivity) return followDefault;
    // Exact match
    if (followMap[userActivity]) return followMap[userActivity];
    // Fuzzy match
    const lower = userActivity.toLowerCase();
    for (const rule of followFuzzyRules) {
        if (lower.includes(rule.keyword.toLowerCase())) return rule.text;
    }
    // Generic fallback
    return followDefault;
}

// ============================================
// Interaction dialogues & effects
// ============================================
const interactDialogues = raw.relationship?.interactDialogues || {};
const interactEffects   = raw.relationship?.interactEffects || {};
const petFeedback       = interpolateDeep(raw.relationship?.petFeedback || {});

// ============================================
// Cooking
// ============================================
const recipes     = raw.cooking?.recipes || { simple: [], medium: [], complex: [] };
const restaurants = raw.cooking?.restaurants || [];
const fridgeSearchMap = raw.cooking?.fridgeSearchMap || {};
const estimatedCosts  = raw.cooking?.estimatedCosts || {};

// ============================================
// Pet behaviors
// ============================================
const petBehaviors = interpolateDeep(raw.petBehaviors || {});

// ============================================
// Activities
// ============================================
const needActivities = interpolateDeep(raw.activities?.needActivities || {});
const sleepSchedule  = raw.activities?.sleepSchedule || { sleepHour: 4, wakeHour: 13, energySleepThreshold: 60 };

// ============================================
// Infrastructure
// ============================================
const port           = raw.infrastructure?.serverPort || 3000;
const tickIntervalMs = raw.infrastructure?.tickIntervalMs || 120000;
const timezone       = raw.locale?.timezone || 'America/New_York';
const locale         = raw.locale || {};
const features       = raw.features || {};
const siteTitle      = raw.siteTitle || 'Virtual Home';

// ============================================
// Client-safe config subset (for GET /config/client)
// ============================================
function clientConfig() {
    return {
        siteTitle,
        characters: {
            ai:   { id: ai.id, name: ai.name, avatar: ai.avatar, roomLabel: ai.roomLabel },
            user: { id: user.id, name: user.name, avatar: user.avatar },
            pet:  { enabled: pet.enabled, id: pet.id, name: pet.name, emoji: pet.emoji, breed: pet.breed, avatar: pet.avatar }
        },
        relationship: { label: raw.relationship?.label },
        rooms: Object.fromEntries(
            Object.entries(roomDefs).map(([id, def]) => [id, { label: def.label, labelEmoji: def.labelEmoji }])
        ),
        petBehaviors,
        petFeedback,
        interactDialogues,
        features,
        locale: { language: locale.language, currency: locale.currency, currencySymbol: locale.currencySymbol }
    };
}

// ============================================
// Export
// ============================================
module.exports = {
    raw,
    interpolate,
    interpolateDeep,

    // Characters
    ai, user, pet,

    // Rooms
    roomDefs, inferRules,
    inferRoomFromStatus,
    roomActivity,

    // Following
    followMap, followFuzzyRules, followDefault, followDurationMs,
    followActivityText,

    // Interactions
    interactDialogues, interactEffects, petFeedback,

    // Cooking
    recipes, restaurants, fridgeSearchMap, estimatedCosts,

    // Pet
    petBehaviors,

    // Activities
    needActivities, sleepSchedule,

    // Infrastructure
    port, tickIntervalMs, timezone, locale, features, siteTitle,

    // Client
    clientConfig
};
