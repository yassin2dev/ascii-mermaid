// ============================================================================
// Pie chart types
//
// Models the parsed representation of a Mermaid pie chart.
// Pie charts show proportional data as labeled slices with values.
// ============================================================================

/** Parsed pie chart — logical structure from mermaid text */
export interface PieChart {
  /** Optional chart title */
  title?: string
  /** Whether to show raw data values alongside percentages */
  showData: boolean
  /** Data slices */
  slices: PieSlice[]
}

export interface PieSlice {
  /** Display label */
  label: string
  /** Numeric value */
  value: number
}
