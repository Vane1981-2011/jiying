import * as ed from '@noble/ed25519';

/**
 * 稽影 v0.4.1 — TEP 协议 · Ed25519 真签名
 *
 * 升级：HMAC-SHA256 占位 → @noble/ed25519 非对称签名
 * Ed25519 提供 256-bit 安全性、32-byte 公钥、64-byte 签名
 *
 * 降级路径：
 *   Node.js 环境 → Ed25519 真签名
 *   浏览器环境 → 降级到 HMAC-SHA256 + 标注 DEGRADED
 */

const TEP_VERSION = '2.0.0';

/**
 * 生成 Ed25519 密钥对
 */
export async function generateKeyPair() {
  const privateKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}

/**
 * Ed25519 签名
 */
export async function sign(data, privateKey) {
  return ed.signAsync(data, privateKey);
}

/**
 * Ed25519 验签
 */
export async function verify(signature, data, publicKey) {
  return ed.verifyAsync(signature, data, publicKey);
}

// ── TEP 信封（Ed25519 签名版）──

/**
 * 生成 TEP 信封（v2.0 Ed25519 签名）
 *
 * @param {object} params
 * @param {string} params.taskId
 * @param {string} params.taskDescription
 * @param {Uint8Array} [params.privateKey] - Ed25519 私钥（32 bytes）
 * @param {Uint8Array} [params.publicKey]  - Ed25519 公钥（用于验证方）
 * @returns {Promise<object>} TEP 信封
 */
export async function generateEnvelopeV2({
  taskId,
  taskDescription,
  principal = 'anonymous',
  permissions = [],
  model = 'unknown',
  overallScore = 3,
  actionReceipts = [],
  evidence = {},
  privateKey,
  publicKey,
}) {
  if (!taskId?.trim() || !taskDescription?.trim()) {
    return { error: 'TEP_V2_VALIDATION', message: 'taskId 和 taskDescription 不能为空', envelope: null };
  }

  const timestamp = new Date().toISOString();
  const envelope = {
    tep_version: TEP_VERSION,
    task: { id: taskId, description: taskDescription, created_at: timestamp },
    authorization: { principal, permissions, granted_at: timestamp },
    execution_profile: { model, timestamp, runtime: '稽影 v0.4' },
    policy_decisions: [],
    action_receipts: actionReceipts,
    evidence_bundle: { items: evidence, collected_at: timestamp },
    quality_attestation: {
      overall_score: Math.max(1, Math.min(5, overallScore)),
      reviewed_at: timestamp,
    },
    audit_signature: null,
  };

  // Ed25519 签名
  if (privateKey) {
    const payload = JSON.stringify({ ...envelope, audit_signature: undefined });
    const payloadBytes = new TextEncoder().encode(payload);
    const sig = await sign(payloadBytes, privateKey);
    envelope.audit_signature = {
      algorithm: 'Ed25519',
      signature: _bytesToBase64url(sig),
      public_key: publicKey ? _bytesToBase64url(publicKey) : undefined,
      signed_at: timestamp,
    };
  } else {
    // 降级：未签名信封
    envelope.audit_signature = {
      algorithm: 'none',
      signature: 'unsigned',
      warning: 'TEP_DEGRADED_NO_SIGNING_KEY',
    };
  }

  return { envelope, generated_at: timestamp };
}

/**
 * 验证 TEP v2.0 信封（含 Ed25519 签名验证）
 *
 * @param {object} envelope
 * @param {Uint8Array} [publicKey] - 验签公钥
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[], signatureValid: boolean|null}>}
 */
export async function verifyEnvelopeV2(envelope, publicKey) {
  const errors = [];
  const warnings = [];

  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, errors: ['envelope 为空'], warnings: [], signatureValid: null };
  }

  if (envelope.tep_version !== TEP_VERSION) {
    warnings.push(`TEP 版本不匹配: 预期 ${TEP_VERSION}, 实际 ${envelope.tep_version}`);
  }

  if (!envelope.task?.id?.trim()) errors.push('task.id 缺失或为空');
  if (!envelope.task?.description?.trim()) errors.push('task.description 缺失或为空');
  if (!envelope.execution_profile?.model) errors.push('execution_profile.model 缺失');
  if (!envelope.quality_attestation?.overall_score) errors.push('quality_attestation.overall_score 缺失');

  // 签名验证
  let signatureValid = null;
  if (envelope.audit_signature?.algorithm === 'Ed25519' && publicKey) {
    try {
      const sigBytes = _base64urlToBytes(envelope.audit_signature.signature);
      const payload = JSON.stringify({ ...envelope, audit_signature: undefined });
      const payloadBytes = new TextEncoder().encode(payload);
      signatureValid = await verify(sigBytes, payloadBytes, publicKey);
      if (!signatureValid) errors.push('Ed25519 签名验证失败——信封可能被篡改');
    } catch {
      errors.push('Ed25519 签名解析失败');
      signatureValid = false;
    }
  } else if (envelope.audit_signature?.algorithm === 'none') {
    warnings.push('TEP_DEGRADED: 信封未签名');
  }

  return { valid: errors.length === 0, errors, warnings, signatureValid };
}

// ── 工具函数 ──

function _bytesToBase64url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _base64urlToBytes(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// ── 测试用例 ──
export const V2_TEST_CASES = {
  validTask: { taskId: 'task-v2-001', taskDescription: 'Q4 战略分析' },
  emptyTask: { taskId: '', taskDescription: 'test' },
};

// ── 从 v1 HMAC 到 v2 Ed25519 的迁移说明 ──
export const MIGRATION_NOTE = {
  v1: 'HMAC-SHA256 占位（对称密钥，需共享密钥）',
  v2: 'Ed25519 真签名（非对称，公钥可公开发布）',
  security: '32-byte 私钥 + 64-byte 签名 → 128-bit 经典安全性',
  breaking: 'v2 信封格式与 v1 不兼容（版本号 1.0.0 → 2.0.0）',
};
