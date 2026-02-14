require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// 初始化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const embeddingClient = new OpenAI({
  apiKey: process.env.EMBEDDING_API_KEY,
  baseURL: process.env.EMBEDDING_API_URL,
});

// 生成向量
async function getEmbedding(text) {
  const response = await embeddingClient.embeddings.create({
    model: process.env.EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

// 存记忆
async function saveMemory(content, type = 'event', importance = 0.5) {
  const embedding = await getEmbedding(content);
  const { data, error } = await supabase
    .from('memories')
    .insert({
      content,
      embedding,
      memory_type: type,
      importance,
    })
    .select('id, content');

  if (error) throw error;
  console.log('✅ 记忆已保存:', content.slice(0, 50));
  return data[0];
}

// 搜记忆
async function searchMemory(query, threshold = 0.5, count = 5) {
  const embedding = await getEmbedding(query);
  const { data, error } = await supabase.rpc('match_memories', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: count,
  });

  if (error) throw error;
  return data;
}

module.exports = { saveMemory, searchMemory, getEmbedding };
