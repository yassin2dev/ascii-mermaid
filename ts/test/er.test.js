import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMermaidAscii } from '../dist/index.js'

describe('ER diagram', () => {
  it('renders entities with relationships', () => {
    const result = renderMermaidAscii(`erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains`)

    assert.ok(result.length > 0)
    const lines = result.split('\n')
    assert.ok(lines.length > 3)
    const maxWidth = Math.max(...lines.map(l => l.length))
    assert.ok(maxWidth > 10)
    assert.ok(result.includes('CUSTOMER'), 'contains "CUSTOMER"')
    assert.ok(result.includes('ORDER'), 'contains "ORDER"')
  })

  it('renders relationship labels', () => {
    const result = renderMermaidAscii(`erDiagram
    CUSTOMER ||--o{ ORDER : places`)

    assert.ok(result.includes('places'), 'contains relationship label')
  })

  it('renders entity attributes', () => {
    const result = renderMermaidAscii(`erDiagram
    CUSTOMER {
      string name PK
      int age
      string email
    }
    CUSTOMER ||--o{ ORDER : places`)

    assert.ok(result.includes('CUSTOMER'))
    assert.ok(result.includes('name'))
    assert.ok(result.includes('age'))
    assert.ok(result.includes('email'))
  })

  it('renders multiple entities', () => {
    const result = renderMermaidAscii(`erDiagram
    PERSON ||--o{ ADDRESS : "lives at"
    PERSON ||--|{ PHONE : has
    COMPANY ||--o{ ADDRESS : "located at"`)

    assert.ok(result.includes('PERSON'))
    assert.ok(result.includes('ADDRESS'))
    assert.ok(result.includes('PHONE'))
    assert.ok(result.includes('COMPANY'))
  })

  it('uses ASCII characters when useAscii is true', () => {
    const result = renderMermaidAscii(`erDiagram
    A ||--o{ B : rel`, { useAscii: true })

    assert.ok(result.length > 0)
    assert.ok(!result.includes('┌'), 'no Unicode box-drawing')
  })

  it('handles non-identifying relationships', () => {
    const result = renderMermaidAscii(`erDiagram
    STUDENT }|..|{ COURSE : enrolls`)

    assert.ok(result.includes('STUDENT'))
    assert.ok(result.includes('COURSE'))
  })

  it('does not throw on entity-only diagram', () => {
    assert.doesNotThrow(() => {
      renderMermaidAscii(`erDiagram
      PRODUCT {
        string name
        float price
      }`)
    })
  })

  it('aligns child entity below parent in multi-row layout', () => {
    const result = renderMermaidAscii(`erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains`)

    const lines = result.split('\n')
    // Find ORDER box position (on first row, not the LINE-ITEM row)
    const orderLine = lines.find(l => l.includes('ORDER') && !l.includes('LINE'))
    const orderBoxStart = orderLine.indexOf('ORDER')
    // Find LINE-ITEM box position (on second row)
    const lineItemLine = lines.find(l => l.includes('LINE-ITEM'))
    const lineItemBoxStart = lineItemLine.indexOf('LINE-ITEM')

    // LINE-ITEM should be roughly centered below ORDER, not at x=0
    assert.ok(lineItemBoxStart > 0, 'LINE-ITEM should not start at x=0')
    // The vertical line should be straight: no stray vertical chars at x < 10
    const verticalLines = lines.filter(l => {
      const trimLeft = l.search(/[^\s]/)
      return trimLeft > 5 && (l.includes('\u2502') || l.includes('\u2551') || l.includes('\u255F'))
    })
    for (const vl of verticalLines) {
      // All vertical markers should be in the ORDER column area, not far left
      const firstNonSpace = vl.search(/[^\s]/)
      assert.ok(firstNonSpace > 10, `vertical line should be near ORDER column, got indent=${firstNonSpace}`)
    }
  })

  it('renders L-route with corner characters', () => {
    // A connects to B horizontally, B connects to C vertically.
    // C also connects to A, forcing an L-route from A to C since C
    // aligns below A's connected parent (A itself).
    const result = renderMermaidAscii(`erDiagram
    A ||--o{ B : rel1
    A ||--|{ C : rel2
    B ||--o{ C : rel3`)

    const lines = result.split('\n')
    // The B-to-C L-route must have corner characters (turns)
    const hasCorner = lines.some(l =>
      l.includes('\u2518') || l.includes('\u2510') || // ┘ or ┐
      l.includes('\u2514') || l.includes('\u250C')    // └ or ┌
    )
    assert.ok(hasCorner, 'L-route should contain corner characters at turns')
    // No stale vertical segment: B's center column should not have vertical
    // chars below the L-route horizontal turn
    const bLine = lines.find(l => l.includes(' B ') && l.includes('\u2502'))
    const bCenterX = bLine ? bLine.indexOf('B') : -1
    if (bCenterX >= 0) {
      const cornerLineIdx = lines.findIndex(l =>
        l[bCenterX] === '\u2518' || l[bCenterX] === '\u2514'  // corner at B's column
      )
      if (cornerLineIdx >= 0) {
        // Lines below the corner at B's column should not have vertical chars
        for (let i = cornerLineIdx + 1; i < lines.length; i++) {
          const ch = lines[i][bCenterX] || ' '
          assert.ok(
            ch !== '\u2502' && ch !== '\u2551' && ch !== '\u255F',
            `stale vertical at line ${i} col ${bCenterX}: "${ch}"`
          )
        }
      }
    }
  })
})
