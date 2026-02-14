const { searchMemory } = require('./memory');
const [query, threshold = '0.5', count = '5'] = process.argv.slice(2);

if (!query) {
  console.error('用法: node search.js "查询"');
  process.exit(1);
}

searchMemory(query, parseFloat(threshold), parseInt(count))
  .then(results => {
    if (!results || !results.length) {
      console.log('无相关记忆');
      return;
    }
    results.forEach(r => console.log(`[${r.similarity.toFixed(3)}] (${r.id}) ${r.content}`));
  })
  .catch(e => { console.error(e.message); process.exit(1); });
