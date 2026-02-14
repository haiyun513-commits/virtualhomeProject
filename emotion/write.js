#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../memory-system/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function writeEmotion(calm, happiness, excitement, sadness, nervousness, irritation, heartache, anger, toward) {
  const validToward = ['亲近', '疏远', '小心', '撒娇', '酸'];

  if (!validToward.includes(toward)) {
    console.error(`无效toward: ${toward}，允许值: ${validToward.join(', ')}`);
    process.exit(1);
  }

  const dimensions = [calm, happiness, excitement, sadness, nervousness, irritation, heartache, anger];
  for (let i = 0; i < dimensions.length; i++) {
    const val = parseInt(dimensions[i]);
    if (isNaN(val) || val < 0 || val > 5) {
      console.error(`维度${i}值必须是0-5的整数`);
      process.exit(1);
    }
  }

  // 先读当前toward 检测是否变化
  const { data: current } = await supabase
    .from('emotion_state')
    .select('toward')
    .single();

  const towardChanged = current && current.toward !== toward;

  const { data, error } = await supabase
    .from('emotion_state')
    .update({
      calm: parseInt(calm),
      happiness: parseInt(happiness),
      excitement: parseInt(excitement),
      sadness: parseInt(sadness),
      nervousness: parseInt(nervousness),
      irritation: parseInt(irritation),
      heartache: parseInt(heartache),
      anger: parseInt(anger),
      toward,
      updated_at: new Date().toISOString(),
      last_interaction_at: new Date().toISOString()
    })
    .eq('id', 1);

  if (error) {
    console.error('写入失败:', error.message);
    process.exit(1);
  }

  let msg = `✅ 已更新: 平静=${calm} 开心=${happiness} 兴奋=${excitement} 低落=${sadness} 紧张=${nervousness} 烦躁=${irritation} 心酸=${heartache} 生气=${anger} toward=${toward}`;
  if (towardChanged) {
    msg += `\n⚠️ toward变化: ${current.toward} → ${toward}`;
  }
  console.log(msg);

  // 同步到虚拟家园 (Socket.io 广播)
  try {
    await fetch((process.env.SERVER_URL || 'http://localhost:3000') + '/emotion-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calm: parseInt(calm), happiness: parseInt(happiness),
        excitement: parseInt(excitement), sadness: parseInt(sadness),
        nervousness: parseInt(nervousness), irritation: parseInt(irritation),
        heartache: parseInt(heartache), anger: parseInt(anger), toward
      })
    });
  } catch (e) {
    // 虚拟家园离线时不影响主功能
  }
}

const args = process.argv.slice(2);

if (args.length !== 9) {
  console.error('用法: node write.js 平静 开心 兴奋 低落 紧张 烦躁 心酸 生气 "toward"');
  console.error('示例: node write.js 3 2 0 0 0 0 0 0 "亲近"');
  process.exit(1);
}

writeEmotion(...args);
