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
})
