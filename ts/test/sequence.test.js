import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMermaidAscii } from '../dist/index.js'

describe('sequence diagram', () => {
  it('renders basic message exchange', () => {
    const result = renderMermaidAscii(`sequenceDiagram
    Alice->>Bob: Hello Bob
    Bob-->>Alice: Hi Alice`)

    assert.ok(result.length > 0)
    const lines = result.split('\n')
    assert.ok(lines.length > 5)
    const maxWidth = Math.max(...lines.map(l => l.length))
    assert.ok(maxWidth > 15, 'output has non-trivial width')
    assert.ok(result.includes('Alice'), 'contains "Alice"')
    assert.ok(result.includes('Bob'), 'contains "Bob"')
    assert.ok(result.includes('Hello Bob'), 'contains message label')
    assert.ok(result.includes('Hi Alice'), 'contains reply label')
  })

  it('renders actor boxes at top and bottom', () => {
    const result = renderMermaidAscii(`sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Test`)

    const aliceCount = (result.match(/Alice/g) || []).length
    assert.ok(aliceCount >= 2, 'Alice appears at top and bottom')
    const bobCount = (result.match(/Bob/g) || []).length
    assert.ok(bobCount >= 2, 'Bob appears at top and bottom')
  })

  it('renders loop blocks', () => {
    const result = renderMermaidAscii(`sequenceDiagram
    Alice->>Bob: Request
    loop Every 5 seconds
      Bob->>Alice: Response
    end`)

    assert.ok(result.includes('loop'))
    assert.ok(result.includes('Request'))
    assert.ok(result.includes('Response'))
  })

  it('renders alt/else blocks', () => {
    const result = renderMermaidAscii(`sequenceDiagram
    Alice->>Bob: Authenticate
    alt Success
      Bob->>Alice: Token
    else Failure
      Bob->>Alice: Error
    end`)

    assert.ok(result.includes('alt'))
    assert.ok(result.includes('Authenticate'))
  })

  it('renders self-messages', () => {
    const result = renderMermaidAscii(`sequenceDiagram
    Alice->>Alice: Think`)

    assert.ok(result.includes('Alice'))
    assert.ok(result.includes('Think'))
  })

  it('uses ASCII characters when useAscii is true', () => {
    const result = renderMermaidAscii(`sequenceDiagram
    Alice->>Bob: Hi`, { useAscii: true })

    assert.ok(result.includes('Alice'))
    assert.ok(result.includes('Bob'))
    assert.ok(!result.includes('┌'), 'no Unicode box-drawing')
  })

  it('renders notes', () => {
    const result = renderMermaidAscii(`sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello
    Note right of Bob: Important note`)

    assert.ok(result.includes('Important note'))
  })
})
