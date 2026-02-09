// ============================================================================
// ASCII renderer — Timeline diagrams
//
// Renders timeline diagrams as vertical timelines with boxed period names
// and tree-style event branches. No canvas needed — purely text-based layout.
// ============================================================================

import { parseTimeline } from '../timeline/parser'
import type { Timeline, TimelineSection, TimelinePeriod } from '../timeline/types'
import type { AsciiConfig } from './types'

/** Indentation for period boxes */
const INDENT = '    '

/**
 * Render a Mermaid timeline diagram to ASCII/Unicode text.
 *
 * Output format:
 *   Title (centered, if present)
 *
 *   -- Section Name ------------------
 *
 *       +--------+
 *       | Period |
 *       +---+----+
 *           +-- Event 1
 *           +-- Event 2
 */
export function renderTimelineAscii(text: string, config: AsciiConfig): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const timeline = parseTimeline(lines)

  if (timeline.sections.length === 0) return ''

  const hasPeriods = timeline.sections.some(s => s.periods.length > 0)
  if (!hasPeriods) return ''

  const useAscii = config.useAscii

  // Box-drawing characters
  const TL = useAscii ? '+' : '\u250c' // ┌
  const TR = useAscii ? '+' : '\u2510' // ┐
  const BL = useAscii ? '+' : '\u2514' // └
  const BR = useAscii ? '+' : '\u2518' // ┘
  const H  = useAscii ? '-' : '\u2500' // ─
  const V  = useAscii ? '|' : '\u2502' // │

  // Tree branch characters
  const TEE    = useAscii ? '+' : '\u251c' // ├
  const ELBOW  = useAscii ? '+' : '\u2514' // └
  const BRANCH = H + H + ' '              // ── (+ space)

  // Section header dash
  const SDASH = useAscii ? '-' : '\u2500' // ─

  const outputLines: string[] = []

  // Compute max content width for section header sizing
  const maxContentWidth = computeMaxWidth(timeline, INDENT)

  // Title
  if (timeline.title) {
    const titlePad = Math.max(0, Math.floor((maxContentWidth - timeline.title.length) / 2))
    outputLines.push(' '.repeat(titlePad) + timeline.title)
  }

  for (let si = 0; si < timeline.sections.length; si++) {
    const section = timeline.sections[si]!

    // Section header
    if (section.name) {
      const headerContent = ' ' + section.name + ' '
      const dashCount = Math.max(0, maxContentWidth - headerContent.length - 4)
      const headerLine = '  ' + SDASH + SDASH + headerContent + SDASH.repeat(dashCount)
      outputLines.push(headerLine)
    }

    // Periods
    for (let pi = 0; pi < section.periods.length; pi++) {
      const period = section.periods[pi]!
      renderPeriod(outputLines, period, { TL, TR, BL, BR, H, V, TEE, ELBOW, BRANCH })
    }
  }

  return outputLines.join('\n')
}

interface Chars {
  TL: string; TR: string; BL: string; BR: string
  H: string; V: string
  TEE: string; ELBOW: string; BRANCH: string
}

function renderPeriod(out: string[], period: TimelinePeriod, ch: Chars): void {
  const label = period.name
  const boxWidth = label.length + 2 // 1 space padding each side

  // Top border
  out.push(INDENT + ch.TL + ch.H.repeat(boxWidth) + ch.TR)
  // Label row
  out.push(INDENT + ch.V + ' ' + label + ' ' + ch.V)

  if (period.events.length > 0) {
    // Bottom border with tee connector
    // Position the connector: center of box bottom, biased left
    const teePos = Math.floor(boxWidth / 2)
    const beforeTee = ch.H.repeat(teePos)
    const afterTee = ch.H.repeat(boxWidth - teePos - 1)
    const teeChar = ch.TL === '+' ? '+' : '\u252c' // ┬
    out.push(INDENT + ch.BL + beforeTee + teeChar + afterTee + ch.BR)

    // Event tree
    const eventIndent = INDENT + ' '.repeat(teePos + 1)
    for (let ei = 0; ei < period.events.length; ei++) {
      const isLast = ei === period.events.length - 1
      const connector = isLast ? ch.ELBOW : ch.TEE
      out.push(eventIndent + connector + ch.BRANCH + period.events[ei]!)
    }
  } else {
    // Plain bottom border (no events)
    out.push(INDENT + ch.BL + ch.H.repeat(boxWidth) + ch.BR)
  }
}

/** Compute the maximum line width for section header sizing */
function computeMaxWidth(timeline: Timeline, indent: string): number {
  let max = 0

  if (timeline.title) {
    max = Math.max(max, timeline.title.length)
  }

  for (const section of timeline.sections) {
    if (section.name) {
      max = Math.max(max, section.name.length + 10)
    }
    for (const period of section.periods) {
      const boxWidth = period.name.length + 2
      max = Math.max(max, indent.length + boxWidth + 2)
      for (const event of period.events) {
        const eventWidth = indent.length + Math.floor(boxWidth / 2) + 1 + 4 + event.length
        max = Math.max(max, eventWidth)
      }
    }
  }

  return max
}
