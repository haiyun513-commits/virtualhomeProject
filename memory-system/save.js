const { saveMemory } = require('./memory');
const [content, type = 'event', importance = '0.7'] = process.argv.slice(2);

if (!content) {
  console.error('用法: node save.js "内容" [类型] [重要度]');
  process.exit(1);
}

// 禁止相对日期 必须用准确日期
const relativeDateWords = ['今天', '明天', '昨天', '后天', '前天', '下周', '上周', '这周'];
const found = relativeDateWords.filter(w => content.includes(w));
if (found.length > 0) {
  console.error(`❌ 禁止使用相对日期: ${found.join(', ')}`);
  console.error('请用准确日期 例如: 2026年2月11日');
  process.exit(1);
}

saveMemory(content, type, parseFloat(importance))
  .then(r => console.log(JSON.stringify(r)))
  .catch(e => { console.error(e.message); process.exit(1); });
