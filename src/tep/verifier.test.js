/**
 * 稽影 — TEP 协议测试套件
 *
 * 覆盖：空值输入·异常输入·恶意检测·降级路径
 */

import { describe, it, expect } from 'vitest';
import { generateEnvelope, verifyEnvelope, detectMaliciousInput, TEST_CASES } from './verifier.js';

describe('TEP Envelope Generation', () => {
  it('【B1·空值】空 taskId 返回明确错误', () => {
    const result = generateEnvelope(TEST_CASES.emptyTaskId);
    expect(result.error).toBe('TEP_VALIDATION');
    expect(result.envelope).toBeNull();
  });

  it('【B1·空值】空 taskDescription 返回明确错误', () => {
    const result = generateEnvelope(TEST_CASES.emptyTaskDesc);
    expect(result.error).toBe('TEP_VALIDATION');
    expect(result.envelope).toBeNull();
  });

  it('【正常】合法输入生成完整信封', () => {
    const { envelope } = generateEnvelope(TEST_CASES.valid);
    expect(envelope).not.toBeNull();
    expect(envelope.tep_version).toBe('1.0.0');
    expect(envelope.task.id).toBe('task-001');
    expect(envelope.authorization.principal).toBe('user@example.com');
    expect(envelope.quality_attestation.overall_score).toBe(4);
    expect(envelope.execution_profile.runtime).toBe('稽影 v0.2.0');
  });

  it('【正常】带签名密钥时生成 HMAC 签名', () => {
    const { envelope } = generateEnvelope(TEST_CASES.valid);
    expect(envelope.audit_signature.algorithm).toBe('HMAC-SHA256');
    expect(envelope.audit_signature.signature).toMatch(/^hmac-sha256:/);
  });

  it('【B5·降级】无签名密钥时生成未签名信封', () => {
    const { envelope } = generateEnvelope({ ...TEST_CASES.valid, signingKey: undefined });
    expect(envelope.audit_signature.algorithm).toBe('none');
    expect(envelope.audit_signature.warning).toContain('DEGRADED');
  });
});

describe('TEP Envelope Verification', () => {
  it('【B2·异常】空信封返回验证失败', () => {
    const result = verifyEnvelope(TEST_CASES.nullEnvelope);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('【正常】合法信封验证通过', () => {
    const { envelope } = generateEnvelope(TEST_CASES.valid);
    const result = verifyEnvelope(envelope);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('【B1·空值】缺少必填字段被检测', () => {
    const result = verifyEnvelope({ tep_version: '1.0.0' });
    expect(result.valid).toBe(false);
    const errorMsgs = result.errors.join(' ');
    expect(errorMsgs).toContain('task');
  });

  it('【B2·异常】无效评分范围被检测', () => {
    const { envelope } = generateEnvelope(TEST_CASES.valid);
    envelope.quality_attestation.overall_score = 99;
    const result = verifyEnvelope(envelope);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('overall_score'))).toBe(true);
  });

  it('【B5·降级】空证据包产生警告', () => {
    const { envelope } = generateEnvelope(TEST_CASES.valid);
    const result = verifyEnvelope(envelope);
    expect(result.warnings.some(w => w.includes('证据包为空'))).toBe(true);
  });
});

describe('TEP Malicious Input Detection', () => {
  it('【B2·异常】检测原型污染', () => {
    const result = detectMaliciousInput(TEST_CASES.maliciousPayload);
    expect(result.safe).toBe(false);
    expect(result.threats.some(t => t.includes('原型污染'))).toBe(true);
  });

  it('【B2·异常】检测超长字段', () => {
    const result = detectMaliciousInput(TEST_CASES.maliciousPayload);
    expect(result.safe).toBe(false);
    expect(result.threats.some(t => t.includes('长度'))).toBe(true);
  });

  it('【正常】合法信封通过恶意检测', () => {
    const { envelope } = generateEnvelope(TEST_CASES.valid);
    const result = detectMaliciousInput(envelope);
    expect(result.safe).toBe(true);
  });
});
