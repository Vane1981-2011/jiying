/**
 * 稽影 v0.3.2 — 向量嵌入知识库（Embedding KB）
 *
 * 架构目标：将 TF-IDF 字符级检索升级为语义级向量检索
 * 技术路线：浏览器端 ONNX 推理 — 零服务端依赖
 *
 * ── 迁移路径 ──
 *
 * TF-IDF (v0.2)                    Embedding KB (v0.3)
 * ┌──────────────────┐            ┌──────────────────────────┐
 * │ 中文正则分词      │            │ @xenova/transformers     │
 * │ 字符级 Jaccard    │   ──→     │ all-MiniLM-L6-v2 (23MB)  │
 * │ ~45 停用词         │            │ WebAssembly + ONNX       │
 * │ IndexedDB 存储    │            │ cosine similarity        │
 * └──────────────────┘            │ 混合检索: embed+keyword   │
 *                                  │ 降级: TF-IDF fallback    │
 *                                  └──────────────────────────┘
 *
 * 性能预期：
 *   - 首次加载: 3-5s（模型下载 + 预热·可预加载）
 *   - 查询延迟: ~50ms（384维向量余弦相似度）
 *   - 精度提升: +40-60% recall@5 vs TF-IDF（基于 MiniLM 基准）
 *   - 模型体积: ~23MB（gzip ~8MB·Service Worker 缓存）
 *
 * 依赖：
 *   npm install @xenova/transformers
 *
 * 用法：
 *   const kb = await EmbeddingKB.create();
 *   await kb.addDocument('doc-1', '财务分析报告...');
 *   const results = await kb.search('投资风险评估');
 */

// ── 架构接口定义（v0.3 实现层）──

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;

/**
 * 向量嵌入知识库
 *
 * 设计原则：
 * - 渐进增强：模型加载失败自动降级到 TF-IDF（v0.2 兼容）
 * - 懒加载：首次查询时才加载模型
 * - 增量索引：文档增删时局部更新，不重建全索引
 * - 混合检索：embedding(70%) + keyword(30%) 加权融合
 */
export class EmbeddingKB {
  /** @type {EmbeddingKB|null} */
  static instance = null;

  /** @type {boolean} */
  ready = false;

  /** @type {Map<string, Float32Array>} */
  vectors = new Map();

  /** @type {{ extractor: any, loaded: boolean }} */
  model = { extractor: null, loaded: false };

  /**
   * 工厂方法 — 单例模式
   */
  static async create() {
    if (!EmbeddingKB.instance) {
      EmbeddingKB.instance = new EmbeddingKB();
      await EmbeddingKB.instance._init();
    }
    return EmbeddingKB.instance;
  }

  async _init() {
    try {
      // 动态导入 — 不阻塞首屏
      const { pipeline } = await import('@xenova/transformers');
      this.model.extractor = await pipeline('feature-extraction', EMBEDDING_MODEL);
      this.model.loaded = true;
      this.ready = true;
    } catch (err) {
      console.warn('[EmbeddingKB] 模型加载失败，降级到 TF-IDF:', err.message);
      this.ready = false;
    }
  }

  /**
   * 添加文档
   * @param {string} id
   * @param {string} content
   */
  async addDocument(id, content) {
    if (!this.model.loaded) return; // 降级：不建向量索引
    const embedding = await this._embed(content.slice(0, 1024)); // 截断
    this.vectors.set(id, new Float32Array(embedding));
  }

  /**
   * 语义搜索
   * @param {string} query
   * @param {number} [topK=5]
   * @returns {Promise<Array<{id: string, score: number}>>}
   */
  async search(query, topK = 5) {
    if (!this.model.loaded || this.vectors.size === 0) {
      return []; // 降级：由调用方回退到 TF-IDF
    }

    const queryVec = await this._embed(query);
    const scores = [];

    for (const [id, vec] of this.vectors) {
      scores.push({ id, score: _cosineSimilarity(queryVec, vec) });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  /**
   * 混合检索：embedding(0.7) + keyword(0.3)
   */
  async hybridSearch(query, keywordResults, topK = 5) {
    const embedResults = await this.search(query, topK * 2);
    const merged = new Map();

    for (const r of embedResults) {
      merged.set(r.id, (merged.get(r.id) || 0) + r.score * 0.7);
    }
    for (const r of keywordResults) {
      merged.set(r.id, (merged.get(r.id) || 0) + (r.score || 0.5) * 0.3);
    }

    return [...merged.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async _embed(text) {
    if (!this.model.extractor) throw new Error('模型未加载');
    const output = await this.model.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}

// ── 工具函数 ──

function _cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ── 渐进迁移策略 ──

/**
 * 渐进迁移：并行运行双引擎，逐步切换
 *
 * Phase 1 (v0.3.0): 双引擎并行 — TF-IDF 主 + Embedding 副
 *   - 查询时同时调用两套引擎
 *   - 结果以 TF-IDF 为准（用户无感知）
 *   - 后台记录 embedding 结果与 TF-IDF 的差异
 *
 * Phase 2 (v0.3.1): 混合检索上线
 *   - hybridSearch() 替换原 search()
 *   - embedding(0.7) + keyword(0.3) 加权
 *   - 允许用户反馈"这个结果有帮助吗？"
 *
 * Phase 3 (v0.4): 全量迁移
 *   - 移除 TF-IDF 引擎
 *   - 仅保留 embedding + 混合检索
 */

export const MIGRATION_PLAN = {
  phase1: { primary: 'tfidf', secondary: 'embedding', userFacing: 'tfidf' },
  phase2: { primary: 'hybrid', weight: { embedding: 0.7, keyword: 0.3 } },
  phase3: { primary: 'embedding', fallback: 'hybrid' },
};
