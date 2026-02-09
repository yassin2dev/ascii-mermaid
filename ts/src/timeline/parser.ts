import type { Timeline, TimelineSection, TimelinePeriod } from './types'

// ============================================================================
// Timeline parser
//
// Parses Mermaid timeline syntax into a Timeline structure.
//
// Supported syntax:
//   timeline
//       title My Timeline
//       section Phase 1
//           2023 : Planning : Research
//           2024 : Development
//       section Phase 2
//           2025 : Launch
//           : Support
//
// Lines starting with %% are treated as comments and skipped.
// ============================================================================

/**
 * Parse a Mermaid timeline diagram.
 * Expects the first line to start with "timeline".
 */
export function parseTimeline(lines: string[]): Timeline {
  const timeline: Timeline = {
    sections: [],
  }

  if (lines.length === 0) return timeline

  // Current section being built — starts as unnamed for unsectioned periods
  let currentSection: TimelineSection = { periods: [] }
  let currentPeriod: TimelinePeriod | null = null

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // Title line
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      timeline.title = titleMatch[1]!.trim()
      continue
    }

    // Section header
    const sectionMatch = line.match(/^section\s+(.+)$/i)
    if (sectionMatch) {
      // Push previous section if it has periods
      if (currentSection.periods.length > 0) {
        timeline.sections.push(currentSection)
      }
      currentSection = { name: sectionMatch[1]!.trim(), periods: [] }
      currentPeriod = null
      continue
    }

    // Continuation event: ": event" on its own line (no period name before colon)
    const continuationMatch = line.match(/^:\s*(.+)$/)
    if (continuationMatch) {
      if (currentPeriod) {
        currentPeriod.events.push(continuationMatch[1]!.trim())
      }
      continue
    }

    // Period with events: "period : event1 : event2"
    const periodMatch = line.match(/^([^:]+?)\s*:\s*(.+)$/)
    if (periodMatch) {
      const name = periodMatch[1]!.trim()
      const eventsStr = periodMatch[2]!
      const events = eventsStr.split(':').map(e => e.trim()).filter(e => e.length > 0)

      currentPeriod = { name, events }
      currentSection.periods.push(currentPeriod)
      continue
    }

    // Bare period name (no colon, no events)
    const bare = line.trim()
    if (bare.length > 0) {
      currentPeriod = { name: bare, events: [] }
      currentSection.periods.push(currentPeriod)
    }
  }

  // Push final section if it has periods
  if (currentSection.periods.length > 0) {
    timeline.sections.push(currentSection)
  }

  return timeline
}
