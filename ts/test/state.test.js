import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMermaidAscii } from '../dist/index.js'

describe('state diagram', () => {
  it('renders basic state transitions', () => {
    const result = renderMermaidAscii(`stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: start
    Processing --> Done: complete
    Processing --> Error: fail
    Error --> Idle: retry
    Done --> [*]`)

    assert.ok(result.length > 0)
    const lines = result.split('\n')
    assert.ok(lines.length > 5, 'output has non-trivial height')
    assert.ok(result.includes('Idle'), 'contains "Idle"')
    assert.ok(result.includes('Processing'), 'contains "Processing"')
    assert.ok(result.includes('Done'), 'contains "Done"')
    assert.ok(result.includes('Error'), 'contains "Error"')
  })

  it('renders transition labels', () => {
    const result = renderMermaidAscii(`stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: begin
    Processing --> Done: complete`)

    assert.ok(result.includes('begin'), 'contains edge label "begin"')
    assert.ok(result.includes('complete'), 'contains edge label "complete"')
  })

  it('renders start and end pseudostates', () => {
    const result = renderMermaidAscii(`stateDiagram-v2
    [*] --> Running
    Running --> [*]`)

    assert.ok(result.length > 0)
    assert.ok(result.includes('Running'))
  })

  it('renders composite states', () => {
    const result = renderMermaidAscii(`stateDiagram-v2
    state "Active Phase" as Active {
      [*] --> Working
      Working --> Paused
      Paused --> Working
    }
    [*] --> Active
    Active --> [*]`)

    assert.ok(result.length > 0)
    assert.ok(result.includes('Working'))
    assert.ok(result.includes('Paused'))
  })

  it('renders with Unicode by default', () => {
    const result = renderMermaidAscii(`stateDiagram-v2
    [*] --> S1
    S1 --> S2`)

    assert.ok(result.includes('S1'))
    assert.ok(result.includes('S2'))
    assert.ok(
      result.includes('┌') || result.includes('─') || result.includes('│'),
      'uses Unicode box-drawing',
    )
  })
})
