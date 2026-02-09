// ============================================================================
// Timeline diagram types
//
// Models the parsed representation of a Mermaid timeline diagram.
// Timelines show chronological events organized by time periods
// and optional sections.
// ============================================================================

/** Parsed timeline — logical structure from mermaid text */
export interface Timeline {
  /** Optional diagram title */
  title?: string
  /** Sections containing time periods (may include one unnamed section) */
  sections: TimelineSection[]
}

/** A named or unnamed group of time periods */
export interface TimelineSection {
  /** Section name, or undefined for unsectioned periods */
  name?: string
  /** Time periods in this section */
  periods: TimelinePeriod[]
}

/** A single time period with associated events */
export interface TimelinePeriod {
  /** Period label (e.g. "2023", "Q1") */
  name: string
  /** Events that occurred in this period */
  events: string[]
}
