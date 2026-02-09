// ============================================================================
// Gantt chart types
//
// Models the parsed representation of a Mermaid Gantt chart.
// Gantt charts show tasks on a horizontal timeline with sections,
// durations, dependencies, and status tags.
// ============================================================================

/** Tag indicating task status/appearance */
export type GanttTaskTag = 'done' | 'active' | 'crit' | 'milestone'

/** Parsed Gantt chart -- logical structure from mermaid text */
export interface GanttChart {
  /** Optional chart title */
  title?: string
  /** Date format string (default "YYYY-MM-DD") */
  dateFormat: string
  /** Excluded date patterns (parsed but not used for v1 duration calc) */
  excludes: string[]
  /** Sections containing tasks */
  sections: GanttSection[]
}

/** A named or unnamed group of tasks */
export interface GanttSection {
  /** Section name, or undefined for unsectioned tasks */
  name?: string
  /** Tasks in this section */
  tasks: GanttTask[]
}

/** A single task as parsed (before date resolution) */
export interface GanttTask {
  /** Display label */
  label: string
  /** Optional task ID for dependency references */
  id?: string
  /** Status/appearance tags */
  tags: GanttTaskTag[]
  /** Raw start value: date string, "after <id>", or undefined */
  rawStart?: string
  /** Raw end value: date string, duration string, or undefined */
  rawEnd?: string
}

/** A task with resolved absolute dates */
export interface ResolvedGanttTask {
  /** Display label */
  label: string
  /** Optional task ID */
  id?: string
  /** Status/appearance tags */
  tags: GanttTaskTag[]
  /** Resolved start date */
  startDate: Date
  /** Resolved end date */
  endDate: Date
  /** Index of the section this task belongs to */
  sectionIndex: number
}
