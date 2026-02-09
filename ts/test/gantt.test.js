import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMermaidAscii } from '../dist/index.js'

describe('Gantt chart', () => {
  it('renders basic tasks as horizontal bars', () => {
    const result = renderMermaidAscii(`gantt
    title Project Plan
    dateFormat YYYY-MM-DD
    section Development
        Task A :a1, 2024-01-01, 14d
        Task B :b1, 2024-01-15, 14d`)

    assert.ok(result.length > 0)
    assert.ok(result.includes('Task A'), 'contains "Task A"')
    assert.ok(result.includes('Task B'), 'contains "Task B"')
  })

  it('renders title centered above bars', () => {
    const result = renderMermaidAscii(`gantt
    title My Project
    section Work
        Task :t1, 2024-01-01, 7d`)

    assert.ok(result.includes('My Project'), 'contains title')
    const lines = result.split('\n')
    assert.ok(lines[0].includes('My Project'), 'title on first line')
    // Title should be indented (centered)
    assert.ok(lines[0].startsWith(' '), 'title is padded')
  })

  it('renders section headers', () => {
    const result = renderMermaidAscii(`gantt
    section Planning
        Research :r1, 2024-01-01, 7d
    section Development
        Coding :c1, 2024-01-08, 14d`)

    assert.ok(result.includes('Planning'), 'contains first section')
    assert.ok(result.includes('Development'), 'contains second section')
  })

  it('resolves after dependencies', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Task A :a1, 2024-01-01, 14d
        Task B :b1, after a1, 14d`)

    assert.ok(result.includes('Task A'), 'contains Task A')
    assert.ok(result.includes('Task B'), 'contains Task B')
    // Task B should start at 01-15 (after Task A ends on 01-15)
    assert.ok(result.includes('01-15'), 'Task B starts at 01-15')
  })

  it('renders milestones with diamond marker', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Task A    :a1, 2024-01-01, 14d
        Milestone :milestone, m1, after a1, 0d`)

    assert.ok(result.includes('Milestone'), 'contains milestone label')
    // Should contain diamond marker (Unicode)
    assert.ok(result.includes('\u25c6'), 'contains diamond marker')
  })

  it('renders milestones with <> in ASCII mode', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Task A    :a1, 2024-01-01, 14d
        Milestone :milestone, m1, after a1, 0d`, { useAscii: true })

    assert.ok(result.includes('<>'), 'contains <> milestone marker')
  })

  it('differentiates done tasks visually', () => {
    const unicodeResult = renderMermaidAscii(`gantt
    section Work
        Done Task :done, d1, 2024-01-01, 14d
        Normal Task :n1, 2024-01-15, 14d`)

    // Done uses medium shade (▒), normal uses solid fill (█)
    assert.ok(unicodeResult.includes('\u2592'), 'done task uses medium shade fill')
    assert.ok(unicodeResult.includes('\u2588'), 'normal task uses solid fill')
  })

  it('differentiates crit tasks visually', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Critical Task :crit, c1, 2024-01-01, 14d
        Normal Task :n1, 2024-01-15, 14d`)

    // Crit uses cross-hatch (╬), normal uses solid fill (█)
    assert.ok(result.includes('\u256c'), 'crit task uses cross-hatch fill')
    assert.ok(result.includes('\u2588'), 'normal task uses solid fill')
  })

  it('handles duration syntax: days and weeks', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Days Task  :d1, 2024-01-01, 14d
        Weeks Task :w1, 2024-01-15, 2w`)

    assert.ok(result.includes('Days Task'), 'contains days task')
    assert.ok(result.includes('Weeks Task'), 'contains weeks task')
    // 2w = 14 days, so end date should be 01-29
    assert.ok(result.includes('01-29'), 'weeks task ends at 01-29')
  })

  it('uses ASCII characters when useAscii is true', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Task A :t1, 2024-01-01, 7d
        Task B :t2, 2024-01-15, 7d`, { useAscii: true })

    assert.ok(result.includes('#'), 'contains # bar fill')
    assert.ok(result.includes('-'), 'contains - empty fill')
    assert.ok(!result.includes('\u2588'), 'no Unicode solid block char')
    assert.ok(!result.includes('\u2500'), 'no Unicode thin line char')
  })

  it('uses Unicode characters by default', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Task A :t1, 2024-01-01, 7d
        Task B :t2, 2024-01-15, 7d`)

    assert.ok(result.includes('\u2588'), 'contains Unicode solid block')
    assert.ok(result.includes('\u2500'), 'contains Unicode thin line')
  })

  it('aligns task labels', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Short :s1, 2024-01-01, 7d
        A Much Longer Name :l1, 2024-01-08, 7d`)

    const lines = result.split('\n').filter(l => l.includes('->'))
    // Both date annotations should start at the same column
    const arrowPositions = lines.map(l => l.indexOf('->'))
    assert.strictEqual(arrowPositions[0], arrowPositions[1], 'date annotations should align')
  })

  it('returns empty string for empty chart', () => {
    const result = renderMermaidAscii(`gantt
    title Empty`)

    assert.strictEqual(result, '', 'no tasks produces empty output')
  })

  it('skips comment lines', () => {
    const result = renderMermaidAscii(`gantt
    %% This is a comment
    section Work
        Task :t1, 2024-01-01, 7d
    %% Another comment`)

    assert.ok(result.includes('Task'), 'contains task')
    assert.ok(!result.includes('comment'), 'does not contain comment text')
  })

  it('produces no blank lines', () => {
    const result = renderMermaidAscii(`gantt
    title Project
    section Phase 1
        Task A :a1, 2024-01-01, 14d
        Task B :b1, after a1, 14d
    section Phase 2
        Task C :c1, after b1, 7d`)

    const lines = result.split('\n')
    for (let i = 0; i < lines.length; i++) {
      assert.ok(lines[i].trim().length > 0, `line ${i} should not be blank: "${lines[i]}"`)
    }
  })

  it('renders single-task chart', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Only Task :o1, 2024-03-01, 7d`)

    assert.ok(result.includes('Only Task'), 'contains task label')
    assert.ok(result.includes('03-01'), 'contains start date')
    assert.ok(result.includes('03-08'), 'contains end date')
  })

  it('handles tasks with no explicit dates (sequential fallback)', () => {
    const result = renderMermaidAscii(`gantt
    section Work
        Task A :a1, 2024-01-01, 7d
        Task B :b1, 7d`)

    assert.ok(result.includes('Task A'), 'contains Task A')
    assert.ok(result.includes('Task B'), 'contains Task B')
    // Task B should start where Task A ends
    const lines = result.split('\n')
    const taskBLine = lines.find(l => l.includes('Task B'))
    assert.ok(taskBLine, 'Task B line found')
    assert.ok(taskBLine.includes('01-08'), 'Task B starts at 01-08')
  })
})
