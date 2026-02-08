import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMermaidAscii } from '../dist/index.js'

describe('class diagram', () => {
  it('renders classes with inline members', () => {
    const result = renderMermaidAscii(`classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal: +int age
    Animal: +String gender
    Duck: +swim()
    Fish: +swim()`)

    assert.ok(result.length > 0)
    const lines = result.split('\n')
    assert.ok(lines.length > 5)
    assert.ok(result.includes('Animal'), 'contains "Animal"')
    assert.ok(result.includes('Duck'), 'contains "Duck"')
    assert.ok(result.includes('Fish'), 'contains "Fish"')
  })

  it('renders class body block syntax', () => {
    const result = renderMermaidAscii(`classDiagram
    class BankAccount {
      +String owner
      +BigDecimal balance
      +deposit(amount)
      +withdrawal(amount)
    }`)

    assert.ok(result.includes('BankAccount'))
    assert.ok(result.includes('owner'))
    assert.ok(result.includes('balance'))
    assert.ok(result.includes('deposit'))
    assert.ok(result.includes('withdrawal'))
  })

  it('renders inheritance relationships', () => {
    const result = renderMermaidAscii(`classDiagram
    Vehicle <|-- Car
    Vehicle <|-- Truck`)

    assert.ok(result.includes('Vehicle'))
    assert.ok(result.includes('Car'))
    assert.ok(result.includes('Truck'))
  })

  it('renders composition relationships', () => {
    const result = renderMermaidAscii(`classDiagram
    Company *-- Employee`)

    assert.ok(result.includes('Company'))
    assert.ok(result.includes('Employee'))
  })

  it('renders annotations', () => {
    const result = renderMermaidAscii(`classDiagram
    class Shape {
      <<interface>>
      +draw()
    }`)

    assert.ok(result.includes('Shape'))
    assert.ok(result.includes('interface'))
    assert.ok(result.includes('draw'))
  })

  it('uses ASCII characters when useAscii is true', () => {
    const result = renderMermaidAscii(`classDiagram
    A <|-- B`, { useAscii: true })

    assert.ok(result.length > 0)
    assert.ok(!result.includes('┌'), 'no Unicode box-drawing')
  })

  it('renders relationship labels', () => {
    const result = renderMermaidAscii(`classDiagram
    Student "1" --> "many" Course : enrolls`)

    assert.ok(result.includes('Student'))
    assert.ok(result.includes('Course'))
    assert.ok(result.includes('enrolls'))
  })
})
