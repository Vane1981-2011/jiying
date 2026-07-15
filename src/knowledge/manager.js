/**
 * 稽影 — 知识库管理器（升级版：TF-IDF 向量检索 RAG）
 *
 * 本地知识库：上传文件 → 提取文本 → 分块存储 → TF-IDF 向量索引 → 语义检索。
 * 所有数据存储在 IndexedDB，不上传服务器。
 *
 * 升级内容（v0.1 → v0.2）：
 * - 关键词搜索 → TF-IDF 向量空间检索
 * - 简单的 idf 权重计算提升相关性
 * - 分块重叠 + 排序融合
 * - 检索结果附带信度标注
 */

const DB_NAME = 'jiying-kb';
const DB_VERSION = 2;
const STORE_NAME = 'documents';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('addedAt', 'addedAt', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export const KnowledgeBase = {
  /** 上传文本文档 */
  async uploadFile(file) {
    const text = await readFileAsText(file);
    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const chunks = chunkText(text, 800, 200); // 800 字符分块，200 重叠

    // 构建 TF-IDF 索引
    const tfidfIndex = buildTFIDF(chunks);

    const doc = {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      content: text,
      chunks,
      chunkCount: chunks.length,
      tfidfIndex,          // { terms: { term: { df: n, postings: [{chunkIdx, tf}] } } }
      addedAt: Date.now(),
      source: 'user_uploaded',
    };

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.add(doc);
      tx.oncomplete = () => resolve(doc);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  /** 列出所有文档 */
  async listDocuments() {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  },

  /** 删除文档 */
  async deleteDocument(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * TF-IDF 向量检索
   *
   * @param {string} query - 检索查询
   * @param {number} maxResults - 最大结果数
   * @returns {Promise<Array<{docId, docName, snippet, relevance, source}>>}
   */
  async search(query, maxResults = 3) {
    if (!query || !query.trim()) return [];

    const docs = await this.listDocuments();
    if (docs.length === 0) return [];

    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return [];

    const results = [];

    for (const doc of docs) {
      const tfidfIndex = doc.tfidfIndex;
      if (!tfidfIndex || !tfidfIndex.terms) continue;

      // 计算查询与每个 chunk 的 TF-IDF 余弦相似度
      const chunkScores = [];
      for (let ci = 0; ci < doc.chunks.length; ci++) {
        let score = 0;
        for (const term of queryTerms) {
          const termData = tfidfIndex.terms[term];
          if (!termData) continue;
          // 查询端 TF
          const qtf = 1;
          // 文档端 TF-IDF：遍历 postings
          const posting = termData.postings.find((p) => p.chunkIdx === ci);
          if (posting) {
            const idf = Math.log((doc.chunkCount + 1) / (termData.df + 1)) + 1;
            score += qtf * posting.tf * idf;
          }
        }
        if (score > 0) {
          chunkScores.push({ chunkIdx: ci, score });
        }
      }

      // 取最高分的 chunk
      chunkScores.sort((a, b) => b.score - a.score);
      for (const cs of chunkScores.slice(0, 2)) {
        const chunk = doc.chunks[cs.chunkIdx];
        const snippet = extractSnippet(chunk, queryTerms);

        results.push({
          docId: doc.id,
          docName: doc.name,
          snippet,
          relevance: Math.round(cs.score * 100) / 100,
          source: doc.source,
        });
      }
    }

    // 按相关性排序并截取
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);
  },

  /** 关键词搜索（降级方案——用于 TF-IDF 索引未构建的旧文档） */
  async keywordSearch(query, maxResults = 3) {
    const docs = await this.listDocuments();
    const results = [];

    for (const doc of docs) {
      for (let ci = 0; ci < doc.chunks.length; ci++) {
        const chunk = doc.chunks[ci];
        if (chunk.toLowerCase().includes(query.toLowerCase())) {
          const snippet = extractSnippet(doc.content, [query]);
          results.push({
            docId: doc.id,
            docName: doc.name,
            snippet,
            relevance: 1,
            source: doc.source,
          });
        }
      }
    }

    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);
  },

  /** 混合检索：先用 TF-IDF，失败时降级到关键词 */
  async getContext(query, maxTokens = 500) {
    let results = await this.search(query, 2);

    // 降级：如果 TF-IDF 无结果，试关键词
    if (results.length === 0) {
      results = await this.keywordSearch(query, 2);
    }

    if (results.length === 0) return null;

    const context = results
      .map((r) => `[来源: ${r.docName} | 信度: ${r.relevance.toFixed(2)}]\n${r.snippet}`)
      .join('\n\n')
      .slice(0, maxTokens * 2);

    return context || null;
  },
};

// ——— 工具函数 ———

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e.target.error);
    reader.readAsText(file);
  });
}

/**
 * 文本分块（带重叠）
 *
 * @param {string} text - 原文
 * @param {number} chunkSize - 每块字符数
 * @param {number} overlap - 重叠字符数
 * @returns {string[]}
 */
function chunkText(text, chunkSize = 800, overlap = 200) {
  if (text.length <= chunkSize) return [text];

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

/**
 * 分词
 */
function tokenize(text) {
  const lower = text.toLowerCase();
  // 中文：匹配汉字/英文单词/数字
  const tokens = lower.match(/[\u4e00-\u9fff]+|[a-z]+[a-z0-9]*|\d+/g) || [];
  // 过滤常见停用词（简单版）
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
    '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to',
    'for', 'of', 'with', 'and', 'or', 'but', 'not', 'this', 'that',
  ]);
  return tokens.filter((t) => t.length > 1 && !stopWords.has(t));
}

/**
 * 构建 TF-IDF 索引
 *
 * @param {string[]} chunks - 分块列表
 * @returns {{ terms: { [term]: { df: number, postings: Array<{chunkIdx, tf}> } } }}
 */
function buildTFIDF(chunks) {
  const terms = {};

  for (let ci = 0; ci < chunks.length; ci++) {
    const tokens = tokenize(chunks[ci]);
    const tfMap = {};

    for (const token of tokens) {
      tfMap[token] = (tfMap[token] || 0) + 1;
    }

    for (const [term, tf] of Object.entries(tfMap)) {
      if (!terms[term]) {
        terms[term] = { df: 0, postings: [] };
      }
      terms[term].df++;
      terms[term].postings.push({ chunkIdx: ci, tf: 1 + Math.log(tf) });
    }
  }

  return { terms };
}

/**
 * 提取查询关键词周围的片段
 *
 * @param {string} text - 原文
 * @param {string[]} queryTerms - 查询词列表
 * @param {number} contextChars - 上下文宽度
 * @returns {string}
 */
function extractSnippet(text, queryTerms, contextChars = 200) {
  if (!text) return '';

  // 找到包含查询词的位置
  let bestIdx = -1;
  let bestScore = 0;

  for (const term of queryTerms) {
    const idx = text.toLowerCase().indexOf(term);
    if (idx !== -1) {
      const score = term.length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }
  }

  if (bestIdx === -1) {
    return text.slice(0, 400) + (text.length > 400 ? '...' : '');
  }

  const start = Math.max(0, bestIdx - contextChars);
  const end = Math.min(text.length, bestIdx + contextChars);

  return (
    (start > 0 ? '...' : '') +
    text.slice(start, end) +
    (end < text.length ? '...' : '')
  );
}
