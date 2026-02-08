import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMermaidAscii } from '../dist/index.js'

describe('flowchart', () => {
  it('renders graph TD with multiple nodes and edges', () => {
    const result = renderMermaidAscii(`graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[Ship it]`)

    assert.ok(result.length > 0, 'output is non-empty')
    const lines = result.split('\n')
    assert.ok(lines.length > 5, 'output has non-trivial height')
    const maxWidth = Math.max(...lines.map(l => l.length))
    assert.ok(maxWidth > 10, 'output has non-trivial width')
    assert.ok(result.includes('Start'), 'contains "Start"')
    assert.ok(result.includes('Great!'), 'contains "Great!"')
    assert.ok(result.includes('Debug'), 'contains "Debug"')
    assert.ok(result.includes('Ship it'), 'contains "Ship it"')
  })

  it('renders flowchart LR direction', () => {
    const result = renderMermaidAscii(`flowchart LR
    A[Alpha] --> B[Beta] --> C[Gamma]`)

    assert.ok(result.length > 0)
    assert.ok(result.includes('Alpha'))
    assert.ok(result.includes('Beta'))
    assert.ok(result.includes('Gamma'))
  })

  it('renders BT direction (bottom-to-top)', () => {
    const result = renderMermaidAscii(`graph BT
    A[Bottom] --> B[Top]`)

    assert.ok(result.length > 0)
    assert.ok(result.includes('Bottom'))
    assert.ok(result.includes('Top'))
  })

  it('uses ASCII characters when useAscii is true', () => {
    const result = renderMermaidAscii(`graph TD
    A[Hello] --> B[World]`, { useAscii: true })

    assert.ok(result.includes('Hello'))
    assert.ok(result.includes('World'))
    assert.ok(result.includes('+') || result.includes('-'), 'uses ASCII border chars')
    assert.ok(!result.includes('┌'), 'does not contain Unicode box-drawing')
  })

  it('uses Unicode box-drawing by default', () => {
    const result = renderMermaidAscii(`graph TD
    A[Hello] --> B[World]`)

    assert.ok(
      result.includes('┌') || result.includes('─') || result.includes('│'),
      'uses Unicode box-drawing characters',
    )
  })

  it('renders edge labels', () => {
    const result = renderMermaidAscii(`graph TD
    A[A] -->|Yes| B[B]
    A -->|No| C[C]`)

    assert.ok(result.includes('Yes'), 'contains edge label "Yes"')
    assert.ok(result.includes('No'), 'contains edge label "No"')
  })

  it('renders subgraphs', () => {
    const result = renderMermaidAscii(`graph TD
    subgraph sg1 [Sub Group]
      A[Node A]
      B[Node B]
    end
    A --> B`)

    assert.ok(result.includes('Node A'))
    assert.ok(result.includes('Node B'))
    assert.ok(result.includes('Sub Group'), 'subgraph label appears')
  })

  it('renders dotted and thick edges without error', () => {
    const result = renderMermaidAscii(`graph LR
    A[A] -.-> B[B]
    B ==> C[C]`)

    assert.ok(result.includes('A'))
    assert.ok(result.includes('B'))
    assert.ok(result.includes('C'))
  })

  it('handles various node shapes without throwing', () => {
    assert.doesNotThrow(() => {
      renderMermaidAscii(`graph TD
      A[Rectangle]
      B(Rounded)
      C{Diamond}
      D([Stadium])
      E((Circle))
      F[[Subroutine]]`)
    })
  })

  it('respects paddingX and paddingY options', () => {
    const compact = renderMermaidAscii(`graph TD
    A[X] --> B[Y]`, { paddingX: 1, paddingY: 1 })
    const spacious = renderMermaidAscii(`graph TD
    A[X] --> B[Y]`, { paddingX: 10, paddingY: 10 })

    const compactLines = compact.split('\n')
    const spaciousLines = spacious.split('\n')
    assert.ok(spaciousLines.length > compactLines.length, 'more paddingY produces taller output')
  })
})
