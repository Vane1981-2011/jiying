import { describe, it, expect, vi } from 'vitest';
import { withFallback, withRetry } from './fallback';
import { DomainError } from './errors';

describe('Fallback 链式容错', () => {
  describe('withFallback', () => {
    it('主 provider 成功 → 返回主源数据', async () => {
      const result = await withFallback([
        { name: 'main', fn: () => '主源数据' },
        { name: 'backup', fn: () => '备用数据' },
      ]);
      expect(result.data).toBe('主源数据');
      expect(result.source).toBe('main');
      expect(result.degraded).toBe(false);
    });

    it('主源失败 → 自动 fallback 到备用', async () => {
      const result = await withFallback([
        { name: 'main', fn: () => { throw new Error('主源挂了'); } },
        { name: 'backup', fn: () => '备用数据' },
      ]);
      expect(result.data).toBe('备用数据');
      expect(result.source).toBe('backup');
      expect(result.degraded).toBe(false);
    });

    it('全部失败 → 返回降级结果', async () => {
      const result = await withFallback([
        { name: 'fail1', fn: () => { throw new Error('错误1'); } },
        { name: 'fail2', fn: () => { throw new Error('错误2'); } },
      ], {
        buildDegradedResult: (errors) => ({ _degraded: true, errors }),
      });
      expect(result.degraded).toBe(true);
      expect(result.source).toBe('degraded');
      expect(result.data._degraded).toBe(true);
    });

    it('超时 → 触发 fallback', async () => {
      const result = await withFallback([
        {
          name: 'slow',
          fn: () => new Promise((resolve) => setTimeout(() => resolve('太慢了'), 200)),
          timeout: 50,
        },
        { name: 'fast', fn: () => '快速备用' },
      ]);
      expect(result.data).toBe('快速备用');
      expect(result.source).toBe('fast');
    });

    it('onFallback 回调被正确调用', async () => {
      const callback = vi.fn();
      await withFallback([
        { name: 'main', fn: () => { throw new Error('失败'); } },
        { name: 'backup', fn: () => 'ok' },
      ], { onFallback: callback });
      expect(callback).toHaveBeenCalledTimes(1);
      // DomainError 包装了原始错误
      expect(callback.mock.calls[0][0]).toBe('main');
      expect(callback.mock.calls[0][1].code).toBe('PROVIDER_FAILED');
    });

    it('空 provider 列表 → 直接返回降级结果', async () => {
      const result = await withFallback([], { buildDegradedResult: () => '空的' });
      expect(result.degraded).toBe(true);
      expect(result.data).toBe('空的');
    });
  });

  describe('withRetry', () => {
    it('首次成功 → 只调用一次', async () => {
      const fn = vi.fn().mockResolvedValue('成功');
      const result = await withRetry(fn, { retries: 3 });
      expect(result).toBe('成功');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('失败一次后重试成功', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new DomainError({ code: 'TEMP', category: 'TIMEOUT', retryable: true, userMessage: '临时错误' }))
        .mockResolvedValueOnce('重试成功');
      const result = await withRetry(fn, { retries: 3, backoffMs: 10 });
      expect(result).toBe('重试成功');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('全部重试失败 → 抛出错误', async () => {
      const fn = vi.fn().mockRejectedValue(new DomainError({ code: 'PERSIST', category: 'TIMEOUT', retryable: true, userMessage: '一直失败' }));
      await expect(withRetry(fn, { retries: 2, backoffMs: 10 })).rejects.toThrow('一直失败');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('shouldRetry 返回 false → 不重试', async () => {
      const fn = vi.fn().mockRejectedValue(new DomainError({ code: 'NO_RETRY', category: 'DEPENDENCY', retryable: true, userMessage: '不可重试错误' }));
      await expect(withRetry(fn, {
        retries: 3,
        backoffMs: 10,
      })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('不可重试错误 → 立即抛出', async () => {
      const fn = vi.fn().mockRejectedValue(new DomainError({ code: 'AUTH', category: 'AUTHORIZATION', retryable: false, userMessage: '权限不足' }));
      await expect(withRetry(fn, { retries: 3, backoffMs: 10 })).rejects.toThrow('权限不足');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
