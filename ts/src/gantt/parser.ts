import type { GanttChart, GanttSection, GanttTask, GanttTaskTag, ResolvedGanttTask } from './types'

// ============================================================================
// Gantt chart parser
//
// Two-pass parser for Mermaid Gantt chart syntax.
//
// Pass 1 (line-by-line regex):
//   gantt
//       title Project Timeline
//       dateFormat YYYY-MM-DD
//       excludes weekends
//       section Planning
//           Requirements :done, req1, 2024-01-01, 14d
//           Design       :active, des1, after req1, 2024-02-04
//       section Development
//           Backend      :crit, dev1, 2024-02-05, 30d
//
// Pass 2 (date resolution):
//   Resolves "after <id>" references, computes end dates from durations,
//   and fills in missing start dates from prior task end dates.
//
// Lines starting with %% are treated as comments and skipped.
// ============================================================================

const TAG_SET = new Set<string>(['done', 'active', 'crit', 'milestone'])

/**
 * Parse a Mermaid Gantt chart from pre-split, trimmed, non-empty lines.
 * Expects the first line to start with "gantt".
 */
export function parseGanttChart(lines: string[]): GanttChart {
  const chart: GanttChart = {
    dateFormat: 'YYYY-MM-DD',
    excludes: [],
    sections: [],
  }

  if (lines.length === 0) return chart

  let currentSection: GanttSection = { tasks: [] }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // Title
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      chart.title = titleMatch[1]!.trim()
      continue
    }

    // Date format
    const dfMatch = line.match(/^dateFormat\s+(.+)$/i)
    if (dfMatch) {
      chart.dateFormat = dfMatch[1]!.trim()
      continue
    }

    // Excludes
    const exMatch = line.match(/^excludes\s+(.+)$/i)
    if (exMatch) {
      chart.excludes.push(exMatch[1]!.trim())
      continue
    }

    // Section header
    const sectionMatch = line.match(/^section\s+(.+)$/i)
    if (sectionMatch) {
      if (currentSection.tasks.length > 0) {
        chart.sections.push(currentSection)
      }
      currentSection = { name: sectionMatch[1]!.trim(), tasks: [] }
      continue
    }

    // Task line: "Label :metadata" or "Label"
    const taskMatch = line.match(/^(.+?)\s*:(.+)$/)
    if (taskMatch) {
      const label = taskMatch[1]!.trim()
      const metadata = taskMatch[2]!.trim()
      const task = parseTaskMetadata(label, metadata)
      currentSection.tasks.push(task)
      continue
    }
  }

  // Push final section
  if (currentSection.tasks.length > 0) {
    chart.sections.push(currentSection)
  }

  return chart
}

/**
 * Parse task metadata from the comma-separated string after the colon.
 *
 * Metadata fields are positional after consuming known tags:
 *   tags..., [id,] [start,] [end/duration]
 */
function parseTaskMetadata(label: string, metadata: string): GanttTask {
  const parts = metadata.split(',').map(p => p.trim()).filter(p => p.length > 0)

  const tags: GanttTaskTag[] = []
  const remaining: string[] = []

  for (const part of parts) {
    if (TAG_SET.has(part.toLowerCase())) {
      tags.push(part.toLowerCase() as GanttTaskTag)
    } else {
      remaining.push(part)
    }
  }

  const task: GanttTask = { label, tags }

  if (remaining.length === 0) {
    // Tags only, no dates/id
    return task
  }

  if (remaining.length === 1) {
    // Single field: could be id, date, or duration
    const val = remaining[0]!
    if (isDate(val) || isDuration(val)) {
      task.rawEnd = val
    } else if (isAfterRef(val)) {
      task.rawStart = val
    } else {
      task.id = val
    }
    return task
  }

  if (remaining.length === 2) {
    const [a, b] = remaining as [string, string]
    if (isStartValue(a)) {
      // start, end/duration
      task.rawStart = a
      task.rawEnd = b
    } else {
      // id, end/duration or id, start
      task.id = a
      if (isStartValue(b)) {
        task.rawStart = b
      } else {
        task.rawEnd = b
      }
    }
    return task
  }

  if (remaining.length >= 3) {
    // id, start, end/duration
    task.id = remaining[0]!
    task.rawStart = remaining[1]!
    task.rawEnd = remaining[2]!
  }

  return task
}

function isDate(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(val)
}

function isDuration(val: string): boolean {
  return /^\d+[dwDW]$/.test(val)
}

function isAfterRef(val: string): boolean {
  return /^after\s+/i.test(val)
}

function isStartValue(val: string): boolean {
  return isDate(val) || isAfterRef(val)
}

/**
 * Resolve all task dates in a parsed Gantt chart.
 *
 * Walks tasks in order, resolving "after <id>" references by looking up
 * previously resolved task end dates. Tasks with no explicit start inherit
 * the previous task's end date. Milestones with no duration get endDate = startDate.
 */
export function resolveGanttDates(chart: GanttChart): ResolvedGanttTask[] {
  const resolved: ResolvedGanttTask[] = []
  const taskEndById = new Map<string, Date>()

  // Default start: 2024-01-01 if nothing specified
  let prevEnd = new Date(2024, 0, 1)

  for (let si = 0; si < chart.sections.length; si++) {
    const section = chart.sections[si]!
    for (const task of section.tasks) {
      let startDate: Date
      let endDate: Date

      // Resolve start date
      if (task.rawStart && isAfterRef(task.rawStart)) {
        const refId = task.rawStart.replace(/^after\s+/i, '').trim()
        const refEnd = taskEndById.get(refId)
        startDate = refEnd ? new Date(refEnd.getTime()) : new Date(prevEnd.getTime())
      } else if (task.rawStart && isDate(task.rawStart)) {
        startDate = parseDate(task.rawStart)
      } else {
        startDate = new Date(prevEnd.getTime())
      }

      // Resolve end date
      if (task.tags.includes('milestone') && !task.rawEnd) {
        endDate = new Date(startDate.getTime())
      } else if (task.rawEnd && isDate(task.rawEnd)) {
        endDate = parseDate(task.rawEnd)
      } else if (task.rawEnd && isDuration(task.rawEnd)) {
        endDate = addDuration(startDate, task.rawEnd)
      } else {
        // Default: 1 day
        endDate = new Date(startDate.getTime())
        endDate.setDate(endDate.getDate() + 1)
      }

      const rt: ResolvedGanttTask = {
        label: task.label,
        id: task.id,
        tags: [...task.tags],
        startDate,
        endDate,
        sectionIndex: si,
      }

      resolved.push(rt)

      if (task.id) {
        taskEndById.set(task.id, endDate)
      }

      prevEnd = endDate
    }
  }

  return resolved
}

function parseDate(val: string): Date {
  const [y, m, d] = val.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

function addDuration(start: Date, duration: string): Date {
  const match = duration.match(/^(\d+)([dwDW])$/)
  if (!match) return new Date(start.getTime())

  const amount = parseInt(match[1]!, 10)
  const unit = match[2]!.toLowerCase()
  const result = new Date(start.getTime())

  if (unit === 'd') {
    result.setDate(result.getDate() + amount)
  } else if (unit === 'w') {
    result.setDate(result.getDate() + amount * 7)
  }

  return result
}
