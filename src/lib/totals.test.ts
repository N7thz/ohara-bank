import { describe, expect, test } from 'bun:test'
import { isExcludedFromTotals } from './totals'

const tag = (excludeFromTotals: boolean) => ({ tag: { excludeFromTotals } })

describe('isExcludedFromTotals', () => {
	test.each([
		[[], false],
		[[tag(false)], false],
		[[tag(false), tag(true)], true],
	])('%p → %p', (tags, expected) => {
		expect(isExcludedFromTotals(tags)).toBe(expected)
	})
})
