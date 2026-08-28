import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors';
import { assertSafeOutboundUrl } from '@/lib/llm/outbound-url';

describe('assertSafeOutboundUrl', () => {
  it('allows public https URLs', () => {
    expect(() => assertSafeOutboundUrl('https://api.example.com/v1')).not.toThrow();
  });

  it('blocks localhost', () => {
    expect(() => assertSafeOutboundUrl('http://localhost/v1')).toThrow(AppError);
  });

  it('blocks private IPv4', () => {
    expect(() => assertSafeOutboundUrl('https://10.0.0.1/v1')).toThrow(AppError);
    expect(() => assertSafeOutboundUrl('https://192.168.1.1/v1')).toThrow(AppError);
  });

  it('blocks metadata endpoints', () => {
    expect(() => assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data/')).toThrow(AppError);
  });
});
