import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMermaidAscii } from '../dist/index.js'

describe('Pie chart', () => {
  it('renders slices as horizontal bars', () => {
    const result = renderMermaidAscii(`pie
    "Chrome" : 42
    "Firefox" : 25
    "Safari" : 15`)

    assert.ok(result.length > 0)
    assert.ok(result.includes('Chrome'), 'contains "Chrome"')
    assert.ok(result.includes('Firefox'), 'contains "Firefox"')
    assert.ok(result.includes('Safari'), 'contains "Safari"')
  })

  it('renders title centered above bars', () => {
    const result = renderMermaidAscii(`pie
    title Browser Usage
    "Chrome" : 42
    "Firefox" : 25`)

    assert.ok(result.includes('Browser Usage'), 'contains title')
    const lines = result.split('\n')
    // Title should be on the first line
    assert.ok(lines[0].includes('Browser Usage'), 'title on first line')
    // First bar should be directly after title (no blank separator)
    assert.ok(lines[1].trim().length > 0, 'bar row immediately after title')
  })

  it('displays correct percentages', () => {
    const result = renderMermaidAscii(`pie
    "A" : 50
    "B" : 50`)

    assert.ok(result.includes('50.0%'), 'contains 50.0%')
    // Both should be 50%
    const matches = result.match(/50\.0%/g)
    assert.strictEqual(matches.length, 2, 'two slices at 50%')
  })

  it('shows raw values with showData', () => {
    const result = renderMermaidAscii(`pie showData
    "Alpha" : 30
    "Beta" : 70`)

    assert.ok(result.includes('(30)'), 'contains raw value 30')
    assert.ok(result.includes('(70)'), 'contains raw value 70')
  })

  it('does not show raw values without showData', () => {
    const result = renderMermaidAscii(`pie
    "Alpha" : 30
    "Beta" : 70`)

    assert.ok(!result.includes('(30)'), 'should not contain raw value')
    assert.ok(!result.includes('(70)'), 'should not contain raw value')
  })

  it('uses ASCII characters when useAscii is true', () => {
    const result = renderMermaidAscii(`pie
    "X" : 100`, { useAscii: true })

    assert.ok(result.includes('#'), 'contains # bar fill')
    assert.ok(!result.includes('\u2588'), 'no Unicode block char')
  })

  it('uses Unicode characters by default', () => {
    const result = renderMermaidAscii(`pie
    "X" : 100`)

    assert.ok(result.includes('\u2588'), 'contains Unicode block char')
    assert.ok(!result.includes('#'), 'no # bar fill')
  })

  it('handles single slice as 100%', () => {
    const result = renderMermaidAscii(`pie
    "Only" : 50`)

    assert.ok(result.includes('100.0%'), 'single slice is 100%')
  })

  it('returns empty string for no slices', () => {
    const result = renderMermaidAscii(`pie
    title Empty Chart`)

    assert.strictEqual(result, '', 'no slices produces empty output')
  })

  it('skips comment lines', () => {
    const result = renderMermaidAscii(`pie
    %% This is a comment
    "A" : 60
    %% Another comment
    "B" : 40`)

    assert.ok(result.includes('A'), 'contains "A"')
    assert.ok(result.includes('B'), 'contains "B"')
    assert.ok(!result.includes('comment'), 'does not contain comment text')
  })

  it('aligns labels and percentages', () => {
    const result = renderMermaidAscii(`pie
    "Short" : 30
    "A Much Longer Label" : 70`)

    const lines = result.split('\n').filter(l => l.includes('%'))
    // Both percentage strings should end at the same column
    const pctEnds = lines.map(l => {
      const match = l.match(/%/)
      return match ? l.indexOf('%') : -1
    })
    assert.strictEqual(pctEnds[0], pctEnds[1], 'percentage columns should align')
  })
})
