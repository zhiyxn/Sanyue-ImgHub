import { describe, expect, it } from 'vitest'
import { cn, formatBytes } from './utils'

describe('formatBytes', () => {
  it('formats empty and binary file sizes', () => {
    expect(formatBytes()).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('cn', () => {
  it('resolves conflicting Tailwind utilities', () => {
    expect(cn('px-2 text-sm', false && 'hidden', 'px-4')).toContain('px-4')
    expect(cn('px-2', 'px-4')).not.toContain('px-2')
  })
})
