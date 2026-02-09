import type { PieChart, PieSlice } from './types'

// ============================================================================
// Pie chart parser
//
// Parses Mermaid pie chart syntax into a PieChart structure.
//
// Supported syntax:
//   pie [showData]
//       title My Chart Title
//       "Label1" : 42
//       "Label2" : 25.5
//
// Lines starting with %% are treated as comments and skipped.
// ============================================================================

/**
 * Parse a Mermaid pie chart.
 * Expects the first line to start with "pie".
 */
export function parsePieChart(lines: string[]): PieChart {
  const chart: PieChart = {
    showData: false,
    slices: [],
  }

  if (lines.length === 0) return chart

  // Line 0: header — "pie" or "pie showData"
  const header = lines[0]!
  if (/\bshowData\b/i.test(header)) {
    chart.showData = true
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // Title line
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      chart.title = titleMatch[1]!.trim()
      continue
    }

    // Data entry: "Label" : number
    const sliceMatch = line.match(/^"([^"]+)"\s*:\s*([\d.]+)$/)
    if (sliceMatch) {
      chart.slices.push({
        label: sliceMatch[1]!,
        value: parseFloat(sliceMatch[2]!),
      })
      continue
    }
  }

  return chart
}
