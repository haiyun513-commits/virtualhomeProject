#!/usr/bin/env node
// 检查新鲜事缓存是否过期
// 返回：需要更新 / 缓存有效（并输出内容）

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'trending-cache.json');
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6小时

function checkTrending() {
  // 检查缓存文件是否存在
  if (!fs.existsSync(CACHE_FILE)) {
    console.log('状态: 需要更新');
    console.log('原因: 缓存文件不存在');
    return;
  }

  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

    // 检查必要字段
    if (!cache.content || !cache.timestamp) {
      console.log('状态: 需要更新');
      console.log('原因: 缓存数据不完整');
      return;
    }

    // 检查是否过期
    const now = Date.now();
    const age = now - cache.timestamp;
    const hoursOld = Math.floor(age / (1000 * 60 * 60));

    if (age > CACHE_DURATION) {
      console.log('状态: 需要更新');
      console.log(`原因: 缓存已过期（${hoursOld}小时前）`);
      return;
    }

    // 缓存有效
    console.log('状态: 缓存有效');
    console.log(`内容: ${cache.content}`);
    console.log(`来源: ${cache.source || '未知'}`);
    console.log(`时间: ${new Date(cache.timestamp).toLocaleString('zh-CN', { timeZone: 'America/New_York' })}`);
    console.log(`年龄: ${hoursOld}小时前`);

  } catch (error) {
    console.log('状态: 需要更新');
    console.log('原因: 缓存文件损坏');
  }
}

checkTrending();
