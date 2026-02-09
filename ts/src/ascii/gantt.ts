// ============================================================================
// ASCII renderer -- Gantt charts
//
// Renders Gantt chart text as horizontal task bars on a timeline.
// Each task gets a proportional bar with date annotations.
// No canvas needed -- purely text-based layout with no crossing lines.
// ============================================================================

import { parseGanttChart, resolveGanttDates } from '../gantt/parser'
import type { ResolvedGanttTask } from '../gantt/types'
import type { AsciiConfig } from './types'

/** Maximum bar width in characters */
const BAR_WIDTH = 30

/**
 * Render a Mermaid Gantt chart to ASCII/Unicode text.
 *
 * Output format:
 *                    Project Timeline
 *   Planning
 *     Requirements  ████████░░░░░░░░░░░░░░░░░░░░░░  01-01 -> 01-14
 *     Design        ░░░░░░░░████████████░░░░░░░░░░░  01-15 -> 02-04
 *   Development
 *     Backend       ░░░░░░░░░░░░░░░░░░░░████████████  02-05 -> 03-06
 */
export function renderGanttAscii(text: string, config: AsciiConfig): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const chart = parseGanttChart(lines)

  const resolved = resolveGanttDates(chart)
  if (resolved.length === 0) return ''

  const useAscii = config.useAscii

  // Fill characters by task state — all task fills are visually heavy
  // so bars stand out clearly against the light empty background.
  const fillNormal = useAscii ? '#' : '\u2588'    // █  solid
  const fillDone   = useAscii ? ':' : '\u2592'    // ▒  medium shade (completed, dotted)
  const fillCrit   = useAscii ? 'X' : '\u256c'    // ╬  cross-hatch (attention)
  const fillEmpty  = useAscii ? '-' : '\u2500'    // ─  thin line
  const milestone  = useAscii ? '<>' : '\u25c6'   // ◆

  // Compute global time range
  const globalStart = Math.min(...resolved.map(t => t.startDate.getTime()))
  const globalEnd = Math.max(...resolved.map(t => t.endDate.getTime()))
  const globalSpan = globalEnd - globalStart

  // Determine max label width for alignment
  const maxLabelWidth = Math.max(...resolved.map(t => t.label.length))

  // Estimate total row width for title centering
  // "    Label   bar   date"
  const sampleRowWidth = 4 + maxLabelWidth + 2 + BAR_WIDTH + 2 + 17

  const outputLines: string[] = []

  // Title
  if (chart.title) {
    const titlePad = Math.max(0, Math.floor((sampleRowWidth - chart.title.length) / 2))
    outputLines.push(' '.repeat(titlePad) + chart.title)
  }

  // Track which sections we've already emitted headers for
  let lastSectionIndex = -1

  for (const task of resolved) {
    // Section header
    if (task.sectionIndex !== lastSectionIndex) {
      lastSectionIndex = task.sectionIndex
      const section = chart.sections[task.sectionIndex]!
      if (section.name) {
        outputLines.push('  ' + section.name)
      }
    }

    const isMilestone = task.tags.includes('milestone')
    const labelPad = ' '.repeat(maxLabelWidth - task.label.length)

    if (isMilestone) {
      // Milestone: single marker at computed position
      const pos = globalSpan > 0
        ? Math.min(Math.round((task.startDate.getTime() - globalStart) / globalSpan * (BAR_WIDTH - 1)), BAR_WIDTH - 1)
        : 0
      const bar = fillEmpty.repeat(pos) + milestone + fillEmpty.repeat(Math.max(0, BAR_WIDTH - pos - milestoneWidth(milestone)))
      const dateStr = formatDate(task.startDate)
      outputLines.push('    ' + task.label + labelPad + '  ' + bar + '  ' + dateStr)
    } else {
      // Regular task bar
      let barStart = 0
      let barEnd = BAR_WIDTH
      if (globalSpan > 0) {
        barStart = Math.floor((task.startDate.getTime() - globalStart) / globalSpan * BAR_WIDTH)
        barEnd = Math.ceil((task.endDate.getTime() - globalStart) / globalSpan * BAR_WIDTH)
      }
      barStart = Math.max(0, Math.min(barStart, BAR_WIDTH))
      barEnd = Math.max(barStart, Math.min(barEnd, BAR_WIDTH))
      // Ensure at least 1 char wide for non-milestone tasks
      if (barEnd === barStart && barEnd < BAR_WIDTH) barEnd = barStart + 1

      const fillChar = getFillChar(task, fillNormal, fillDone, fillCrit)
      const bar =
        fillEmpty.repeat(barStart) +
        fillChar.repeat(barEnd - barStart) +
        fillEmpty.repeat(BAR_WIDTH - barEnd)

      const dateStr = formatDate(task.startDate) + ' -> ' + formatDate(task.endDate)
      outputLines.push('    ' + task.label + labelPad + '  ' + bar + '  ' + dateStr)
    }
  }

  return outputLines.join('\n')
}

function getFillChar(task: ResolvedGanttTask, normal: string, done: string, crit: string): string {
  if (task.tags.includes('crit')) return crit
  if (task.tags.includes('done')) return done
  return normal
}

function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return mm + '-' + dd
}

function milestoneWidth(marker: string): number {
  // '<>' is 2 chars, '◆' is 1 char
  return marker.length
}
