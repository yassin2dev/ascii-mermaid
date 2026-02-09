// ============================================================================
// ASCII renderer — Pie charts
//
// Renders pie chart text as horizontal bar charts in ASCII/Unicode.
// Each slice gets a proportional bar with percentage (and optionally raw value).
// No canvas needed — purely text-based layout with no crossing lines.
// ============================================================================

import { parsePieChart } from '../pie/parser'
import type { AsciiConfig } from './types'

/** Maximum bar width in characters (represents 100%) */
const MAX_BAR_WIDTH = 40

/**
 * Render a Mermaid pie chart to ASCII/Unicode text.
 *
 * Output format:
 *   Title (centered, if present)
 *   Label1   ████████████████████  42.0%
 *   Label2   ████████████          25.0%
 */
export function renderPieAscii(text: string, config: AsciiConfig): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const chart = parsePieChart(lines)

  if (chart.slices.length === 0) return ''

  const useAscii = config.useAscii
  const fillChar = useAscii ? '#' : '\u2588' // █

  const total = chart.slices.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return ''

  // Compute percentages and bar widths
  const sliceData = chart.slices.map(s => {
    const pct = (s.value / total) * 100
    const barWidth = Math.round((s.value / total) * MAX_BAR_WIDTH)
    return { label: s.label, value: s.value, pct, barWidth }
  })

  // Determine column widths for alignment
  const maxLabelWidth = Math.max(...sliceData.map(s => s.label.length))
  const maxPctStr = sliceData.map(s => s.pct.toFixed(1) + '%')
  const maxPctWidth = Math.max(...maxPctStr.map(s => s.length))

  const outputLines: string[] = []

  // Title
  if (chart.title) {
    // Estimate total row width to center the title
    const sampleRowWidth = 2 + maxLabelWidth + 3 + MAX_BAR_WIDTH + 2 + maxPctWidth
    const titlePad = Math.max(0, Math.floor((sampleRowWidth - chart.title.length) / 2))
    outputLines.push(' '.repeat(titlePad) + chart.title)
  }

  // Data rows
  for (let i = 0; i < sliceData.length; i++) {
    const s = sliceData[i]!
    const pctStr = s.pct.toFixed(1) + '%'
    const bar = fillChar.repeat(s.barWidth)
    const barPad = ' '.repeat(MAX_BAR_WIDTH - s.barWidth)
    const labelPad = ' '.repeat(maxLabelWidth - s.label.length)

    let row = '  ' + s.label + labelPad + '   ' + bar + barPad + '  ' + ' '.repeat(maxPctWidth - pctStr.length) + pctStr

    if (chart.showData) {
      row += '  (' + s.value + ')'
    }

    outputLines.push(row)
  }

  return outputLines.join('\n')
}
