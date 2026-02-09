interface AsciiRenderOptions {
    /** true = ASCII chars (+,-,|,>), false = Unicode box-drawing (┌,─,│,►). Default: false */
    useAscii?: boolean;
    /** Horizontal spacing between nodes. Default: 5 */
    paddingX?: number;
    /** Vertical spacing between nodes. Default: 5 */
    paddingY?: number;
    /** Padding inside node boxes. Default: 1 */
    boxBorderPadding?: number;
}
/**
 * Render Mermaid diagram text to an ASCII/Unicode string.
 *
 * Synchronous — no async layout engine needed (unlike the SVG renderer).
 * Auto-detects diagram type from the header line and dispatches to
 * the appropriate renderer.
 *
 * @param text - Mermaid source text (any supported diagram type)
 * @param options - Rendering options
 * @returns Multi-line ASCII/Unicode string
 *
 * @example
 * ```ts
 * const result = renderMermaidAscii(`
 *   graph LR
 *     A --> B --> C
 * `, { useAscii: true })
 *
 * // Output:
 * // +---+     +---+     +---+
 * // |   |     |   |     |   |
 * // | A |---->| B |---->| C |
 * // |   |     |   |     |   |
 * // +---+     +---+     +---+
 * ```
 */
declare function renderMermaidAscii(text: string, options?: AsciiRenderOptions): string;

/** Configuration for ASCII rendering. */
interface AsciiConfig {
    /** true = ASCII chars (+,-,|), false = Unicode box-drawing (┌,─,│). Default: false */
    useAscii: boolean;
    /** Horizontal spacing between nodes. Default: 5 */
    paddingX: number;
    /** Vertical spacing between nodes. Default: 5 */
    paddingY: number;
    /** Padding inside node boxes. Default: 1 */
    boxBorderPadding: number;
    /** Graph direction: "LR" or "TD". */
    graphDirection: 'LR' | 'TD';
}

export { type AsciiConfig, renderMermaidAscii };
