#!/usr/bin/env node
// 保存新鲜事到缓存
// 用法: node save-trending.js "新鲜事内容" "来源"

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'trending-cache.json');

const [content, source] = process.argv.slice(2);

if (!content) {
  console.error('用法: node save-trending.js "新鲜事内容" "来源(可选)"');
  process.exit(1);
}

const cache = {
  content: content,
  source: source || '未知',
  timestamp: Date.now()
};

fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');

console.log('✅ 已保存新鲜事到缓存');
console.log(`内容: ${content}`);
console.log(`来源: ${source || '未知'}`);
console.log(`时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'America/New_York' })}`);
