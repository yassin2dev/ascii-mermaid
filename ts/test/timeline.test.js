import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMermaidAscii } from '../dist/index.js'

describe('Timeline diagram', () => {
  it('renders a basic timeline with one period and events', () => {
    const result = renderMermaidAscii(`timeline
    2023 : Planning : Research`)

    assert.ok(result.includes('2023'), 'contains period name')
    assert.ok(result.includes('Planning'), 'contains first event')
    assert.ok(result.includes('Research'), 'contains second event')
  })

  it('renders multiple periods', () => {
    const result = renderMermaidAscii(`timeline
    2023 : Planning
    2024 : Development
    2025 : Launch`)

    assert.ok(result.includes('2023'), 'contains first period')
    assert.ok(result.includes('2024'), 'contains second period')
    assert.ok(result.includes('2025'), 'contains third period')
    assert.ok(result.includes('Planning'), 'contains first event')
    assert.ok(result.includes('Development'), 'contains second event')
    assert.ok(result.includes('Launch'), 'contains third event')
  })

  it('renders sections with periods', () => {
    const result = renderMermaidAscii(`timeline
    section Phase 1
        2023 : Planning : Research
        2024 : Development
    section Phase 2
        2025 : Launch : Support`)

    assert.ok(result.includes('Phase 1'), 'contains first section')
    assert.ok(result.includes('Phase 2'), 'contains second section')
    assert.ok(result.includes('2023'), 'contains period in section 1')
    assert.ok(result.includes('2025'), 'contains period in section 2')
  })

  it('renders title centered above content', () => {
    const result = renderMermaidAscii(`timeline
    title My Timeline
    2023 : Event`)

    const lines = result.split('\n')
    assert.ok(lines[0].includes('My Timeline'), 'title on first line')
    // Title should be indented (centered)
    assert.ok(lines[0].startsWith(' '), 'title is padded')
  })

  it('uses ASCII characters when useAscii is true', () => {
    const result = renderMermaidAscii(`timeline
    2023 : Event1 : Event2`, { useAscii: true })

    assert.ok(result.includes('+'), 'contains + box corners')
    assert.ok(result.includes('-'), 'contains - horizontal lines')
    assert.ok(result.includes('|'), 'contains | vertical lines')
    // Should not contain Unicode box-drawing characters
    assert.ok(!result.includes('\u250c'), 'no Unicode top-left corner')
    assert.ok(!result.includes('\u2500'), 'no Unicode horizontal line')
  })

  it('uses Unicode characters by default', () => {
    const result = renderMermaidAscii(`timeline
    2023 : Event1 : Event2`)

    assert.ok(result.includes('\u250c'), 'contains Unicode top-left corner')
    assert.ok(result.includes('\u2500'), 'contains Unicode horizontal line')
    assert.ok(result.includes('\u2502'), 'contains Unicode vertical line')
    assert.ok(!result.includes('+'), 'no + corners')
  })

  it('renders period with single event (no tree branching needed)', () => {
    const result = renderMermaidAscii(`timeline
    2023 : Only Event`)

    assert.ok(result.includes('2023'), 'contains period')
    assert.ok(result.includes('Only Event'), 'contains event')
    // Single event should use elbow connector, not tee
    const lines = result.split('\n')
    const eventLine = lines.find(l => l.includes('Only Event'))
    assert.ok(eventLine, 'event line found')
    // Should use elbow (last-item connector)
    assert.ok(eventLine.includes('\u2514') || eventLine.includes('+'), 'uses elbow connector')
  })

  it('returns empty string for empty timeline', () => {
    const result = renderMermaidAscii(`timeline`)

    assert.strictEqual(result, '', 'empty timeline produces empty output')
  })

  it('handles continuation events', () => {
    const result = renderMermaidAscii(`timeline
    2023 : Planning
    : Research
    : Design`)

    assert.ok(result.includes('Planning'), 'contains first event')
    assert.ok(result.includes('Research'), 'contains continuation event')
    assert.ok(result.includes('Design'), 'contains second continuation event')
    // All three events should be under the same period box
    const periodBoxes = result.split('\n').filter(l => l.includes('2023'))
    assert.strictEqual(periodBoxes.length, 1, 'only one period box for 2023')
  })

  it('skips comment lines', () => {
    const result = renderMermaidAscii(`timeline
    %% This is a comment
    2023 : Event
    %% Another comment
    2024 : Event2`)

    assert.ok(result.includes('2023'), 'contains first period')
    assert.ok(result.includes('2024'), 'contains second period')
    assert.ok(!result.includes('comment'), 'does not contain comment text')
  })

  it('renders section headers with consistent width', () => {
    const result = renderMermaidAscii(`timeline
    section Alpha
        2023 : Event
    section Beta
        2024 : Event`)

    const lines = result.split('\n')
    const sectionLines = lines.filter(l => l.includes('Alpha') || l.includes('Beta'))
    assert.strictEqual(sectionLines.length, 2, 'two section headers')
    // Both section headers should have dashes
    for (const line of sectionLines) {
      assert.ok(line.includes('\u2500') || line.includes('-'), 'section header has dashes')
    }
  })

  it('renders periods without events (no connector)', () => {
    const result = renderMermaidAscii(`timeline
    2023`)

    assert.ok(result.includes('2023'), 'contains period name')
    // Should have a closed bottom border (no tee connector)
    const lines = result.split('\n')
    const bottomBorder = lines.find(l =>
      (l.includes('\u2514') || l.includes('+')) &&
      !l.includes('\u251c') && !l.includes('\u252c')
    )
    assert.ok(bottomBorder, 'bottom border is closed (no connector)')
  })

  it('produces no blank lines (overlay display compatibility)', () => {
    const result = renderMermaidAscii(`timeline
    title Project Roadmap
    section Phase 1
        2023 : Planning : Research
        2024 : Development
    section Phase 2
        2025 : Launch : Support`)

    const lines = result.split('\n')
    for (let i = 0; i < lines.length; i++) {
      assert.ok(lines[i].trim().length > 0, `line ${i} should not be blank: "${lines[i]}"`)
    }
  })

  it('renders title with sections and periods together', () => {
    const result = renderMermaidAscii(`timeline
    title Project Roadmap
    section Phase 1
        2023 : Planning : Research
        2024 : Development
    section Phase 2
        2025 : Launch : Support`)

    assert.ok(result.includes('Project Roadmap'), 'contains title')
    assert.ok(result.includes('Phase 1'), 'contains section 1')
    assert.ok(result.includes('Phase 2'), 'contains section 2')
    assert.ok(result.includes('2023'), 'contains period')
    assert.ok(result.includes('Planning'), 'contains event')
    assert.ok(result.includes('Support'), 'contains last event')
  })
})
