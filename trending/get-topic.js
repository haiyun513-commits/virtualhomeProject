#!/usr/bin/env node
// 获取一个随机的新鲜话题
// 用于 quick-save 的第三个方向

const topics = [
  { source: 'ithome', query: 'IT之家 科技新闻 今天' },
  { source: '36kr', query: '36氪 科技新闻 今天' },
  { source: 'hupu', query: '虎扑 热门话题 今天' },
  { source: 'douban', query: '豆瓣 热门 今天' },
  { source: 'steam', query: 'Steam 新游戏 今天' },
  { source: 'hackernews', query: 'HackerNews 热门' }
];

// 随机选一个来源
const randomTopic = topics[Math.floor(Math.random() * topics.length)];

console.log(JSON.stringify({
  source: randomTopic.source,
  query: randomTopic.query,
  instruction: '用 WebSearch 或 WebFetch 获取内容，然后用一句话概括一个有意思的新闻/热点'
}));
