// src/parser.ts
function parseMermaid(text) {
  const lines = text.split(/[\n;]/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("%%"));
  if (lines.length === 0) {
    throw new Error("Empty mermaid diagram");
  }
  const header = lines[0];
  if (/^stateDiagram(-v2)?\s*$/i.test(header)) {
    return parseStateDiagram(lines);
  }
  return parseFlowchart(lines);
}
function parseFlowchart(lines) {
  const headerMatch = lines[0].match(/^(?:graph|flowchart)\s+(TD|TB|LR|BT|RL)\s*$/i);
  if (!headerMatch) {
    throw new Error(`Invalid mermaid header: "${lines[0]}". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.`);
  }
  const direction = headerMatch[1].toUpperCase();
  const graph = {
    direction,
    nodes: /* @__PURE__ */ new Map(),
    edges: [],
    subgraphs: [],
    classDefs: /* @__PURE__ */ new Map(),
    classAssignments: /* @__PURE__ */ new Map(),
    nodeStyles: /* @__PURE__ */ new Map()
  };
  const subgraphStack = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const classDefMatch = line.match(/^classDef\s+(\w+)\s+(.+)$/);
    if (classDefMatch) {
      const name = classDefMatch[1];
      const propsStr = classDefMatch[2];
      const props = parseStyleProps(propsStr);
      graph.classDefs.set(name, props);
      continue;
    }
    const classAssignMatch = line.match(/^class\s+([\w,-]+)\s+(\w+)$/);
    if (classAssignMatch) {
      const nodeIds = classAssignMatch[1].split(",").map((s) => s.trim());
      const className = classAssignMatch[2];
      for (const id of nodeIds) {
        graph.classAssignments.set(id, className);
      }
      continue;
    }
    const styleMatch = line.match(/^style\s+([\w,-]+)\s+(.+)$/);
    if (styleMatch) {
      const nodeIds = styleMatch[1].split(",").map((s) => s.trim());
      const props = parseStyleProps(styleMatch[2]);
      for (const id of nodeIds) {
        graph.nodeStyles.set(id, { ...graph.nodeStyles.get(id), ...props });
      }
      continue;
    }
    const dirMatch = line.match(/^direction\s+(TD|TB|LR|BT|RL)\s*$/i);
    if (dirMatch && subgraphStack.length > 0) {
      subgraphStack[subgraphStack.length - 1].direction = dirMatch[1].toUpperCase();
      continue;
    }
    const subgraphMatch = line.match(/^subgraph\s+(.+)$/);
    if (subgraphMatch) {
      const rest = subgraphMatch[1].trim();
      const bracketMatch = rest.match(/^([\w-]+)\s*\[(.+)\]$/);
      let id;
      let label;
      if (bracketMatch) {
        id = bracketMatch[1];
        label = bracketMatch[2];
      } else {
        label = rest;
        id = rest.replace(/\s+/g, "_").replace(/[^\w]/g, "");
      }
      const sg = { id, label, nodeIds: [], children: [] };
      subgraphStack.push(sg);
      continue;
    }
    if (line === "end") {
      const completed = subgraphStack.pop();
      if (completed) {
        if (subgraphStack.length > 0) {
          subgraphStack[subgraphStack.length - 1].children.push(completed);
        } else {
          graph.subgraphs.push(completed);
        }
      }
      continue;
    }
    parseEdgeLine(line, graph, subgraphStack);
  }
  return graph;
}
function parseStateDiagram(lines) {
  const graph = {
    direction: "TD",
    nodes: /* @__PURE__ */ new Map(),
    edges: [],
    subgraphs: [],
    classDefs: /* @__PURE__ */ new Map(),
    classAssignments: /* @__PURE__ */ new Map(),
    nodeStyles: /* @__PURE__ */ new Map()
  };
  const compositeStack = [];
  let startCount = 0;
  let endCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const dirMatch = line.match(/^direction\s+(TD|TB|LR|BT|RL)\s*$/i);
    if (dirMatch) {
      if (compositeStack.length > 0) {
        compositeStack[compositeStack.length - 1].direction = dirMatch[1].toUpperCase();
      } else {
        graph.direction = dirMatch[1].toUpperCase();
      }
      continue;
    }
    const compositeMatch = line.match(/^state\s+(?:"([^"]+)"\s+as\s+)?(\w+)\s*\{$/);
    if (compositeMatch) {
      const label = compositeMatch[1] ?? compositeMatch[2];
      const id = compositeMatch[2];
      const sg = { id, label, nodeIds: [], children: [] };
      compositeStack.push(sg);
      continue;
    }
    if (line === "}") {
      const completed = compositeStack.pop();
      if (completed) {
        if (compositeStack.length > 0) {
          compositeStack[compositeStack.length - 1].children.push(completed);
        } else {
          graph.subgraphs.push(completed);
        }
      }
      continue;
    }
    const stateAliasMatch = line.match(/^state\s+"([^"]+)"\s+as\s+(\w+)\s*$/);
    if (stateAliasMatch) {
      const label = stateAliasMatch[1];
      const id = stateAliasMatch[2];
      registerStateNode(graph, compositeStack, { id, label, shape: "rounded" });
      continue;
    }
    const transitionMatch = line.match(/^(\[\*\]|[\w-]+)\s*(-->)\s*(\[\*\]|[\w-]+)(?:\s*:\s*(.+))?$/);
    if (transitionMatch) {
      let sourceId = transitionMatch[1];
      let targetId = transitionMatch[3];
      const edgeLabel = transitionMatch[4]?.trim() || void 0;
      if (sourceId === "[*]") {
        startCount++;
        sourceId = `_start${startCount > 1 ? startCount : ""}`;
        registerStateNode(graph, compositeStack, { id: sourceId, label: "", shape: "state-start" });
      } else {
        ensureStateNode(graph, compositeStack, sourceId);
      }
      if (targetId === "[*]") {
        endCount++;
        targetId = `_end${endCount > 1 ? endCount : ""}`;
        registerStateNode(graph, compositeStack, { id: targetId, label: "", shape: "state-end" });
      } else {
        ensureStateNode(graph, compositeStack, targetId);
      }
      graph.edges.push({
        source: sourceId,
        target: targetId,
        label: edgeLabel,
        style: "solid",
        hasArrowStart: false,
        hasArrowEnd: true
      });
      continue;
    }
    const stateDescMatch = line.match(/^([\w-]+)\s*:\s*(.+)$/);
    if (stateDescMatch) {
      const id = stateDescMatch[1];
      const label = stateDescMatch[2].trim();
      registerStateNode(graph, compositeStack, { id, label, shape: "rounded" });
      continue;
    }
  }
  return graph;
}
function registerStateNode(graph, compositeStack, node) {
  const isNew = !graph.nodes.has(node.id);
  if (isNew) {
    graph.nodes.set(node.id, node);
  }
  if (compositeStack.length > 0) {
    const current = compositeStack[compositeStack.length - 1];
    if (!current.nodeIds.includes(node.id)) {
      current.nodeIds.push(node.id);
    }
  }
}
function ensureStateNode(graph, compositeStack, id) {
  if (!graph.nodes.has(id)) {
    registerStateNode(graph, compositeStack, { id, label: id, shape: "rounded" });
  } else {
    if (compositeStack.length > 0) {
      const current = compositeStack[compositeStack.length - 1];
      if (!current.nodeIds.includes(id)) {
        current.nodeIds.push(id);
      }
    }
  }
}
function parseStyleProps(propsStr) {
  const props = {};
  for (const pair of propsStr.split(",")) {
    const colonIdx = pair.indexOf(":");
    if (colonIdx > 0) {
      const key = pair.slice(0, colonIdx).trim();
      const val = pair.slice(colonIdx + 1).trim();
      if (key && val) {
        props[key] = val;
      }
    }
  }
  return props;
}
var ARROW_REGEX = /^(<)?(-->|-.->|==>|---|-\.-|===)(?:\|([^|]*)\|)?/;
var NODE_PATTERNS = [
  // Triple delimiters (must be first)
  { regex: /^([\w-]+)\(\(\((.+?)\)\)\)/, shape: "doublecircle" },
  // A(((text)))
  // Double delimiters with mixed brackets
  { regex: /^([\w-]+)\(\[(.+?)\]\)/, shape: "stadium" },
  // A([text])
  { regex: /^([\w-]+)\(\((.+?)\)\)/, shape: "circle" },
  // A((text))
  { regex: /^([\w-]+)\[\[(.+?)\]\]/, shape: "subroutine" },
  // A[[text]]
  { regex: /^([\w-]+)\[\((.+?)\)\]/, shape: "cylinder" },
  // A[(text)]
  // Trapezoid variants — must come before plain [text]
  { regex: /^([\w-]+)\[\/(.+?)\\\]/, shape: "trapezoid" },
  // A[/text\]
  { regex: /^([\w-]+)\[\\(.+?)\/\]/, shape: "trapezoid-alt" },
  // A[\text/]
  // Asymmetric flag shape
  { regex: /^([\w-]+)>(.+?)\]/, shape: "asymmetric" },
  // A>text]
  // Double curly braces (hexagon) — must come before single {text}
  { regex: /^([\w-]+)\{\{(.+?)\}\}/, shape: "hexagon" },
  // A{{text}}
  // Single-char delimiters (last — most common, least specific)
  { regex: /^([\w-]+)\[(.+?)\]/, shape: "rectangle" },
  // A[text]
  { regex: /^([\w-]+)\((.+?)\)/, shape: "rounded" },
  // A(text)
  { regex: /^([\w-]+)\{(.+?)\}/, shape: "diamond" }
  // A{text}
];
var BARE_NODE_REGEX = /^([\w-]+)/;
var CLASS_SHORTHAND_REGEX = /^:::([\w][\w-]*)/;
function parseEdgeLine(line, graph, subgraphStack) {
  let remaining = line.trim();
  const firstGroup = consumeNodeGroup(remaining, graph, subgraphStack);
  if (!firstGroup || firstGroup.ids.length === 0) return;
  remaining = firstGroup.remaining.trim();
  let prevGroupIds = firstGroup.ids;
  while (remaining.length > 0) {
    const arrowMatch = remaining.match(ARROW_REGEX);
    if (!arrowMatch) break;
    const hasArrowStart = Boolean(arrowMatch[1]);
    const arrowOp = arrowMatch[2];
    const edgeLabel = arrowMatch[3]?.trim() || void 0;
    remaining = remaining.slice(arrowMatch[0].length).trim();
    const style = arrowStyleFromOp(arrowOp);
    const hasArrowEnd = arrowOp.endsWith(">");
    const nextGroup = consumeNodeGroup(remaining, graph, subgraphStack);
    if (!nextGroup || nextGroup.ids.length === 0) break;
    remaining = nextGroup.remaining.trim();
    for (const sourceId of prevGroupIds) {
      for (const targetId of nextGroup.ids) {
        graph.edges.push({
          source: sourceId,
          target: targetId,
          label: edgeLabel,
          style,
          hasArrowStart,
          hasArrowEnd
        });
      }
    }
    prevGroupIds = nextGroup.ids;
  }
}
function consumeNodeGroup(text, graph, subgraphStack) {
  const first = consumeNode(text, graph, subgraphStack);
  if (!first) return null;
  const ids = [first.id];
  let remaining = first.remaining.trim();
  while (remaining.startsWith("&")) {
    remaining = remaining.slice(1).trim();
    const next = consumeNode(remaining, graph, subgraphStack);
    if (!next) break;
    ids.push(next.id);
    remaining = next.remaining.trim();
  }
  return { ids, remaining };
}
function consumeNode(text, graph, subgraphStack) {
  let id = null;
  let remaining = text;
  for (const { regex, shape } of NODE_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      id = match[1];
      const label = match[2];
      registerNode(graph, subgraphStack, { id, label, shape });
      remaining = text.slice(match[0].length);
      break;
    }
  }
  if (id === null) {
    const bareMatch = text.match(BARE_NODE_REGEX);
    if (bareMatch) {
      id = bareMatch[1];
      if (!graph.nodes.has(id)) {
        registerNode(graph, subgraphStack, { id, label: id, shape: "rectangle" });
      } else {
        trackInSubgraph(subgraphStack, id);
      }
      remaining = text.slice(bareMatch[0].length);
    }
  }
  if (id === null) return null;
  const classMatch = remaining.match(CLASS_SHORTHAND_REGEX);
  if (classMatch) {
    graph.classAssignments.set(id, classMatch[1]);
    remaining = remaining.slice(classMatch[0].length);
  }
  return { id, remaining };
}
function registerNode(graph, subgraphStack, node) {
  const isNew = !graph.nodes.has(node.id);
  if (isNew) {
    graph.nodes.set(node.id, node);
  }
  trackInSubgraph(subgraphStack, node.id);
}
function trackInSubgraph(subgraphStack, nodeId) {
  if (subgraphStack.length > 0) {
    const current = subgraphStack[subgraphStack.length - 1];
    if (!current.nodeIds.includes(nodeId)) {
      current.nodeIds.push(nodeId);
    }
  }
}
function arrowStyleFromOp(op) {
  if (op === "-.->") return "dotted";
  if (op === "-.-") return "dotted";
  if (op === "==>") return "thick";
  if (op === "===") return "thick";
  return "solid";
}

// src/ascii/types.ts
var Up = { x: 1, y: 0 };
var Down = { x: 1, y: 2 };
var Left = { x: 0, y: 1 };
var Right = { x: 2, y: 1 };
var UpperRight = { x: 2, y: 0 };
var UpperLeft = { x: 0, y: 0 };
var LowerRight = { x: 2, y: 2 };
var LowerLeft = { x: 0, y: 2 };
var Middle = { x: 1, y: 1 };
function gridCoordEquals(a, b) {
  return a.x === b.x && a.y === b.y;
}
function drawingCoordEquals(a, b) {
  return a.x === b.x && a.y === b.y;
}
function gridCoordDirection(c, dir) {
  return { x: c.x + dir.x, y: c.y + dir.y };
}
function gridKey(c) {
  return `${c.x},${c.y}`;
}
var EMPTY_STYLE = { name: "", styles: {} };

// src/ascii/canvas.ts
function mkCanvas(x, y) {
  const canvas = [];
  for (let i = 0; i <= x; i++) {
    const col = [];
    for (let j = 0; j <= y; j++) {
      col.push(" ");
    }
    canvas.push(col);
  }
  return canvas;
}
function copyCanvas(source) {
  const [maxX, maxY] = getCanvasSize(source);
  return mkCanvas(maxX, maxY);
}
function getCanvasSize(canvas) {
  return [canvas.length - 1, (canvas[0]?.length ?? 1) - 1];
}
function increaseSize(canvas, newX, newY) {
  const [currX, currY] = getCanvasSize(canvas);
  const targetX = Math.max(newX, currX);
  const targetY = Math.max(newY, currY);
  const grown = mkCanvas(targetX, targetY);
  for (let x = 0; x < grown.length; x++) {
    for (let y = 0; y < grown[0].length; y++) {
      if (x < canvas.length && y < canvas[0].length) {
        grown[x][y] = canvas[x][y];
      }
    }
  }
  canvas.length = 0;
  canvas.push(...grown);
  return canvas;
}
var JUNCTION_CHARS = /* @__PURE__ */ new Set([
  "\u2500",
  "\u2502",
  "\u250C",
  "\u2510",
  "\u2514",
  "\u2518",
  "\u251C",
  "\u2524",
  "\u252C",
  "\u2534",
  "\u253C",
  "\u2574",
  "\u2575",
  "\u2576",
  "\u2577"
]);
function isJunctionChar(c) {
  return JUNCTION_CHARS.has(c);
}
var JUNCTION_MAP = {
  "\u2500": { "\u2502": "\u253C", "\u250C": "\u252C", "\u2510": "\u252C", "\u2514": "\u2534", "\u2518": "\u2534", "\u251C": "\u253C", "\u2524": "\u253C", "\u252C": "\u252C", "\u2534": "\u2534" },
  "\u2502": { "\u2500": "\u253C", "\u250C": "\u251C", "\u2510": "\u2524", "\u2514": "\u251C", "\u2518": "\u2524", "\u251C": "\u251C", "\u2524": "\u2524", "\u252C": "\u253C", "\u2534": "\u253C" },
  "\u250C": { "\u2500": "\u252C", "\u2502": "\u251C", "\u2510": "\u252C", "\u2514": "\u251C", "\u2518": "\u253C", "\u251C": "\u251C", "\u2524": "\u253C", "\u252C": "\u252C", "\u2534": "\u253C" },
  "\u2510": { "\u2500": "\u252C", "\u2502": "\u2524", "\u250C": "\u252C", "\u2514": "\u253C", "\u2518": "\u2524", "\u251C": "\u253C", "\u2524": "\u2524", "\u252C": "\u252C", "\u2534": "\u253C" },
  "\u2514": { "\u2500": "\u2534", "\u2502": "\u251C", "\u250C": "\u251C", "\u2510": "\u253C", "\u2518": "\u2534", "\u251C": "\u251C", "\u2524": "\u253C", "\u252C": "\u253C", "\u2534": "\u2534" },
  "\u2518": { "\u2500": "\u2534", "\u2502": "\u2524", "\u250C": "\u253C", "\u2510": "\u2524", "\u2514": "\u2534", "\u251C": "\u253C", "\u2524": "\u2524", "\u252C": "\u253C", "\u2534": "\u2534" },
  "\u251C": { "\u2500": "\u253C", "\u2502": "\u251C", "\u250C": "\u251C", "\u2510": "\u253C", "\u2514": "\u251C", "\u2518": "\u253C", "\u2524": "\u253C", "\u252C": "\u253C", "\u2534": "\u253C" },
  "\u2524": { "\u2500": "\u253C", "\u2502": "\u2524", "\u250C": "\u253C", "\u2510": "\u2524", "\u2514": "\u253C", "\u2518": "\u2524", "\u251C": "\u253C", "\u252C": "\u253C", "\u2534": "\u253C" },
  "\u252C": { "\u2500": "\u252C", "\u2502": "\u253C", "\u250C": "\u252C", "\u2510": "\u252C", "\u2514": "\u253C", "\u2518": "\u253C", "\u251C": "\u253C", "\u2524": "\u253C", "\u2534": "\u253C" },
  "\u2534": { "\u2500": "\u2534", "\u2502": "\u253C", "\u250C": "\u253C", "\u2510": "\u253C", "\u2514": "\u2534", "\u2518": "\u2534", "\u251C": "\u253C", "\u2524": "\u253C", "\u252C": "\u253C" }
};
function mergeJunctions(c1, c2) {
  return JUNCTION_MAP[c1]?.[c2] ?? c1;
}
function mergeCanvases(base, offset, useAscii, ...overlays) {
  let [maxX, maxY] = getCanvasSize(base);
  for (const overlay of overlays) {
    const [oX, oY] = getCanvasSize(overlay);
    maxX = Math.max(maxX, oX + offset.x);
    maxY = Math.max(maxY, oY + offset.y);
  }
  const merged = mkCanvas(maxX, maxY);
  for (let x = 0; x <= maxX; x++) {
    for (let y = 0; y <= maxY; y++) {
      if (x < base.length && y < base[0].length) {
        merged[x][y] = base[x][y];
      }
    }
  }
  for (const overlay of overlays) {
    for (let x = 0; x < overlay.length; x++) {
      for (let y = 0; y < overlay[0].length; y++) {
        const c = overlay[x][y];
        if (c !== " ") {
          const mx = x + offset.x;
          const my = y + offset.y;
          const current = merged[mx][my];
          if (!useAscii && isJunctionChar(c) && isJunctionChar(current)) {
            merged[mx][my] = mergeJunctions(current, c);
          } else {
            merged[mx][my] = c;
          }
        }
      }
    }
  }
  return merged;
}
function canvasToString(canvas) {
  const [maxX, maxY] = getCanvasSize(canvas);
  const lines = [];
  for (let y = 0; y <= maxY; y++) {
    let line = "";
    for (let x = 0; x <= maxX; x++) {
      line += canvas[x][y];
    }
    lines.push(line);
  }
  return lines.join("\n");
}
var VERTICAL_FLIP_MAP = {
  // Unicode arrows
  "\u25B2": "\u25BC",
  "\u25BC": "\u25B2",
  "\u25E4": "\u25E3",
  "\u25E3": "\u25E4",
  "\u25E5": "\u25E2",
  "\u25E2": "\u25E5",
  // ASCII arrows
  "^": "v",
  "v": "^",
  // Unicode corners
  "\u250C": "\u2514",
  "\u2514": "\u250C",
  "\u2510": "\u2518",
  "\u2518": "\u2510",
  // Unicode junctions (T-pieces flip vertically)
  "\u252C": "\u2534",
  "\u2534": "\u252C",
  // Box-start junctions (exit points from node boxes)
  "\u2575": "\u2577",
  "\u2577": "\u2575"
};
function flipCanvasVertically(canvas) {
  for (const col of canvas) {
    col.reverse();
  }
  for (const col of canvas) {
    for (let y = 0; y < col.length; y++) {
      const flipped = VERTICAL_FLIP_MAP[col[y]];
      if (flipped) col[y] = flipped;
    }
  }
  return canvas;
}
function drawText(canvas, start, text) {
  increaseSize(canvas, start.x + text.length, start.y);
  for (let i = 0; i < text.length; i++) {
    canvas[start.x + i][start.y] = text[i];
  }
}
function setCanvasSizeToGrid(canvas, columnWidth, rowHeight) {
  let maxX = 0;
  let maxY = 0;
  for (const w of columnWidth.values()) maxX += w;
  for (const h of rowHeight.values()) maxY += h;
  increaseSize(canvas, maxX - 1, maxY - 1);
}

// src/ascii/converter.ts
function convertToAsciiGraph(parsed, config) {
  const nodeMap = /* @__PURE__ */ new Map();
  let index = 0;
  for (const [id, mNode] of parsed.nodes) {
    const asciiNode = {
      // Use the parser ID as the unique identity key to avoid collisions
      // when multiple nodes share the same label (e.g. A[Web Server], C[Web Server]).
      name: id,
      // The label is used for rendering inside the box.
      displayLabel: mNode.label,
      index,
      gridCoord: null,
      drawingCoord: null,
      drawing: null,
      drawn: false,
      styleClassName: "",
      styleClass: EMPTY_STYLE
    };
    nodeMap.set(id, asciiNode);
    index++;
  }
  const nodes = [...nodeMap.values()];
  const edges = [];
  for (const mEdge of parsed.edges) {
    const from = nodeMap.get(mEdge.source);
    const to = nodeMap.get(mEdge.target);
    if (!from || !to) continue;
    edges.push({
      from,
      to,
      text: mEdge.label ?? "",
      path: [],
      labelLine: [],
      startDir: { x: 0, y: 0 },
      endDir: { x: 0, y: 0 }
    });
  }
  const subgraphs = [];
  for (const mSg of parsed.subgraphs) {
    convertSubgraph(mSg, null, nodeMap, subgraphs);
  }
  deduplicateSubgraphNodes(parsed.subgraphs, subgraphs, nodeMap);
  for (const [nodeId, className] of parsed.classAssignments) {
    const node = nodeMap.get(nodeId);
    const classDef = parsed.classDefs.get(className);
    if (node && classDef) {
      node.styleClassName = className;
      node.styleClass = { name: className, styles: classDef };
    }
  }
  return {
    nodes,
    edges,
    canvas: mkCanvas(0, 0),
    grid: /* @__PURE__ */ new Map(),
    columnWidth: /* @__PURE__ */ new Map(),
    rowHeight: /* @__PURE__ */ new Map(),
    subgraphs,
    config,
    offsetX: 0,
    offsetY: 0
  };
}
function convertSubgraph(mSg, parent, nodeMap, allSubgraphs) {
  const sg = {
    name: mSg.label,
    nodes: [],
    parent,
    children: [],
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0
  };
  for (const nodeId of mSg.nodeIds) {
    const node = nodeMap.get(nodeId);
    if (node) sg.nodes.push(node);
  }
  allSubgraphs.push(sg);
  for (const childMSg of mSg.children) {
    const child = convertSubgraph(childMSg, sg, nodeMap, allSubgraphs);
    sg.children.push(child);
    for (const childNode of child.nodes) {
      if (!sg.nodes.includes(childNode)) {
        sg.nodes.push(childNode);
      }
    }
  }
  return sg;
}
function deduplicateSubgraphNodes(mermaidSubgraphs, asciiSubgraphs, nodeMap, parsed) {
  const sgMap = /* @__PURE__ */ new Map();
  buildSgMap(mermaidSubgraphs, asciiSubgraphs, sgMap);
  const nodeOwner = /* @__PURE__ */ new Map();
  function claimNodes(mSg) {
    const asciiSg = sgMap.get(mSg);
    if (!asciiSg) return;
    for (const child of mSg.children) {
      claimNodes(child);
    }
    for (const nodeId of mSg.nodeIds) {
      if (!nodeOwner.has(nodeId)) {
        nodeOwner.set(nodeId, asciiSg);
      }
    }
  }
  for (const mSg of mermaidSubgraphs) {
    claimNodes(mSg);
  }
  for (const asciiSg of asciiSubgraphs) {
    asciiSg.nodes = asciiSg.nodes.filter((node) => {
      let nodeId;
      for (const [id, n] of nodeMap) {
        if (n === node) {
          nodeId = id;
          break;
        }
      }
      if (!nodeId) return false;
      const owner = nodeOwner.get(nodeId);
      if (!owner) return true;
      return isAncestorOrSelf(asciiSg, owner);
    });
  }
}
function isAncestorOrSelf(candidate, target) {
  let current = target;
  while (current !== null) {
    if (current === candidate) return true;
    current = current.parent;
  }
  return false;
}
function buildSgMap(mSgs, aSgs, result) {
  const flatMermaid = [];
  function flatten(sgs) {
    for (const sg of sgs) {
      flatMermaid.push(sg);
      flatten(sg.children);
    }
  }
  flatten(mSgs);
  for (let i = 0; i < flatMermaid.length && i < aSgs.length; i++) {
    result.set(flatMermaid[i], aSgs[i]);
  }
}

// src/ascii/pathfinder.ts
var MinHeap = class {
  constructor() {
    this.items = [];
  }
  get length() {
    return this.items.length;
  }
  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }
  pop() {
    if (this.items.length === 0) return void 0;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return top;
  }
  bubbleUp(i) {
    while (i > 0) {
      const parent = i - 1 >> 1;
      if (this.items[i].priority < this.items[parent].priority) {
        [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
        i = parent;
      } else {
        break;
      }
    }
  }
  sinkDown(i) {
    const n = this.items.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.items[left].priority < this.items[smallest].priority) {
        smallest = left;
      }
      if (right < n && this.items[right].priority < this.items[smallest].priority) {
        smallest = right;
      }
      if (smallest !== i) {
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      } else {
        break;
      }
    }
  }
};
function heuristic(a, b) {
  const absX = Math.abs(a.x - b.x);
  const absY = Math.abs(a.y - b.y);
  if (absX === 0 || absY === 0) {
    return absX + absY;
  }
  return absX + absY + 1;
}
var MOVE_DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];
function isFreeInGrid(grid, c) {
  if (c.x < 0 || c.y < 0) return false;
  return !grid.has(gridKey(c));
}
function getPath(grid, from, to) {
  const pq = new MinHeap();
  pq.push({ coord: from, priority: 0 });
  const costSoFar = /* @__PURE__ */ new Map();
  costSoFar.set(gridKey(from), 0);
  const cameFrom = /* @__PURE__ */ new Map();
  cameFrom.set(gridKey(from), null);
  while (pq.length > 0) {
    const current = pq.pop().coord;
    if (gridCoordEquals(current, to)) {
      const path = [];
      let c = current;
      while (c !== null) {
        path.unshift(c);
        c = cameFrom.get(gridKey(c)) ?? null;
      }
      return path;
    }
    const currentCost = costSoFar.get(gridKey(current));
    for (const dir of MOVE_DIRS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      if (!isFreeInGrid(grid, next) && !gridCoordEquals(next, to)) {
        continue;
      }
      const newCost = currentCost + 1;
      const nextKey = gridKey(next);
      const existingCost = costSoFar.get(nextKey);
      if (existingCost === void 0 || newCost < existingCost) {
        costSoFar.set(nextKey, newCost);
        const priority = newCost + heuristic(next, to);
        pq.push({ coord: next, priority });
        cameFrom.set(nextKey, current);
      }
    }
  }
  return null;
}
function mergePath(path) {
  if (path.length <= 2) return path;
  const toRemove = /* @__PURE__ */ new Set();
  let step0 = path[0];
  let step1 = path[1];
  for (let idx = 2; idx < path.length; idx++) {
    const step2 = path[idx];
    const prevDx = step1.x - step0.x;
    const prevDy = step1.y - step0.y;
    const dx = step2.x - step1.x;
    const dy = step2.y - step1.y;
    if (prevDx === dx && prevDy === dy) {
      toRemove.add(idx - 1);
    }
    step0 = step1;
    step1 = step2;
  }
  return path.filter((_, i) => !toRemove.has(i));
}

// src/ascii/edge-routing.ts
function getOpposite(d) {
  if (d === Up) return Down;
  if (d === Down) return Up;
  if (d === Left) return Right;
  if (d === Right) return Left;
  if (d === UpperRight) return LowerLeft;
  if (d === UpperLeft) return LowerRight;
  if (d === LowerRight) return UpperLeft;
  if (d === LowerLeft) return UpperRight;
  return Middle;
}
function dirEquals(a, b) {
  return a.x === b.x && a.y === b.y;
}
function determineDirection(from, to) {
  if (from.x === to.x) {
    return from.y < to.y ? Down : Up;
  } else if (from.y === to.y) {
    return from.x < to.x ? Right : Left;
  } else if (from.x < to.x) {
    return from.y < to.y ? LowerRight : UpperRight;
  } else {
    return from.y < to.y ? LowerLeft : UpperLeft;
  }
}
function selfReferenceDirection(graphDirection) {
  if (graphDirection === "LR") return [Right, Down, Down, Right];
  return [Down, Right, Right, Down];
}
function determineStartAndEndDir(edge, graphDirection) {
  if (edge.from === edge.to) return selfReferenceDirection(graphDirection);
  const d = determineDirection(edge.from.gridCoord, edge.to.gridCoord);
  let preferredDir;
  let preferredOppositeDir;
  let alternativeDir;
  let alternativeOppositeDir;
  const isBackwards = graphDirection === "LR" ? dirEquals(d, Left) || dirEquals(d, UpperLeft) || dirEquals(d, LowerLeft) : dirEquals(d, Up) || dirEquals(d, UpperLeft) || dirEquals(d, UpperRight);
  if (dirEquals(d, LowerRight)) {
    if (graphDirection === "LR") {
      preferredDir = Down;
      preferredOppositeDir = Left;
      alternativeDir = Right;
      alternativeOppositeDir = Up;
    } else {
      preferredDir = Right;
      preferredOppositeDir = Up;
      alternativeDir = Down;
      alternativeOppositeDir = Left;
    }
  } else if (dirEquals(d, UpperRight)) {
    if (graphDirection === "LR") {
      preferredDir = Up;
      preferredOppositeDir = Left;
      alternativeDir = Right;
      alternativeOppositeDir = Down;
    } else {
      preferredDir = Right;
      preferredOppositeDir = Down;
      alternativeDir = Up;
      alternativeOppositeDir = Left;
    }
  } else if (dirEquals(d, LowerLeft)) {
    if (graphDirection === "LR") {
      preferredDir = Down;
      preferredOppositeDir = Down;
      alternativeDir = Left;
      alternativeOppositeDir = Up;
    } else {
      preferredDir = Left;
      preferredOppositeDir = Up;
      alternativeDir = Down;
      alternativeOppositeDir = Right;
    }
  } else if (dirEquals(d, UpperLeft)) {
    if (graphDirection === "LR") {
      preferredDir = Down;
      preferredOppositeDir = Down;
      alternativeDir = Left;
      alternativeOppositeDir = Down;
    } else {
      preferredDir = Right;
      preferredOppositeDir = Right;
      alternativeDir = Up;
      alternativeOppositeDir = Right;
    }
  } else if (isBackwards) {
    if (graphDirection === "LR" && dirEquals(d, Left)) {
      preferredDir = Down;
      preferredOppositeDir = Down;
      alternativeDir = Left;
      alternativeOppositeDir = Right;
    } else if (graphDirection === "TD" && dirEquals(d, Up)) {
      preferredDir = Right;
      preferredOppositeDir = Right;
      alternativeDir = Up;
      alternativeOppositeDir = Down;
    } else {
      preferredDir = d;
      preferredOppositeDir = getOpposite(d);
      alternativeDir = d;
      alternativeOppositeDir = getOpposite(d);
    }
  } else {
    preferredDir = d;
    preferredOppositeDir = getOpposite(d);
    alternativeDir = d;
    alternativeOppositeDir = getOpposite(d);
  }
  return [preferredDir, preferredOppositeDir, alternativeDir, alternativeOppositeDir];
}
function determinePath(graph, edge) {
  const [preferredDir, preferredOppositeDir, alternativeDir, alternativeOppositeDir] = determineStartAndEndDir(edge, graph.config.graphDirection);
  const prefFrom = gridCoordDirection(edge.from.gridCoord, preferredDir);
  const prefTo = gridCoordDirection(edge.to.gridCoord, preferredOppositeDir);
  let preferredPath = getPath(graph.grid, prefFrom, prefTo);
  if (preferredPath === null) {
    edge.startDir = alternativeDir;
    edge.endDir = alternativeOppositeDir;
    edge.path = [];
    return;
  }
  preferredPath = mergePath(preferredPath);
  const altFrom = gridCoordDirection(edge.from.gridCoord, alternativeDir);
  const altTo = gridCoordDirection(edge.to.gridCoord, alternativeOppositeDir);
  let alternativePath = getPath(graph.grid, altFrom, altTo);
  if (alternativePath === null) {
    edge.startDir = preferredDir;
    edge.endDir = preferredOppositeDir;
    edge.path = preferredPath;
    return;
  }
  alternativePath = mergePath(alternativePath);
  if (preferredPath.length <= alternativePath.length) {
    edge.startDir = preferredDir;
    edge.endDir = preferredOppositeDir;
    edge.path = preferredPath;
  } else {
    edge.startDir = alternativeDir;
    edge.endDir = alternativeOppositeDir;
    edge.path = alternativePath;
  }
}
function determineLabelLine(graph, edge) {
  if (edge.text.length === 0) return;
  const lenLabel = edge.text.length;
  let prevStep = edge.path[0];
  let largestLine = [prevStep, edge.path[1]];
  let largestLineSize = 0;
  for (let i = 1; i < edge.path.length; i++) {
    const step = edge.path[i];
    const line = [prevStep, step];
    const lineWidth = calculateLineWidth(graph, line);
    if (lineWidth >= lenLabel) {
      largestLine = line;
      break;
    } else if (lineWidth > largestLineSize) {
      largestLineSize = lineWidth;
      largestLine = line;
    }
    prevStep = step;
  }
  const minX = Math.min(largestLine[0].x, largestLine[1].x);
  const maxX = Math.max(largestLine[0].x, largestLine[1].x);
  const middleX = minX + Math.floor((maxX - minX) / 2);
  const current = graph.columnWidth.get(middleX) ?? 0;
  graph.columnWidth.set(middleX, Math.max(current, lenLabel + 2));
  edge.labelLine = [largestLine[0], largestLine[1]];
}
function calculateLineWidth(graph, line) {
  let total = 0;
  const startX = Math.min(line[0].x, line[1].x);
  const endX = Math.max(line[0].x, line[1].x);
  for (let x = startX; x <= endX; x++) {
    total += graph.columnWidth.get(x) ?? 0;
  }
  return total;
}

// src/ascii/draw.ts
function drawBox(node, graph) {
  const gc = node.gridCoord;
  const useAscii = graph.config.useAscii;
  let w = 0;
  for (let i = 0; i < 2; i++) {
    w += graph.columnWidth.get(gc.x + i) ?? 0;
  }
  let h = 0;
  for (let i = 0; i < 2; i++) {
    h += graph.rowHeight.get(gc.y + i) ?? 0;
  }
  const from = { x: 0, y: 0 };
  const to = { x: w, y: h };
  const box = mkCanvas(Math.max(from.x, to.x), Math.max(from.y, to.y));
  if (!useAscii) {
    for (let x = from.x + 1; x < to.x; x++) box[x][from.y] = "\u2500";
    for (let x = from.x + 1; x < to.x; x++) box[x][to.y] = "\u2500";
    for (let y = from.y + 1; y < to.y; y++) box[from.x][y] = "\u2502";
    for (let y = from.y + 1; y < to.y; y++) box[to.x][y] = "\u2502";
    box[from.x][from.y] = "\u250C";
    box[to.x][from.y] = "\u2510";
    box[from.x][to.y] = "\u2514";
    box[to.x][to.y] = "\u2518";
  } else {
    for (let x = from.x + 1; x < to.x; x++) box[x][from.y] = "-";
    for (let x = from.x + 1; x < to.x; x++) box[x][to.y] = "-";
    for (let y = from.y + 1; y < to.y; y++) box[from.x][y] = "|";
    for (let y = from.y + 1; y < to.y; y++) box[to.x][y] = "|";
    box[from.x][from.y] = "+";
    box[to.x][from.y] = "+";
    box[from.x][to.y] = "+";
    box[to.x][to.y] = "+";
  }
  const label = node.displayLabel;
  const textY = from.y + Math.floor(h / 2);
  const textX = from.x + Math.floor(w / 2) - Math.ceil(label.length / 2) + 1;
  for (let i = 0; i < label.length; i++) {
    box[textX + i][textY] = label[i];
  }
  return box;
}
function drawMultiBox(sections, useAscii, padding = 1) {
  let maxTextWidth = 0;
  for (const section of sections) {
    for (const line of section) {
      maxTextWidth = Math.max(maxTextWidth, line.length);
    }
  }
  const innerWidth = maxTextWidth + 2 * padding;
  const boxWidth = innerWidth + 2;
  let totalLines = 0;
  for (const section of sections) {
    totalLines += Math.max(section.length, 1);
  }
  const numDividers = sections.length - 1;
  const boxHeight = totalLines + numDividers + 2;
  const hLine = useAscii ? "-" : "\u2500";
  const vLine = useAscii ? "|" : "\u2502";
  const tl = useAscii ? "+" : "\u250C";
  const tr = useAscii ? "+" : "\u2510";
  const bl = useAscii ? "+" : "\u2514";
  const br = useAscii ? "+" : "\u2518";
  const divL = useAscii ? "+" : "\u251C";
  const divR = useAscii ? "+" : "\u2524";
  const canvas = mkCanvas(boxWidth - 1, boxHeight - 1);
  canvas[0][0] = tl;
  for (let x = 1; x < boxWidth - 1; x++) canvas[x][0] = hLine;
  canvas[boxWidth - 1][0] = tr;
  canvas[0][boxHeight - 1] = bl;
  for (let x = 1; x < boxWidth - 1; x++) canvas[x][boxHeight - 1] = hLine;
  canvas[boxWidth - 1][boxHeight - 1] = br;
  for (let y = 1; y < boxHeight - 1; y++) {
    canvas[0][y] = vLine;
    canvas[boxWidth - 1][y] = vLine;
  }
  let row = 1;
  for (let s = 0; s < sections.length; s++) {
    const section = sections[s];
    const lines = section.length > 0 ? section : [""];
    for (const line of lines) {
      const startX = 1 + padding;
      for (let i = 0; i < line.length; i++) {
        canvas[startX + i][row] = line[i];
      }
      row++;
    }
    if (s < sections.length - 1) {
      canvas[0][row] = divL;
      for (let x = 1; x < boxWidth - 1; x++) canvas[x][row] = hLine;
      canvas[boxWidth - 1][row] = divR;
      row++;
    }
  }
  return canvas;
}
function drawLine(canvas, from, to, offsetFrom, offsetTo, useAscii) {
  const dir = determineDirection(from, to);
  const drawnCoords = [];
  const hChar = useAscii ? "-" : "\u2500";
  const vChar = useAscii ? "|" : "\u2502";
  const bslash = useAscii ? "\\" : "\u2572";
  const fslash = useAscii ? "/" : "\u2571";
  if (dirEquals(dir, Up)) {
    for (let y = from.y - offsetFrom; y >= to.y - offsetTo; y--) {
      drawnCoords.push({ x: from.x, y });
      canvas[from.x][y] = vChar;
    }
  } else if (dirEquals(dir, Down)) {
    for (let y = from.y + offsetFrom; y <= to.y + offsetTo; y++) {
      drawnCoords.push({ x: from.x, y });
      canvas[from.x][y] = vChar;
    }
  } else if (dirEquals(dir, Left)) {
    for (let x = from.x - offsetFrom; x >= to.x - offsetTo; x--) {
      drawnCoords.push({ x, y: from.y });
      canvas[x][from.y] = hChar;
    }
  } else if (dirEquals(dir, Right)) {
    for (let x = from.x + offsetFrom; x <= to.x + offsetTo; x++) {
      drawnCoords.push({ x, y: from.y });
      canvas[x][from.y] = hChar;
    }
  } else if (dirEquals(dir, UpperLeft)) {
    for (let x = from.x, y = from.y - offsetFrom; x >= to.x - offsetTo && y >= to.y - offsetTo; x--, y--) {
      drawnCoords.push({ x, y });
      canvas[x][y] = bslash;
    }
  } else if (dirEquals(dir, UpperRight)) {
    for (let x = from.x, y = from.y - offsetFrom; x <= to.x + offsetTo && y >= to.y - offsetTo; x++, y--) {
      drawnCoords.push({ x, y });
      canvas[x][y] = fslash;
    }
  } else if (dirEquals(dir, LowerLeft)) {
    for (let x = from.x, y = from.y + offsetFrom; x >= to.x - offsetTo && y <= to.y + offsetTo; x--, y++) {
      drawnCoords.push({ x, y });
      canvas[x][y] = fslash;
    }
  } else if (dirEquals(dir, LowerRight)) {
    for (let x = from.x, y = from.y + offsetFrom; x <= to.x + offsetTo && y <= to.y + offsetTo; x++, y++) {
      drawnCoords.push({ x, y });
      canvas[x][y] = bslash;
    }
  }
  return drawnCoords;
}
function drawArrow(graph, edge) {
  if (edge.path.length === 0) {
    const empty = copyCanvas(graph.canvas);
    return [empty, empty, empty, empty, empty];
  }
  const labelCanvas = drawArrowLabel(graph, edge);
  const [pathCanvas, linesDrawn, lineDirs] = drawPath(graph, edge.path);
  const boxStartCanvas = drawBoxStart(graph, edge.path, linesDrawn[0]);
  const arrowHeadCanvas = drawArrowHead(
    graph,
    linesDrawn[linesDrawn.length - 1],
    lineDirs[lineDirs.length - 1]
  );
  const cornersCanvas = drawCorners(graph, edge.path);
  return [pathCanvas, boxStartCanvas, arrowHeadCanvas, cornersCanvas, labelCanvas];
}
function drawPath(graph, path) {
  const canvas = copyCanvas(graph.canvas);
  let previousCoord = path[0];
  const linesDrawn = [];
  const lineDirs = [];
  for (let i = 1; i < path.length; i++) {
    const nextCoord = path[i];
    const prevDC = gridToDrawingCoord(graph, previousCoord);
    const nextDC = gridToDrawingCoord(graph, nextCoord);
    if (drawingCoordEquals(prevDC, nextDC)) {
      previousCoord = nextCoord;
      continue;
    }
    const dir = determineDirection(previousCoord, nextCoord);
    const segment = drawLine(canvas, prevDC, nextDC, 1, -1, graph.config.useAscii);
    if (segment.length === 0) segment.push(prevDC);
    linesDrawn.push(segment);
    lineDirs.push(dir);
    previousCoord = nextCoord;
  }
  return [canvas, linesDrawn, lineDirs];
}
function drawBoxStart(graph, path, firstLine) {
  const canvas = copyCanvas(graph.canvas);
  if (graph.config.useAscii) return canvas;
  const from = firstLine[0];
  const dir = determineDirection(path[0], path[1]);
  if (dirEquals(dir, Up)) canvas[from.x][from.y + 1] = "\u2534";
  else if (dirEquals(dir, Down)) canvas[from.x][from.y - 1] = "\u252C";
  else if (dirEquals(dir, Left)) canvas[from.x + 1][from.y] = "\u2524";
  else if (dirEquals(dir, Right)) canvas[from.x - 1][from.y] = "\u251C";
  return canvas;
}
function drawArrowHead(graph, lastLine, fallbackDir) {
  const canvas = copyCanvas(graph.canvas);
  if (lastLine.length === 0) return canvas;
  const from = lastLine[0];
  const lastPos = lastLine[lastLine.length - 1];
  let dir = determineDirection(from, lastPos);
  if (lastLine.length === 1 || dirEquals(dir, Middle)) dir = fallbackDir;
  let char;
  if (!graph.config.useAscii) {
    if (dirEquals(dir, Up)) char = "\u25B2";
    else if (dirEquals(dir, Down)) char = "\u25BC";
    else if (dirEquals(dir, Left)) char = "\u25C4";
    else if (dirEquals(dir, Right)) char = "\u25BA";
    else if (dirEquals(dir, UpperRight)) char = "\u25E5";
    else if (dirEquals(dir, UpperLeft)) char = "\u25E4";
    else if (dirEquals(dir, LowerRight)) char = "\u25E2";
    else if (dirEquals(dir, LowerLeft)) char = "\u25E3";
    else {
      if (dirEquals(fallbackDir, Up)) char = "\u25B2";
      else if (dirEquals(fallbackDir, Down)) char = "\u25BC";
      else if (dirEquals(fallbackDir, Left)) char = "\u25C4";
      else if (dirEquals(fallbackDir, Right)) char = "\u25BA";
      else if (dirEquals(fallbackDir, UpperRight)) char = "\u25E5";
      else if (dirEquals(fallbackDir, UpperLeft)) char = "\u25E4";
      else if (dirEquals(fallbackDir, LowerRight)) char = "\u25E2";
      else if (dirEquals(fallbackDir, LowerLeft)) char = "\u25E3";
      else char = "\u25CF";
    }
  } else {
    if (dirEquals(dir, Up)) char = "^";
    else if (dirEquals(dir, Down)) char = "v";
    else if (dirEquals(dir, Left)) char = "<";
    else if (dirEquals(dir, Right)) char = ">";
    else {
      if (dirEquals(fallbackDir, Up)) char = "^";
      else if (dirEquals(fallbackDir, Down)) char = "v";
      else if (dirEquals(fallbackDir, Left)) char = "<";
      else if (dirEquals(fallbackDir, Right)) char = ">";
      else char = "*";
    }
  }
  canvas[lastPos.x][lastPos.y] = char;
  return canvas;
}
function drawCorners(graph, path) {
  const canvas = copyCanvas(graph.canvas);
  for (let idx = 1; idx < path.length - 1; idx++) {
    const coord = path[idx];
    const dc = gridToDrawingCoord(graph, coord);
    const prevDir = determineDirection(path[idx - 1], coord);
    const nextDir = determineDirection(coord, path[idx + 1]);
    let corner;
    if (!graph.config.useAscii) {
      if (dirEquals(prevDir, Right) && dirEquals(nextDir, Down) || dirEquals(prevDir, Up) && dirEquals(nextDir, Left)) {
        corner = "\u2510";
      } else if (dirEquals(prevDir, Right) && dirEquals(nextDir, Up) || dirEquals(prevDir, Down) && dirEquals(nextDir, Left)) {
        corner = "\u2518";
      } else if (dirEquals(prevDir, Left) && dirEquals(nextDir, Down) || dirEquals(prevDir, Up) && dirEquals(nextDir, Right)) {
        corner = "\u250C";
      } else if (dirEquals(prevDir, Left) && dirEquals(nextDir, Up) || dirEquals(prevDir, Down) && dirEquals(nextDir, Right)) {
        corner = "\u2514";
      } else {
        corner = "+";
      }
    } else {
      corner = "+";
    }
    canvas[dc.x][dc.y] = corner;
  }
  return canvas;
}
function drawArrowLabel(graph, edge) {
  const canvas = copyCanvas(graph.canvas);
  if (edge.text.length === 0) return canvas;
  const drawingLine = lineToDrawing(graph, edge.labelLine);
  drawTextOnLine(canvas, drawingLine, edge.text);
  return canvas;
}
function drawTextOnLine(canvas, line, label) {
  if (line.length < 2) return;
  const minX = Math.min(line[0].x, line[1].x);
  const maxX = Math.max(line[0].x, line[1].x);
  const minY = Math.min(line[0].y, line[1].y);
  const maxY = Math.max(line[0].y, line[1].y);
  const middleX = minX + Math.floor((maxX - minX) / 2);
  const middleY = minY + Math.floor((maxY - minY) / 2);
  const startX = middleX - Math.floor(label.length / 2);
  drawText(canvas, { x: startX, y: middleY }, label);
}
function drawSubgraphBox(sg, graph) {
  const width = sg.maxX - sg.minX;
  const height = sg.maxY - sg.minY;
  if (width <= 0 || height <= 0) return mkCanvas(0, 0);
  const from = { x: 0, y: 0 };
  const to = { x: width, y: height };
  const canvas = mkCanvas(width, height);
  if (!graph.config.useAscii) {
    for (let x = from.x + 1; x < to.x; x++) canvas[x][from.y] = "\u2500";
    for (let x = from.x + 1; x < to.x; x++) canvas[x][to.y] = "\u2500";
    for (let y = from.y + 1; y < to.y; y++) canvas[from.x][y] = "\u2502";
    for (let y = from.y + 1; y < to.y; y++) canvas[to.x][y] = "\u2502";
    canvas[from.x][from.y] = "\u250C";
    canvas[to.x][from.y] = "\u2510";
    canvas[from.x][to.y] = "\u2514";
    canvas[to.x][to.y] = "\u2518";
  } else {
    for (let x = from.x + 1; x < to.x; x++) canvas[x][from.y] = "-";
    for (let x = from.x + 1; x < to.x; x++) canvas[x][to.y] = "-";
    for (let y = from.y + 1; y < to.y; y++) canvas[from.x][y] = "|";
    for (let y = from.y + 1; y < to.y; y++) canvas[to.x][y] = "|";
    canvas[from.x][from.y] = "+";
    canvas[to.x][from.y] = "+";
    canvas[from.x][to.y] = "+";
    canvas[to.x][to.y] = "+";
  }
  return canvas;
}
function drawSubgraphLabel(sg, graph) {
  const width = sg.maxX - sg.minX;
  const height = sg.maxY - sg.minY;
  if (width <= 0 || height <= 0) return [mkCanvas(0, 0), { x: 0, y: 0 }];
  const canvas = mkCanvas(width, height);
  const labelY = 1;
  let labelX = Math.floor(width / 2) - Math.floor(sg.name.length / 2);
  if (labelX < 1) labelX = 1;
  for (let i = 0; i < sg.name.length; i++) {
    if (labelX + i < width) {
      canvas[labelX + i][labelY] = sg.name[i];
    }
  }
  return [canvas, { x: sg.minX, y: sg.minY }];
}
function sortSubgraphsByDepth(subgraphs) {
  function getDepth(sg) {
    return sg.parent === null ? 0 : 1 + getDepth(sg.parent);
  }
  const sorted = [...subgraphs];
  sorted.sort((a, b) => getDepth(a) - getDepth(b));
  return sorted;
}
function drawGraph(graph) {
  const useAscii = graph.config.useAscii;
  const sortedSgs = sortSubgraphsByDepth(graph.subgraphs);
  for (const sg of sortedSgs) {
    const sgCanvas = drawSubgraphBox(sg, graph);
    const offset = { x: sg.minX, y: sg.minY };
    graph.canvas = mergeCanvases(graph.canvas, offset, useAscii, sgCanvas);
  }
  for (const node of graph.nodes) {
    if (!node.drawn && node.drawingCoord && node.drawing) {
      graph.canvas = mergeCanvases(graph.canvas, node.drawingCoord, useAscii, node.drawing);
      node.drawn = true;
    }
  }
  const lineCanvases = [];
  const cornerCanvases = [];
  const arrowHeadCanvases = [];
  const boxStartCanvases = [];
  const labelCanvases = [];
  for (const edge of graph.edges) {
    const [pathC, boxStartC, arrowHeadC, cornersC, labelC] = drawArrow(graph, edge);
    lineCanvases.push(pathC);
    cornerCanvases.push(cornersC);
    arrowHeadCanvases.push(arrowHeadC);
    boxStartCanvases.push(boxStartC);
    labelCanvases.push(labelC);
  }
  const zero = { x: 0, y: 0 };
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...lineCanvases);
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...cornerCanvases);
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...arrowHeadCanvases);
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...boxStartCanvases);
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...labelCanvases);
  for (const sg of graph.subgraphs) {
    if (sg.nodes.length === 0) continue;
    const [labelCanvas, offset] = drawSubgraphLabel(sg);
    graph.canvas = mergeCanvases(graph.canvas, offset, useAscii, labelCanvas);
  }
  return graph.canvas;
}

// src/ascii/grid.ts
function gridToDrawingCoord(graph, c, dir) {
  const target = c;
  let x = 0;
  for (let col = 0; col < target.x; col++) {
    x += graph.columnWidth.get(col) ?? 0;
  }
  let y = 0;
  for (let row = 0; row < target.y; row++) {
    y += graph.rowHeight.get(row) ?? 0;
  }
  const colW = graph.columnWidth.get(target.x) ?? 0;
  const rowH = graph.rowHeight.get(target.y) ?? 0;
  return {
    x: x + Math.floor(colW / 2) + graph.offsetX,
    y: y + Math.floor(rowH / 2) + graph.offsetY
  };
}
function lineToDrawing(graph, line) {
  return line.map((c) => gridToDrawingCoord(graph, c));
}
function reserveSpotInGrid(graph, node, requested) {
  if (graph.grid.has(gridKey(requested))) {
    if (graph.config.graphDirection === "LR") {
      return reserveSpotInGrid(graph, node, { x: requested.x, y: requested.y + 4 });
    } else {
      return reserveSpotInGrid(graph, node, { x: requested.x + 4, y: requested.y });
    }
  }
  for (let dx = 0; dx < 3; dx++) {
    for (let dy = 0; dy < 3; dy++) {
      const reserved = { x: requested.x + dx, y: requested.y + dy };
      graph.grid.set(gridKey(reserved), node);
    }
  }
  node.gridCoord = requested;
  return requested;
}
function setColumnWidth(graph, node) {
  const gc = node.gridCoord;
  const padding = graph.config.boxBorderPadding;
  const colWidths = [1, 2 * padding + node.displayLabel.length, 1];
  const rowHeights = [1, 1 + 2 * padding, 1];
  for (let idx = 0; idx < colWidths.length; idx++) {
    const xCoord = gc.x + idx;
    const current = graph.columnWidth.get(xCoord) ?? 0;
    graph.columnWidth.set(xCoord, Math.max(current, colWidths[idx]));
  }
  for (let idx = 0; idx < rowHeights.length; idx++) {
    const yCoord = gc.y + idx;
    const current = graph.rowHeight.get(yCoord) ?? 0;
    graph.rowHeight.set(yCoord, Math.max(current, rowHeights[idx]));
  }
  if (gc.x > 0) {
    const current = graph.columnWidth.get(gc.x - 1) ?? 0;
    graph.columnWidth.set(gc.x - 1, Math.max(current, graph.config.paddingX));
  }
  if (gc.y > 0) {
    let basePadding = graph.config.paddingY;
    if (hasIncomingEdgeFromOutsideSubgraph(graph, node)) {
      const subgraphOverhead = 4;
      basePadding += subgraphOverhead;
    }
    const current = graph.rowHeight.get(gc.y - 1) ?? 0;
    graph.rowHeight.set(gc.y - 1, Math.max(current, basePadding));
  }
}
function increaseGridSizeForPath(graph, path) {
  for (const c of path) {
    if (!graph.columnWidth.has(c.x)) {
      graph.columnWidth.set(c.x, Math.floor(graph.config.paddingX / 2));
    }
    if (!graph.rowHeight.has(c.y)) {
      graph.rowHeight.set(c.y, Math.floor(graph.config.paddingY / 2));
    }
  }
}
function isNodeInAnySubgraph(graph, node) {
  return graph.subgraphs.some((sg) => sg.nodes.includes(node));
}
function getNodeSubgraph(graph, node) {
  for (const sg of graph.subgraphs) {
    if (sg.nodes.includes(node)) return sg;
  }
  return null;
}
function hasIncomingEdgeFromOutsideSubgraph(graph, node) {
  const nodeSg = getNodeSubgraph(graph, node);
  if (!nodeSg) return false;
  let hasExternalEdge = false;
  for (const edge of graph.edges) {
    if (edge.to === node) {
      const sourceSg = getNodeSubgraph(graph, edge.from);
      if (sourceSg !== nodeSg) {
        hasExternalEdge = true;
        break;
      }
    }
  }
  if (!hasExternalEdge) return false;
  for (const otherNode of nodeSg.nodes) {
    if (otherNode === node || !otherNode.gridCoord) continue;
    let otherHasExternal = false;
    for (const edge of graph.edges) {
      if (edge.to === otherNode) {
        const sourceSg = getNodeSubgraph(graph, edge.from);
        if (sourceSg !== nodeSg) {
          otherHasExternal = true;
          break;
        }
      }
    }
    if (otherHasExternal && otherNode.gridCoord.y < node.gridCoord.y) {
      return false;
    }
  }
  return true;
}
function calculateSubgraphBoundingBox(graph, sg) {
  if (sg.nodes.length === 0) return;
  let minX = 1e6;
  let minY = 1e6;
  let maxX = -1e6;
  let maxY = -1e6;
  for (const child of sg.children) {
    calculateSubgraphBoundingBox(graph, child);
    if (child.nodes.length > 0) {
      minX = Math.min(minX, child.minX);
      minY = Math.min(minY, child.minY);
      maxX = Math.max(maxX, child.maxX);
      maxY = Math.max(maxY, child.maxY);
    }
  }
  for (const node of sg.nodes) {
    if (!node.drawingCoord || !node.drawing) continue;
    const nodeMinX = node.drawingCoord.x;
    const nodeMinY = node.drawingCoord.y;
    const nodeMaxX = nodeMinX + node.drawing.length - 1;
    const nodeMaxY = nodeMinY + node.drawing[0].length - 1;
    minX = Math.min(minX, nodeMinX);
    minY = Math.min(minY, nodeMinY);
    maxX = Math.max(maxX, nodeMaxX);
    maxY = Math.max(maxY, nodeMaxY);
  }
  const subgraphPadding = 2;
  const subgraphLabelSpace = 2;
  sg.minX = minX - subgraphPadding;
  sg.minY = minY - subgraphPadding - subgraphLabelSpace;
  sg.maxX = maxX + subgraphPadding;
  sg.maxY = maxY + subgraphPadding;
}
function ensureSubgraphSpacing(graph) {
  const minSpacing = 1;
  const rootSubgraphs = graph.subgraphs.filter((sg) => sg.parent === null && sg.nodes.length > 0);
  for (let i = 0; i < rootSubgraphs.length; i++) {
    for (let j = i + 1; j < rootSubgraphs.length; j++) {
      const sg1 = rootSubgraphs[i];
      const sg2 = rootSubgraphs[j];
      if (sg1.minX < sg2.maxX && sg1.maxX > sg2.minX) {
        if (sg1.maxY >= sg2.minY - minSpacing && sg1.minY < sg2.minY) {
          sg2.minY = sg1.maxY + minSpacing + 1;
        } else if (sg2.maxY >= sg1.minY - minSpacing && sg2.minY < sg1.minY) {
          sg1.minY = sg2.maxY + minSpacing + 1;
        }
      }
      if (sg1.minY < sg2.maxY && sg1.maxY > sg2.minY) {
        if (sg1.maxX >= sg2.minX - minSpacing && sg1.minX < sg2.minX) {
          sg2.minX = sg1.maxX + minSpacing + 1;
        } else if (sg2.maxX >= sg1.minX - minSpacing && sg2.minX < sg1.minX) {
          sg1.minX = sg2.maxX + minSpacing + 1;
        }
      }
    }
  }
}
function calculateSubgraphBoundingBoxes(graph) {
  for (const sg of graph.subgraphs) {
    calculateSubgraphBoundingBox(graph, sg);
  }
  ensureSubgraphSpacing(graph);
}
function offsetDrawingForSubgraphs(graph) {
  if (graph.subgraphs.length === 0) return;
  let minX = 0;
  let minY = 0;
  for (const sg of graph.subgraphs) {
    minX = Math.min(minX, sg.minX);
    minY = Math.min(minY, sg.minY);
  }
  const offsetX = -minX;
  const offsetY = -minY;
  if (offsetX === 0 && offsetY === 0) return;
  graph.offsetX = offsetX;
  graph.offsetY = offsetY;
  for (const sg of graph.subgraphs) {
    sg.minX += offsetX;
    sg.minY += offsetY;
    sg.maxX += offsetX;
    sg.maxY += offsetY;
  }
  for (const node of graph.nodes) {
    if (node.drawingCoord) {
      node.drawingCoord.x += offsetX;
      node.drawingCoord.y += offsetY;
    }
  }
}
function createMapping(graph) {
  const dir = graph.config.graphDirection;
  const highestPositionPerLevel = new Array(100).fill(0);
  const nodesFound = /* @__PURE__ */ new Set();
  const rootNodes = [];
  for (const node of graph.nodes) {
    if (!nodesFound.has(node.name)) {
      rootNodes.push(node);
    }
    nodesFound.add(node.name);
    for (const child of getChildren(graph, node)) {
      nodesFound.add(child.name);
    }
  }
  let hasExternalRoots = false;
  let hasSubgraphRootsWithEdges = false;
  for (const node of rootNodes) {
    if (isNodeInAnySubgraph(graph, node)) {
      if (getChildren(graph, node).length > 0) hasSubgraphRootsWithEdges = true;
    } else {
      hasExternalRoots = true;
    }
  }
  const shouldSeparate = dir === "LR" && hasExternalRoots && hasSubgraphRootsWithEdges;
  let externalRootNodes;
  let subgraphRootNodes = [];
  if (shouldSeparate) {
    externalRootNodes = rootNodes.filter((n) => !isNodeInAnySubgraph(graph, n));
    subgraphRootNodes = rootNodes.filter((n) => isNodeInAnySubgraph(graph, n));
  } else {
    externalRootNodes = rootNodes;
  }
  for (const node of externalRootNodes) {
    const requested = dir === "LR" ? { x: 0, y: highestPositionPerLevel[0] } : { x: highestPositionPerLevel[0], y: 0 };
    reserveSpotInGrid(graph, graph.nodes[node.index], requested);
    highestPositionPerLevel[0] = highestPositionPerLevel[0] + 4;
  }
  if (shouldSeparate && subgraphRootNodes.length > 0) {
    const subgraphLevel = 4;
    for (const node of subgraphRootNodes) {
      const requested = dir === "LR" ? { x: subgraphLevel, y: highestPositionPerLevel[subgraphLevel] } : { x: highestPositionPerLevel[subgraphLevel], y: subgraphLevel };
      reserveSpotInGrid(graph, graph.nodes[node.index], requested);
      highestPositionPerLevel[subgraphLevel] = highestPositionPerLevel[subgraphLevel] + 4;
    }
  }
  for (const node of graph.nodes) {
    const gc = node.gridCoord;
    const childLevel = dir === "LR" ? gc.x + 4 : gc.y + 4;
    let highestPosition = highestPositionPerLevel[childLevel];
    for (const child of getChildren(graph, node)) {
      if (child.gridCoord !== null) continue;
      const requested = dir === "LR" ? { x: childLevel, y: highestPosition } : { x: highestPosition, y: childLevel };
      reserveSpotInGrid(graph, graph.nodes[child.index], requested);
      highestPositionPerLevel[childLevel] = highestPosition + 4;
      highestPosition = highestPositionPerLevel[childLevel];
    }
  }
  for (const node of graph.nodes) {
    setColumnWidth(graph, node);
  }
  for (const edge of graph.edges) {
    determinePath(graph, edge);
    increaseGridSizeForPath(graph, edge.path);
    determineLabelLine(graph, edge);
  }
  for (const node of graph.nodes) {
    node.drawingCoord = gridToDrawingCoord(graph, node.gridCoord);
    node.drawing = drawBox(node, graph);
  }
  setCanvasSizeToGrid(graph.canvas, graph.columnWidth, graph.rowHeight);
  calculateSubgraphBoundingBoxes(graph);
  offsetDrawingForSubgraphs(graph);
}
function getEdgesFromNode(graph, node) {
  return graph.edges.filter((e) => e.from.name === node.name);
}
function getChildren(graph, node) {
  return getEdgesFromNode(graph, node).map((e) => e.to);
}

// src/sequence/parser.ts
function parseSequenceDiagram(lines) {
  const diagram = {
    actors: [],
    messages: [],
    blocks: [],
    notes: []
  };
  const actorIds = /* @__PURE__ */ new Set();
  const blockStack = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const actorMatch = line.match(/^(participant|actor)\s+(\S+?)(?:\s+as\s+(.+))?$/);
    if (actorMatch) {
      const type = actorMatch[1];
      const id = actorMatch[2];
      const label = actorMatch[3]?.trim() ?? id;
      if (!actorIds.has(id)) {
        actorIds.add(id);
        diagram.actors.push({ id, label, type });
      }
      continue;
    }
    const noteMatch = line.match(/^Note\s+(left of|right of|over)\s+([^:]+):\s*(.+)$/i);
    if (noteMatch) {
      const posStr = noteMatch[1].toLowerCase();
      const actorsStr = noteMatch[2].trim();
      const text = noteMatch[3].trim();
      const noteActorIds = actorsStr.split(",").map((s) => s.trim());
      for (const aid of noteActorIds) {
        ensureActor(diagram, actorIds, aid);
      }
      let position = "over";
      if (posStr === "left of") position = "left";
      else if (posStr === "right of") position = "right";
      diagram.notes.push({
        actorIds: noteActorIds,
        text,
        position,
        afterIndex: diagram.messages.length - 1
      });
      continue;
    }
    const blockMatch = line.match(/^(loop|alt|opt|par|critical|break|rect)\s*(.*)$/);
    if (blockMatch) {
      const blockType = blockMatch[1];
      const label = blockMatch[2]?.trim() ?? "";
      blockStack.push({
        type: blockType,
        label,
        startIndex: diagram.messages.length,
        dividers: []
      });
      continue;
    }
    const dividerMatch = line.match(/^(else|and)\s*(.*)$/);
    if (dividerMatch && blockStack.length > 0) {
      const label = dividerMatch[2]?.trim() ?? "";
      blockStack[blockStack.length - 1].dividers.push({
        index: diagram.messages.length,
        label
      });
      continue;
    }
    if (line === "end" && blockStack.length > 0) {
      const completed = blockStack.pop();
      diagram.blocks.push({
        type: completed.type,
        label: completed.label,
        startIndex: completed.startIndex,
        endIndex: Math.max(diagram.messages.length - 1, completed.startIndex),
        dividers: completed.dividers
      });
      continue;
    }
    const msgMatch = line.match(
      /^(\S+?)\s*(--?>?>|--?[)x]|--?>>|--?>)\s*([+-]?)(\S+?)\s*:\s*(.+)$/
    );
    if (msgMatch) {
      const from = msgMatch[1];
      const arrow = msgMatch[2];
      const activationMark = msgMatch[3];
      const to = msgMatch[4];
      const label = msgMatch[5].trim();
      ensureActor(diagram, actorIds, from);
      ensureActor(diagram, actorIds, to);
      const lineStyle = arrow.startsWith("--") ? "dashed" : "solid";
      const arrowHead = arrow.includes(">>") || arrow.includes("x") ? "filled" : "open";
      const msg = {
        from,
        to,
        label,
        lineStyle,
        arrowHead
      };
      if (activationMark === "+") msg.activate = true;
      if (activationMark === "-") msg.deactivate = true;
      diagram.messages.push(msg);
      continue;
    }
    const simpleMsgMatch = line.match(
      /^(\S+?)\s*(->>|-->>|-\)|--\)|-x|--x|->|-->)\s*([+-]?)(\S+?)\s*:\s*(.+)$/
    );
    if (simpleMsgMatch) {
      const from = simpleMsgMatch[1];
      const arrow = simpleMsgMatch[2];
      const activationMark = simpleMsgMatch[3];
      const to = simpleMsgMatch[4];
      const label = simpleMsgMatch[5].trim();
      ensureActor(diagram, actorIds, from);
      ensureActor(diagram, actorIds, to);
      const lineStyle = arrow.startsWith("--") ? "dashed" : "solid";
      const arrowHead = arrow.includes(">>") || arrow.includes("x") ? "filled" : "open";
      const msg = { from, to, label, lineStyle, arrowHead };
      if (activationMark === "+") msg.activate = true;
      if (activationMark === "-") msg.deactivate = true;
      diagram.messages.push(msg);
      continue;
    }
  }
  return diagram;
}
function ensureActor(diagram, actorIds, id) {
  if (!actorIds.has(id)) {
    actorIds.add(id);
    diagram.actors.push({ id, label: id, type: "participant" });
  }
}

// src/ascii/sequence.ts
function renderSequenceAscii(text, config) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("%%"));
  const diagram = parseSequenceDiagram(lines);
  if (diagram.actors.length === 0) return "";
  const useAscii = config.useAscii;
  const H = useAscii ? "-" : "\u2500";
  const V = useAscii ? "|" : "\u2502";
  const TL = useAscii ? "+" : "\u250C";
  const TR = useAscii ? "+" : "\u2510";
  const BL = useAscii ? "+" : "\u2514";
  const BR = useAscii ? "+" : "\u2518";
  const JT = useAscii ? "+" : "\u252C";
  const JB = useAscii ? "+" : "\u2534";
  const JL = useAscii ? "+" : "\u251C";
  const JR = useAscii ? "+" : "\u2524";
  const actorIdx = /* @__PURE__ */ new Map();
  diagram.actors.forEach((a, i) => actorIdx.set(a.id, i));
  const boxPad = 1;
  const actorBoxWidths = diagram.actors.map((a) => a.label.length + 2 * boxPad + 2);
  const halfBox = actorBoxWidths.map((w) => Math.ceil(w / 2));
  const actorBoxH = 3;
  const adjMaxWidth = new Array(Math.max(diagram.actors.length - 1, 0)).fill(0);
  for (const msg of diagram.messages) {
    const fi = actorIdx.get(msg.from);
    const ti = actorIdx.get(msg.to);
    if (fi === ti) continue;
    const lo = Math.min(fi, ti);
    const hi = Math.max(fi, ti);
    const needed = msg.label.length + 4;
    const numGaps = hi - lo;
    const perGap = Math.ceil(needed / numGaps);
    for (let g = lo; g < hi; g++) {
      adjMaxWidth[g] = Math.max(adjMaxWidth[g], perGap);
    }
  }
  const llX = [halfBox[0]];
  for (let i = 1; i < diagram.actors.length; i++) {
    const gap = Math.max(
      halfBox[i - 1] + halfBox[i] + 2,
      adjMaxWidth[i - 1] + 2,
      10
    );
    llX[i] = llX[i - 1] + gap;
  }
  const msgArrowY = [];
  const msgLabelY = [];
  const blockStartY = /* @__PURE__ */ new Map();
  const blockEndY = /* @__PURE__ */ new Map();
  const divYMap = /* @__PURE__ */ new Map();
  const notePositions = [];
  let curY = actorBoxH;
  for (let m = 0; m < diagram.messages.length; m++) {
    for (let b = 0; b < diagram.blocks.length; b++) {
      if (diagram.blocks[b].startIndex === m) {
        curY += 2;
        blockStartY.set(b, curY - 1);
      }
    }
    for (let b = 0; b < diagram.blocks.length; b++) {
      for (let d = 0; d < diagram.blocks[b].dividers.length; d++) {
        if (diagram.blocks[b].dividers[d].index === m) {
          curY += 1;
          divYMap.set(`${b}:${d}`, curY);
          curY += 1;
        }
      }
    }
    curY += 1;
    const msg = diagram.messages[m];
    const isSelf = msg.from === msg.to;
    if (isSelf) {
      msgLabelY[m] = curY + 1;
      msgArrowY[m] = curY;
      curY += 3;
    } else {
      msgLabelY[m] = curY;
      msgArrowY[m] = curY + 1;
      curY += 2;
    }
    for (let n = 0; n < diagram.notes.length; n++) {
      if (diagram.notes[n].afterIndex === m) {
        curY += 1;
        const note = diagram.notes[n];
        const nLines = note.text.split("\\n");
        const nWidth = Math.max(...nLines.map((l) => l.length)) + 4;
        const nHeight = nLines.length + 2;
        const aIdx = actorIdx.get(note.actorIds[0]) ?? 0;
        let nx;
        if (note.position === "left") {
          nx = llX[aIdx] - nWidth - 1;
        } else if (note.position === "right") {
          nx = llX[aIdx] + 2;
        } else {
          if (note.actorIds.length >= 2) {
            const aIdx2 = actorIdx.get(note.actorIds[1]) ?? aIdx;
            nx = Math.floor((llX[aIdx] + llX[aIdx2]) / 2) - Math.floor(nWidth / 2);
          } else {
            nx = llX[aIdx] - Math.floor(nWidth / 2);
          }
        }
        nx = Math.max(0, nx);
        notePositions.push({ x: nx, y: curY, width: nWidth, height: nHeight, lines: nLines });
        curY += nHeight;
      }
    }
    for (let b = 0; b < diagram.blocks.length; b++) {
      if (diagram.blocks[b].endIndex === m) {
        curY += 1;
        blockEndY.set(b, curY);
        curY += 1;
      }
    }
  }
  curY += 1;
  const footerY = curY;
  const totalH = footerY + actorBoxH;
  const lastLL = llX[llX.length - 1] ?? 0;
  const lastHalf = halfBox[halfBox.length - 1] ?? 0;
  let totalW = lastLL + lastHalf + 2;
  for (let m = 0; m < diagram.messages.length; m++) {
    const msg = diagram.messages[m];
    if (msg.from === msg.to) {
      const fi = actorIdx.get(msg.from);
      const selfRight = llX[fi] + 6 + 2 + msg.label.length;
      totalW = Math.max(totalW, selfRight + 1);
    }
  }
  for (const np of notePositions) {
    totalW = Math.max(totalW, np.x + np.width + 1);
  }
  const canvas = mkCanvas(totalW, totalH - 1);
  function drawActorBox(cx, topY, label) {
    const w = label.length + 2 * boxPad + 2;
    const left = cx - Math.floor(w / 2);
    canvas[left][topY] = TL;
    for (let x = 1; x < w - 1; x++) canvas[left + x][topY] = H;
    canvas[left + w - 1][topY] = TR;
    canvas[left][topY + 1] = V;
    canvas[left + w - 1][topY + 1] = V;
    const ls = left + 1 + boxPad;
    for (let i = 0; i < label.length; i++) canvas[ls + i][topY + 1] = label[i];
    canvas[left][topY + 2] = BL;
    for (let x = 1; x < w - 1; x++) canvas[left + x][topY + 2] = H;
    canvas[left + w - 1][topY + 2] = BR;
  }
  for (let i = 0; i < diagram.actors.length; i++) {
    const x = llX[i];
    for (let y = actorBoxH; y <= footerY; y++) {
      canvas[x][y] = V;
    }
  }
  for (let i = 0; i < diagram.actors.length; i++) {
    const actor = diagram.actors[i];
    drawActorBox(llX[i], 0, actor.label);
    drawActorBox(llX[i], footerY, actor.label);
    if (!useAscii) {
      canvas[llX[i]][actorBoxH - 1] = JT;
      canvas[llX[i]][footerY] = JB;
    }
  }
  for (let m = 0; m < diagram.messages.length; m++) {
    const msg = diagram.messages[m];
    const fi = actorIdx.get(msg.from);
    const ti = actorIdx.get(msg.to);
    const fromX = llX[fi];
    const toX = llX[ti];
    const isSelf = fi === ti;
    const isDashed = msg.lineStyle === "dashed";
    const isFilled = msg.arrowHead === "filled";
    const lineChar = isDashed ? useAscii ? "." : "\u254C" : H;
    if (isSelf) {
      const y0 = msgArrowY[m];
      const loopW = Math.max(4, 4);
      canvas[fromX][y0] = JL;
      for (let x = fromX + 1; x < fromX + loopW; x++) canvas[x][y0] = lineChar;
      canvas[fromX + loopW][y0] = useAscii ? "+" : "\u2510";
      canvas[fromX + loopW][y0 + 1] = V;
      const labelX = fromX + loopW + 2;
      for (let i = 0; i < msg.label.length; i++) {
        if (labelX + i < totalW) canvas[labelX + i][y0 + 1] = msg.label[i];
      }
      const arrowChar = isFilled ? useAscii ? "<" : "\u25C0" : useAscii ? "<" : "\u25C1";
      canvas[fromX][y0 + 2] = arrowChar;
      for (let x = fromX + 1; x < fromX + loopW; x++) canvas[x][y0 + 2] = lineChar;
      canvas[fromX + loopW][y0 + 2] = useAscii ? "+" : "\u2518";
    } else {
      const labelY = msgLabelY[m];
      const arrowY = msgArrowY[m];
      const leftToRight = fromX < toX;
      const midX = Math.floor((fromX + toX) / 2);
      const labelStart = midX - Math.floor(msg.label.length / 2);
      for (let i = 0; i < msg.label.length; i++) {
        const lx = labelStart + i;
        if (lx >= 0 && lx < totalW) canvas[lx][labelY] = msg.label[i];
      }
      if (leftToRight) {
        for (let x = fromX + 1; x < toX; x++) canvas[x][arrowY] = lineChar;
        const ah = isFilled ? useAscii ? ">" : "\u25B6" : useAscii ? ">" : "\u25B7";
        canvas[toX][arrowY] = ah;
      } else {
        for (let x = toX + 1; x < fromX; x++) canvas[x][arrowY] = lineChar;
        const ah = isFilled ? useAscii ? "<" : "\u25C0" : useAscii ? "<" : "\u25C1";
        canvas[toX][arrowY] = ah;
      }
    }
  }
  for (let b = 0; b < diagram.blocks.length; b++) {
    const block = diagram.blocks[b];
    const topY = blockStartY.get(b);
    const botY = blockEndY.get(b);
    if (topY === void 0 || botY === void 0) continue;
    let minLX = totalW;
    let maxLX = 0;
    for (let m = block.startIndex; m <= block.endIndex; m++) {
      if (m >= diagram.messages.length) break;
      const msg = diagram.messages[m];
      const f = actorIdx.get(msg.from) ?? 0;
      const t = actorIdx.get(msg.to) ?? 0;
      minLX = Math.min(minLX, llX[Math.min(f, t)]);
      maxLX = Math.max(maxLX, llX[Math.max(f, t)]);
    }
    const bLeft = Math.max(0, minLX - 4);
    const bRight = Math.min(totalW - 1, maxLX + 4);
    canvas[bLeft][topY] = TL;
    for (let x = bLeft + 1; x < bRight; x++) canvas[x][topY] = H;
    canvas[bRight][topY] = TR;
    const hdrLabel = block.label ? `${block.type} [${block.label}]` : block.type;
    for (let i = 0; i < hdrLabel.length && bLeft + 1 + i < bRight; i++) {
      canvas[bLeft + 1 + i][topY] = hdrLabel[i];
    }
    canvas[bLeft][botY] = BL;
    for (let x = bLeft + 1; x < bRight; x++) canvas[x][botY] = H;
    canvas[bRight][botY] = BR;
    for (let y = topY + 1; y < botY; y++) {
      canvas[bLeft][y] = V;
      canvas[bRight][y] = V;
    }
    for (let d = 0; d < block.dividers.length; d++) {
      const dY = divYMap.get(`${b}:${d}`);
      if (dY === void 0) continue;
      const dashChar = isDashedH();
      canvas[bLeft][dY] = JL;
      for (let x = bLeft + 1; x < bRight; x++) canvas[x][dY] = dashChar;
      canvas[bRight][dY] = JR;
      const dLabel = block.dividers[d].label;
      if (dLabel) {
        const dStr = `[${dLabel}]`;
        for (let i = 0; i < dStr.length && bLeft + 1 + i < bRight; i++) {
          canvas[bLeft + 1 + i][dY] = dStr[i];
        }
      }
    }
  }
  for (const np of notePositions) {
    increaseSize(canvas, np.x + np.width, np.y + np.height);
    canvas[np.x][np.y] = TL;
    for (let x = 1; x < np.width - 1; x++) canvas[np.x + x][np.y] = H;
    canvas[np.x + np.width - 1][np.y] = TR;
    for (let l = 0; l < np.lines.length; l++) {
      const ly = np.y + 1 + l;
      canvas[np.x][ly] = V;
      canvas[np.x + np.width - 1][ly] = V;
      for (let i = 0; i < np.lines[l].length; i++) {
        canvas[np.x + 2 + i][ly] = np.lines[l][i];
      }
    }
    const by = np.y + np.height - 1;
    canvas[np.x][by] = BL;
    for (let x = 1; x < np.width - 1; x++) canvas[np.x + x][by] = H;
    canvas[np.x + np.width - 1][by] = BR;
  }
  return canvasToString(canvas);
  function isDashedH() {
    return useAscii ? "-" : "\u254C";
  }
}

// src/class/parser.ts
function parseClassDiagram(lines) {
  const diagram = {
    classes: [],
    relationships: [],
    namespaces: []
  };
  const classMap = /* @__PURE__ */ new Map();
  let currentNamespace = null;
  let currentClass = null;
  let braceDepth = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (currentClass && braceDepth > 0) {
      if (line === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          currentClass = null;
        }
        continue;
      }
      const annotMatch = line.match(/^<<(\w+)>>$/);
      if (annotMatch) {
        currentClass.annotation = annotMatch[1];
        continue;
      }
      const member = parseMember(line);
      if (member) {
        if (member.isMethod) {
          currentClass.methods.push(member.member);
        } else {
          currentClass.attributes.push(member.member);
        }
      }
      continue;
    }
    const nsMatch = line.match(/^namespace\s+(\S+)\s*\{$/);
    if (nsMatch) {
      currentNamespace = { name: nsMatch[1], classIds: [] };
      continue;
    }
    if (line === "}" && currentNamespace) {
      diagram.namespaces.push(currentNamespace);
      currentNamespace = null;
      continue;
    }
    const classBlockMatch = line.match(/^class\s+(\S+?)(?:\s*~(\w+)~)?\s*\{$/);
    if (classBlockMatch) {
      const id = classBlockMatch[1];
      const generic = classBlockMatch[2];
      const cls = ensureClass(classMap, id);
      if (generic) {
        cls.label = `${id}<${generic}>`;
      }
      currentClass = cls;
      braceDepth = 1;
      if (currentNamespace) {
        currentNamespace.classIds.push(id);
      }
      continue;
    }
    const classOnlyMatch = line.match(/^class\s+(\S+?)(?:\s*~(\w+)~)?\s*$/);
    if (classOnlyMatch) {
      const id = classOnlyMatch[1];
      const generic = classOnlyMatch[2];
      const cls = ensureClass(classMap, id);
      if (generic) {
        cls.label = `${id}<${generic}>`;
      }
      if (currentNamespace) {
        currentNamespace.classIds.push(id);
      }
      continue;
    }
    const inlineAnnotMatch = line.match(/^class\s+(\S+?)\s*\{\s*<<(\w+)>>\s*\}$/);
    if (inlineAnnotMatch) {
      const cls = ensureClass(classMap, inlineAnnotMatch[1]);
      cls.annotation = inlineAnnotMatch[2];
      continue;
    }
    const inlineAttrMatch = line.match(/^(\S+?)\s*:\s*(.+)$/);
    if (inlineAttrMatch) {
      const rest = inlineAttrMatch[2];
      if (!rest.match(/<\|--|--|\*--|o--|-->|\.\.>|\.\.\|>/)) {
        const cls = ensureClass(classMap, inlineAttrMatch[1]);
        const member = parseMember(rest);
        if (member) {
          if (member.isMethod) {
            cls.methods.push(member.member);
          } else {
            cls.attributes.push(member.member);
          }
        }
        continue;
      }
    }
    const rel = parseRelationship(line);
    if (rel) {
      ensureClass(classMap, rel.from);
      ensureClass(classMap, rel.to);
      diagram.relationships.push(rel);
      continue;
    }
  }
  diagram.classes = [...classMap.values()];
  return diagram;
}
function ensureClass(classMap, id) {
  let cls = classMap.get(id);
  if (!cls) {
    cls = { id, label: id, attributes: [], methods: [] };
    classMap.set(id, cls);
  }
  return cls;
}
function parseMember(line) {
  const trimmed = line.trim().replace(/;$/, "");
  if (!trimmed) return null;
  let visibility = "";
  let rest = trimmed;
  if (/^[+\-#~]/.test(rest)) {
    visibility = rest[0];
    rest = rest.slice(1).trim();
  }
  const methodMatch = rest.match(/^(.+?)\(([^)]*)\)(?:\s*(.+))?$/);
  if (methodMatch) {
    const name2 = methodMatch[1].trim();
    const type2 = methodMatch[3]?.trim();
    const isStatic2 = name2.endsWith("$") || rest.includes("$");
    const isAbstract2 = name2.endsWith("*") || rest.includes("*");
    return {
      member: {
        visibility,
        name: name2.replace(/[$*]$/, ""),
        type: type2 || void 0,
        isStatic: isStatic2,
        isAbstract: isAbstract2
      },
      isMethod: true
    };
  }
  const parts = rest.split(/\s+/);
  let name;
  let type;
  if (parts.length >= 2) {
    type = parts[0];
    name = parts.slice(1).join(" ");
  } else {
    name = parts[0] ?? rest;
  }
  const isStatic = name.endsWith("$");
  const isAbstract = name.endsWith("*");
  return {
    member: {
      visibility,
      name: name.replace(/[$*]$/, ""),
      type: type || void 0,
      isStatic,
      isAbstract
    },
    isMethod: false
  };
}
function parseRelationship(line) {
  const match = line.match(
    /^(\S+?)\s+(?:"([^"]*?)"\s+)?(<\|--|<\|\.\.|\*--|o--|-->|--\*|--o|--|>\s*|\.\.>|\.\.\|>|--)\s+(?:"([^"]*?)"\s+)?(\S+?)(?:\s*:\s*(.+))?$/
  );
  if (!match) return null;
  const from = match[1];
  const fromCardinality = match[2] || void 0;
  const arrow = match[3].trim();
  const toCardinality = match[4] || void 0;
  const to = match[5];
  const label = match[6]?.trim() || void 0;
  const parsed = parseArrow(arrow);
  if (!parsed) return null;
  return { from, to, type: parsed.type, markerAt: parsed.markerAt, label, fromCardinality, toCardinality };
}
function parseArrow(arrow) {
  switch (arrow) {
    case "<|--":
      return { type: "inheritance", markerAt: "from" };
    case "<|..":
      return { type: "realization", markerAt: "from" };
    case "*--":
      return { type: "composition", markerAt: "from" };
    case "--*":
      return { type: "composition", markerAt: "to" };
    case "o--":
      return { type: "aggregation", markerAt: "from" };
    case "--o":
      return { type: "aggregation", markerAt: "to" };
    case "-->":
      return { type: "association", markerAt: "to" };
    case "..>":
      return { type: "dependency", markerAt: "to" };
    case "..|>":
      return { type: "realization", markerAt: "to" };
    case "--":
      return { type: "association", markerAt: "to" };
    default:
      return null;
  }
}

// src/ascii/class-diagram.ts
function formatMember(m) {
  const vis = m.visibility || "";
  const type = m.type ? `: ${m.type}` : "";
  return `${vis}${m.name}${type}`;
}
function buildClassSections(cls) {
  const header = [];
  if (cls.annotation) header.push(`<<${cls.annotation}>>`);
  header.push(cls.label);
  const attrs = cls.attributes.map(formatMember);
  const methods = cls.methods.map(formatMember);
  if (attrs.length === 0 && methods.length === 0) return [header];
  if (methods.length === 0) return [header, attrs];
  return [header, attrs, methods];
}
function getRelMarker(type, markerAt) {
  const dashed = type === "dependency" || type === "realization";
  return { type, markerAt, dashed };
}
function getMarkerShape(type, useAscii, direction) {
  switch (type) {
    case "inheritance":
    case "realization":
      if (direction === "down") {
        return useAscii ? "^" : "\u25B3";
      } else if (direction === "up") {
        return useAscii ? "v" : "\u25BD";
      } else if (direction === "left") {
        return useAscii ? ">" : "\u25C1";
      } else {
        return useAscii ? "<" : "\u25B7";
      }
    case "composition":
      return useAscii ? "*" : "\u25C6";
    case "aggregation":
      return useAscii ? "o" : "\u25C7";
    case "association":
    case "dependency":
      if (direction === "down") {
        return useAscii ? "v" : "\u25BC";
      } else if (direction === "up") {
        return useAscii ? "^" : "\u25B2";
      } else if (direction === "left") {
        return useAscii ? "<" : "\u25C0";
      } else {
        return useAscii ? ">" : "\u25B6";
      }
  }
}
function renderClassAscii(text, config) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("%%"));
  const diagram = parseClassDiagram(lines);
  if (diagram.classes.length === 0) return "";
  const useAscii = config.useAscii;
  const hGap = 4;
  const vGap = 3;
  const classSections = /* @__PURE__ */ new Map();
  const classBoxW = /* @__PURE__ */ new Map();
  const classBoxH = /* @__PURE__ */ new Map();
  for (const cls of diagram.classes) {
    const sections = buildClassSections(cls);
    classSections.set(cls.id, sections);
    let maxTextW = 0;
    for (const section of sections) {
      for (const line of section) maxTextW = Math.max(maxTextW, line.length);
    }
    const boxW = maxTextW + 4;
    let totalLines = 0;
    for (const section of sections) totalLines += Math.max(section.length, 1);
    const boxH = totalLines + (sections.length - 1) + 2;
    classBoxW.set(cls.id, boxW);
    classBoxH.set(cls.id, boxH);
  }
  const classById = /* @__PURE__ */ new Map();
  for (const cls of diagram.classes) classById.set(cls.id, cls);
  const parents = /* @__PURE__ */ new Map();
  const children = /* @__PURE__ */ new Map();
  for (const rel of diagram.relationships) {
    const isHierarchical = rel.type === "inheritance" || rel.type === "realization";
    const parentId = isHierarchical && rel.markerAt === "to" ? rel.to : rel.from;
    const childId = isHierarchical && rel.markerAt === "to" ? rel.from : rel.to;
    if (!parents.has(childId)) parents.set(childId, /* @__PURE__ */ new Set());
    parents.get(childId).add(parentId);
    if (!children.has(parentId)) children.set(parentId, /* @__PURE__ */ new Set());
    children.get(parentId).add(childId);
  }
  const level = /* @__PURE__ */ new Map();
  const roots = diagram.classes.filter((c) => !parents.has(c.id) || parents.get(c.id).size === 0);
  const queue = roots.map((c) => c.id);
  for (const id of queue) level.set(id, 0);
  const levelCap = diagram.classes.length - 1;
  let qi = 0;
  while (qi < queue.length) {
    const id = queue[qi++];
    const childSet = children.get(id);
    if (!childSet) continue;
    for (const childId of childSet) {
      const newLevel = (level.get(id) ?? 0) + 1;
      if (newLevel > levelCap) continue;
      if (!level.has(childId) || level.get(childId) < newLevel) {
        level.set(childId, newLevel);
        queue.push(childId);
      }
    }
  }
  for (const cls of diagram.classes) {
    if (!level.has(cls.id)) level.set(cls.id, 0);
  }
  const maxLevel = Math.max(...[...level.values()], 0);
  const levelGroups = Array.from({ length: maxLevel + 1 }, () => []);
  for (const cls of diagram.classes) {
    levelGroups[level.get(cls.id)].push(cls.id);
  }
  const placed = /* @__PURE__ */ new Map();
  let currentY = 0;
  for (let lv = 0; lv <= maxLevel; lv++) {
    const group = levelGroups[lv];
    if (group.length === 0) continue;
    let currentX = 0;
    let maxH = 0;
    for (const id of group) {
      const cls = classById.get(id);
      const w = classBoxW.get(id);
      const h = classBoxH.get(id);
      placed.set(id, {
        cls,
        sections: classSections.get(id),
        x: currentX,
        y: currentY,
        width: w,
        height: h
      });
      currentX += w + hGap;
      maxH = Math.max(maxH, h);
    }
    currentY += maxH + vGap;
  }
  let totalW = 0;
  let totalH = 0;
  for (const p of placed.values()) {
    totalW = Math.max(totalW, p.x + p.width);
    totalH = Math.max(totalH, p.y + p.height);
  }
  totalW += 4;
  totalH += 2;
  const canvas = mkCanvas(totalW - 1, totalH - 1);
  for (const p of placed.values()) {
    const boxCanvas = drawMultiBox(p.sections, useAscii);
    for (let bx = 0; bx < boxCanvas.length; bx++) {
      for (let by = 0; by < boxCanvas[0].length; by++) {
        const ch = boxCanvas[bx][by];
        if (ch !== " ") {
          const cx = p.x + bx;
          const cy = p.y + by;
          if (cx < totalW && cy < totalH) {
            canvas[cx][cy] = ch;
          }
        }
      }
    }
  }
  const H = useAscii ? "-" : "\u2500";
  const V = useAscii ? "|" : "\u2502";
  const dashH = useAscii ? "." : "\u254C";
  const dashV = useAscii ? ":" : "\u250A";
  for (const rel of diagram.relationships) {
    const fromP = placed.get(rel.from);
    const toP = placed.get(rel.to);
    if (!fromP || !toP) continue;
    const marker = getRelMarker(rel.type, rel.markerAt);
    const lineH = marker.dashed ? dashH : H;
    const lineV = marker.dashed ? dashV : V;
    const fromCX = fromP.x + Math.floor(fromP.width / 2);
    const fromBY = fromP.y + fromP.height - 1;
    const toCX = toP.x + Math.floor(toP.width / 2);
    const toTY = toP.y;
    if (fromBY < toTY) {
      const midY = fromBY + Math.floor((toTY - fromBY) / 2);
      for (let y = fromBY + 1; y <= midY; y++) {
        if (y < totalH) canvas[fromCX][y] = lineV;
      }
      if (fromCX !== toCX) {
        const lx = Math.min(fromCX, toCX);
        const rx = Math.max(fromCX, toCX);
        for (let x = lx; x <= rx; x++) {
          if (x < totalW && midY < totalH) canvas[x][midY] = lineH;
        }
        if (!useAscii && midY < totalH) {
          if (fromCX < toCX) {
            canvas[fromCX][midY] = "\u2514";
            canvas[toCX][midY] = "\u2510";
          } else {
            canvas[fromCX][midY] = "\u2518";
            canvas[toCX][midY] = "\u250C";
          }
        }
      }
      for (let y = midY + 1; y < toTY; y++) {
        if (y < totalH) canvas[toCX][y] = lineV;
      }
      if (marker.markerAt === "to") {
        const markerChar = getMarkerShape(marker.type, useAscii, "down");
        const my = toTY - 1;
        if (my >= 0 && my < totalH) {
          for (let i = 0; i < markerChar.length; i++) {
            const mx = toCX - Math.floor(markerChar.length / 2) + i;
            if (mx >= 0 && mx < totalW) canvas[mx][my] = markerChar[i];
          }
        }
      }
      if (marker.markerAt === "from") {
        const markerChar = getMarkerShape(marker.type, useAscii, "down");
        const my = fromBY + 1;
        if (my < totalH) {
          for (let i = 0; i < markerChar.length; i++) {
            const mx = fromCX - Math.floor(markerChar.length / 2) + i;
            if (mx >= 0 && mx < totalW) canvas[mx][my] = markerChar[i];
          }
        }
      }
    } else if (toP.y + toP.height - 1 < fromP.y) {
      const fromTY = fromP.y;
      const toBY = toP.y + toP.height - 1;
      const midY = toBY + Math.floor((fromTY - toBY) / 2);
      for (let y = fromTY - 1; y >= midY; y--) {
        if (y >= 0 && y < totalH) canvas[fromCX][y] = lineV;
      }
      if (fromCX !== toCX) {
        const lx = Math.min(fromCX, toCX);
        const rx = Math.max(fromCX, toCX);
        for (let x = lx; x <= rx; x++) {
          if (x < totalW && midY >= 0 && midY < totalH) canvas[x][midY] = lineH;
        }
        if (!useAscii && midY >= 0 && midY < totalH) {
          if (fromCX < toCX) {
            canvas[fromCX][midY] = "\u250C";
            canvas[toCX][midY] = "\u2518";
          } else {
            canvas[fromCX][midY] = "\u2510";
            canvas[toCX][midY] = "\u2514";
          }
        }
      }
      for (let y = midY - 1; y > toBY; y--) {
        if (y >= 0 && y < totalH) canvas[toCX][y] = lineV;
      }
      if (marker.markerAt === "from") {
        const markerChar = getMarkerShape(marker.type, useAscii, "up");
        const my = fromTY - 1;
        if (my >= 0 && my < totalH) {
          for (let i = 0; i < markerChar.length; i++) {
            const mx = fromCX - Math.floor(markerChar.length / 2) + i;
            if (mx >= 0 && mx < totalW) canvas[mx][my] = markerChar[i];
          }
        }
      }
      if (marker.markerAt === "to") {
        const isHierarchical = marker.type === "inheritance" || marker.type === "realization";
        const markerDir = isHierarchical ? "down" : "up";
        const markerChar = getMarkerShape(marker.type, useAscii, markerDir);
        const my = toBY + 1;
        if (my < totalH) {
          for (let i = 0; i < markerChar.length; i++) {
            const mx = toCX - Math.floor(markerChar.length / 2) + i;
            if (mx >= 0 && mx < totalW) canvas[mx][my] = markerChar[i];
          }
        }
      }
    } else {
      const detourY = Math.max(fromBY, toP.y + toP.height - 1) + 2;
      increaseSize(canvas, totalW, detourY + 1);
      for (let y = fromBY + 1; y <= detourY; y++) {
        canvas[fromCX][y] = lineV;
      }
      const lx = Math.min(fromCX, toCX);
      const rx = Math.max(fromCX, toCX);
      for (let x = lx; x <= rx; x++) {
        canvas[x][detourY] = lineH;
      }
      for (let y = detourY - 1; y >= toP.y + toP.height; y--) {
        canvas[toCX][y] = lineV;
      }
      if (marker.markerAt === "from") {
        const markerChar = getMarkerShape(marker.type, useAscii, "down");
        const my = fromBY + 1;
        if (my < totalH) {
          for (let i = 0; i < markerChar.length; i++) {
            const mx = fromCX - Math.floor(markerChar.length / 2) + i;
            if (mx >= 0 && mx < totalW) canvas[mx][my] = markerChar[i];
          }
        }
      }
      if (marker.markerAt === "to") {
        const markerChar = getMarkerShape(marker.type, useAscii, "up");
        const my = toP.y + toP.height;
        if (my < totalH) {
          for (let i = 0; i < markerChar.length; i++) {
            const mx = toCX - Math.floor(markerChar.length / 2) + i;
            if (mx >= 0 && mx < totalW) canvas[mx][my] = markerChar[i];
          }
        }
      }
    }
    if (rel.label) {
      const paddedLabel = ` ${rel.label} `;
      const midX = Math.floor((fromCX + toCX) / 2);
      let midY;
      if (fromBY < toTY) {
        midY = Math.floor((fromBY + 1 + toTY - 1) / 2);
      } else if (toP.y + toP.height - 1 < fromP.y) {
        const toBY = toP.y + toP.height - 1;
        midY = Math.floor((toBY + 1 + fromP.y - 1) / 2);
      } else {
        midY = Math.max(fromBY, toP.y + toP.height - 1) + 2;
      }
      const labelStart = midX - Math.floor(paddedLabel.length / 2);
      for (let i = 0; i < paddedLabel.length; i++) {
        const lx = labelStart + i;
        if (lx >= 0 && lx < totalW && midY >= 0 && midY < totalH) {
          canvas[lx][midY] = paddedLabel[i];
        }
      }
    }
  }
  return canvasToString(canvas);
}

// src/er/parser.ts
function parseErDiagram(lines) {
  const diagram = {
    entities: [],
    relationships: []
  };
  const entityMap = /* @__PURE__ */ new Map();
  let currentEntity = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (currentEntity) {
      if (line === "}") {
        currentEntity = null;
        continue;
      }
      const attr = parseAttribute(line);
      if (attr) {
        currentEntity.attributes.push(attr);
      }
      continue;
    }
    const entityBlockMatch = line.match(/^(\S+)\s*\{$/);
    if (entityBlockMatch) {
      const id = entityBlockMatch[1];
      const entity = ensureEntity(entityMap, id);
      currentEntity = entity;
      continue;
    }
    const rel = parseRelationshipLine(line);
    if (rel) {
      ensureEntity(entityMap, rel.entity1);
      ensureEntity(entityMap, rel.entity2);
      diagram.relationships.push(rel);
      continue;
    }
  }
  diagram.entities = [...entityMap.values()];
  return diagram;
}
function ensureEntity(entityMap, id) {
  let entity = entityMap.get(id);
  if (!entity) {
    entity = { id, label: id, attributes: [] };
    entityMap.set(id, entity);
  }
  return entity;
}
function parseAttribute(line) {
  const match = line.match(/^(\S+)\s+(\S+)(?:\s+(.+))?$/);
  if (!match) return null;
  const type = match[1];
  const name = match[2];
  const rest = match[3]?.trim() ?? "";
  const keys = [];
  let comment;
  const commentMatch = rest.match(/"([^"]*)"/);
  if (commentMatch) {
    comment = commentMatch[1];
  }
  const restWithoutComment = rest.replace(/"[^"]*"/, "").trim();
  for (const part of restWithoutComment.split(/\s+/)) {
    const upper = part.toUpperCase();
    if (upper === "PK" || upper === "FK" || upper === "UK") {
      keys.push(upper);
    }
  }
  return { type, name, keys, comment };
}
function parseRelationshipLine(line) {
  const match = line.match(/^(\S+)\s+([|o}{]+(?:--|\.\.)[|o}{]+)\s+(\S+)\s*:\s*(.+)$/);
  if (!match) return null;
  const entity1 = match[1];
  const cardinalityStr = match[2];
  const entity2 = match[3];
  const label = match[4].trim();
  const lineMatch = cardinalityStr.match(/^([|o}{]+)(--|\.\.?)([|o}{]+)$/);
  if (!lineMatch) return null;
  const leftStr = lineMatch[1];
  const lineStyle = lineMatch[2];
  const rightStr = lineMatch[3];
  const cardinality1 = parseCardinality(leftStr);
  const cardinality2 = parseCardinality(rightStr);
  const identifying = lineStyle === "--";
  if (!cardinality1 || !cardinality2) return null;
  return { entity1, entity2, cardinality1, cardinality2, label, identifying };
}
function parseCardinality(str) {
  const sorted = str.split("").sort().join("");
  if (sorted === "||") return "one";
  if (sorted === "o|") return "zero-one";
  if (sorted === "|}" || sorted === "{|") return "many";
  if (sorted === "{o" || sorted === "o{") return "zero-many";
  return null;
}

// src/ascii/er-diagram.ts
function formatAttribute(attr) {
  const keyStr = attr.keys.length > 0 ? attr.keys.join(",") + " " : "   ";
  return `${keyStr}${attr.type} ${attr.name}`;
}
function buildEntitySections(entity) {
  const header = [entity.label];
  const attrs = entity.attributes.map(formatAttribute);
  if (attrs.length === 0) return [header];
  return [header, attrs];
}
function getCrowsFootChars(card, useAscii) {
  if (useAscii) {
    switch (card) {
      case "one":
        return "||";
      case "zero-one":
        return "o|";
      case "many":
        return "}|";
      case "zero-many":
        return "o{";
    }
  } else {
    switch (card) {
      case "one":
        return "\u2551";
      case "zero-one":
        return "o\u2551";
      case "many":
        return "\u255F";
      case "zero-many":
        return "o\u255F";
    }
  }
}
function renderErAscii(text, config) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("%%"));
  const diagram = parseErDiagram(lines);
  if (diagram.entities.length === 0) return "";
  const useAscii = config.useAscii;
  const hGap = 6;
  const vGap = 4;
  const entitySections = /* @__PURE__ */ new Map();
  const entityBoxW = /* @__PURE__ */ new Map();
  const entityBoxH = /* @__PURE__ */ new Map();
  for (const ent of diagram.entities) {
    const sections = buildEntitySections(ent);
    entitySections.set(ent.id, sections);
    let maxTextW = 0;
    for (const section of sections) {
      for (const line of section) maxTextW = Math.max(maxTextW, line.length);
    }
    const boxW = maxTextW + 4;
    let totalLines = 0;
    for (const section of sections) totalLines += Math.max(section.length, 1);
    const boxH = totalLines + (sections.length - 1) + 2;
    entityBoxW.set(ent.id, boxW);
    entityBoxH.set(ent.id, boxH);
  }
  const maxPerRow = Math.max(2, Math.ceil(Math.sqrt(diagram.entities.length)));
  const placed = /* @__PURE__ */ new Map();
  let currentX = 0;
  let currentY = 0;
  let maxRowH = 0;
  let colCount = 0;
  for (const ent of diagram.entities) {
    const w = entityBoxW.get(ent.id);
    const h = entityBoxH.get(ent.id);
    if (colCount >= maxPerRow) {
      currentY += maxRowH + vGap;
      currentX = 0;
      maxRowH = 0;
      colCount = 0;
    }
    let placeX = currentX;
    if (currentY > 0) {
      for (const rel of diagram.relationships) {
        const otherId = rel.entity1 === ent.id ? rel.entity2 : rel.entity2 === ent.id ? rel.entity1 : null;
        if (otherId && placed.has(otherId)) {
          const parent = placed.get(otherId);
          if (parent.y < currentY) {
            const parentCX = parent.x + Math.floor(parent.width / 2);
            placeX = Math.max(0, parentCX - Math.floor(w / 2));
            break;
          }
        }
      }
    }
    placed.set(ent.id, {
      entity: ent,
      sections: entitySections.get(ent.id),
      x: placeX,
      y: currentY,
      width: w,
      height: h
    });
    currentX = placeX + w + hGap;
    maxRowH = Math.max(maxRowH, h);
    colCount++;
  }
  let totalW = 0;
  let totalH = 0;
  for (const p of placed.values()) {
    totalW = Math.max(totalW, p.x + p.width);
    totalH = Math.max(totalH, p.y + p.height);
  }
  totalW += 4;
  totalH += 2;
  const canvas = mkCanvas(totalW - 1, totalH - 1);
  for (const p of placed.values()) {
    const boxCanvas = drawMultiBox(p.sections, useAscii);
    for (let bx = 0; bx < boxCanvas.length; bx++) {
      for (let by = 0; by < boxCanvas[0].length; by++) {
        const ch = boxCanvas[bx][by];
        if (ch !== " ") {
          const cx = p.x + bx;
          const cy = p.y + by;
          if (cx < totalW && cy < totalH) {
            canvas[cx][cy] = ch;
          }
        }
      }
    }
  }
  const H = useAscii ? "-" : "\u2500";
  const V = useAscii ? "|" : "\u2502";
  const dashH = useAscii ? "." : "\u254C";
  const dashV = useAscii ? ":" : "\u250A";
  const cornerDR = useAscii ? "+" : "\u250C";
  const cornerDL = useAscii ? "+" : "\u2510";
  const cornerUR = useAscii ? "+" : "\u2514";
  const cornerUL = useAscii ? "+" : "\u2518";
  for (const rel of diagram.relationships) {
    const e1 = placed.get(rel.entity1);
    const e2 = placed.get(rel.entity2);
    if (!e1 || !e2) continue;
    const lineH = rel.identifying ? H : dashH;
    const lineV = rel.identifying ? V : dashV;
    const e1CX = e1.x + Math.floor(e1.width / 2);
    const e1CY = e1.y + Math.floor(e1.height / 2);
    const e2CX = e2.x + Math.floor(e2.width / 2);
    const e2CY = e2.y + Math.floor(e2.height / 2);
    const sameRow = Math.abs(e1CY - e2CY) < Math.max(e1.height, e2.height);
    if (sameRow) {
      const [left, right] = e1CX < e2CX ? [e1, e2] : [e2, e1];
      const [leftCard, rightCard] = e1CX < e2CX ? [rel.cardinality1, rel.cardinality2] : [rel.cardinality2, rel.cardinality1];
      const startX = left.x + left.width;
      const endX = right.x - 1;
      const lineY = left.y + Math.floor(left.height / 2);
      for (let x = startX; x <= endX; x++) {
        if (x < totalW) canvas[x][lineY] = lineH;
      }
      const leftChars = getCrowsFootChars(leftCard, useAscii);
      for (let i = 0; i < leftChars.length; i++) {
        const mx = startX + i;
        if (mx < totalW) canvas[mx][lineY] = leftChars[i];
      }
      const rightChars = getCrowsFootChars(rightCard, useAscii);
      for (let i = 0; i < rightChars.length; i++) {
        const mx = endX - rightChars.length + 1 + i;
        if (mx >= 0 && mx < totalW) canvas[mx][lineY] = rightChars[i];
      }
      if (rel.label) {
        const gapMid = Math.floor((startX + endX) / 2);
        const labelStart = Math.max(startX, gapMid - Math.floor(rel.label.length / 2));
        const labelY = lineY - 1;
        if (labelY >= 0) {
          for (let i = 0; i < rel.label.length; i++) {
            const lx = labelStart + i;
            if (lx >= startX && lx <= endX && lx < totalW) {
              canvas[lx][labelY] = rel.label[i];
            }
          }
        }
      }
    } else {
      const [upper, lower] = e1CY < e2CY ? [e1, e2] : [e2, e1];
      const [upperCard, lowerCard] = e1CY < e2CY ? [rel.cardinality1, rel.cardinality2] : [rel.cardinality2, rel.cardinality1];
      const startY = upper.y + upper.height;
      const endY = lower.y - 1;
      const lineX = upper.x + Math.floor(upper.width / 2);
      const lowerCX = lower.x + Math.floor(lower.width / 2);
      if (lineX === lowerCX) {
        for (let y = startY; y <= endY; y++) {
          if (y < totalH) canvas[lineX][y] = lineV;
        }
      } else {
        const midY = Math.floor((startY + endY) / 2);
        for (let y = startY; y < midY; y++) {
          if (y < totalH) canvas[lineX][y] = lineV;
        }
        const lx = Math.min(lineX, lowerCX);
        const rx = Math.max(lineX, lowerCX);
        for (let x = lx; x <= rx; x++) {
          if (x < totalW && midY < totalH) canvas[x][midY] = lineH;
        }
        if (midY < totalH) {
          if (lowerCX < lineX) {
            canvas[lineX][midY] = cornerUL;
            canvas[lowerCX][midY] = cornerDR;
          } else {
            canvas[lineX][midY] = cornerUR;
            canvas[lowerCX][midY] = cornerDL;
          }
        }
        for (let y = midY + 1; y <= endY; y++) {
          if (y < totalH) canvas[lowerCX][y] = lineV;
        }
      }
      const upperChars = getCrowsFootChars(upperCard, useAscii);
      if (startY < totalH) {
        for (let i = 0; i < upperChars.length; i++) {
          const mx = lineX - Math.floor(upperChars.length / 2) + i;
          if (mx >= 0 && mx < totalW) canvas[mx][startY] = upperChars[i];
        }
      }
      const targetX = lineX !== lowerCX ? lowerCX : lineX;
      const lowerChars = getCrowsFootChars(lowerCard, useAscii);
      if (endY >= 0 && endY < totalH) {
        for (let i = 0; i < lowerChars.length; i++) {
          const mx = targetX - Math.floor(lowerChars.length / 2) + i;
          if (mx >= 0 && mx < totalW) canvas[mx][endY] = lowerChars[i];
        }
      }
      if (rel.label) {
        const midY = Math.floor((startY + endY) / 2);
        const labelX = lineX + 2;
        if (midY >= 0) {
          for (let i = 0; i < rel.label.length; i++) {
            const lx = labelX + i;
            if (lx >= 0) {
              increaseSize(canvas, lx + 1, midY + 1);
              canvas[lx][midY] = rel.label[i];
            }
          }
        }
      }
    }
  }
  return canvasToString(canvas);
}

// src/pie/parser.ts
function parsePieChart(lines) {
  const chart = {
    showData: false,
    slices: []
  };
  if (lines.length === 0) return chart;
  const header = lines[0];
  if (/\bshowData\b/i.test(header)) {
    chart.showData = true;
  }
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      chart.title = titleMatch[1].trim();
      continue;
    }
    const sliceMatch = line.match(/^"([^"]+)"\s*:\s*([\d.]+)$/);
    if (sliceMatch) {
      chart.slices.push({
        label: sliceMatch[1],
        value: parseFloat(sliceMatch[2])
      });
      continue;
    }
  }
  return chart;
}

// src/ascii/pie-chart.ts
var MAX_BAR_WIDTH = 40;
function renderPieAscii(text, config) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("%%"));
  const chart = parsePieChart(lines);
  if (chart.slices.length === 0) return "";
  const useAscii = config.useAscii;
  const fillChar = useAscii ? "#" : "\u2588";
  const total = chart.slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return "";
  const sliceData = chart.slices.map((s) => {
    const pct = s.value / total * 100;
    const barWidth = Math.round(s.value / total * MAX_BAR_WIDTH);
    return { label: s.label, value: s.value, pct, barWidth };
  });
  const maxLabelWidth = Math.max(...sliceData.map((s) => s.label.length));
  const maxPctStr = sliceData.map((s) => s.pct.toFixed(1) + "%");
  const maxPctWidth = Math.max(...maxPctStr.map((s) => s.length));
  const outputLines = [];
  if (chart.title) {
    const sampleRowWidth = 2 + maxLabelWidth + 3 + MAX_BAR_WIDTH + 2 + maxPctWidth;
    const titlePad = Math.max(0, Math.floor((sampleRowWidth - chart.title.length) / 2));
    outputLines.push(" ".repeat(titlePad) + chart.title);
  }
  for (let i = 0; i < sliceData.length; i++) {
    const s = sliceData[i];
    const pctStr = s.pct.toFixed(1) + "%";
    const bar = fillChar.repeat(s.barWidth);
    const barPad = " ".repeat(MAX_BAR_WIDTH - s.barWidth);
    const labelPad = " ".repeat(maxLabelWidth - s.label.length);
    let row = "  " + s.label + labelPad + "   " + bar + barPad + "  " + " ".repeat(maxPctWidth - pctStr.length) + pctStr;
    if (chart.showData) {
      row += "  (" + s.value + ")";
    }
    outputLines.push(row);
  }
  return outputLines.join("\n");
}

// src/timeline/parser.ts
function parseTimeline(lines) {
  const timeline = {
    sections: []
  };
  if (lines.length === 0) return timeline;
  let currentSection = { periods: [] };
  let currentPeriod = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      timeline.title = titleMatch[1].trim();
      continue;
    }
    const sectionMatch = line.match(/^section\s+(.+)$/i);
    if (sectionMatch) {
      if (currentSection.periods.length > 0) {
        timeline.sections.push(currentSection);
      }
      currentSection = { name: sectionMatch[1].trim(), periods: [] };
      currentPeriod = null;
      continue;
    }
    const continuationMatch = line.match(/^:\s*(.+)$/);
    if (continuationMatch) {
      if (currentPeriod) {
        currentPeriod.events.push(continuationMatch[1].trim());
      }
      continue;
    }
    const periodMatch = line.match(/^([^:]+?)\s*:\s*(.+)$/);
    if (periodMatch) {
      const name = periodMatch[1].trim();
      const eventsStr = periodMatch[2];
      const events = eventsStr.split(":").map((e) => e.trim()).filter((e) => e.length > 0);
      currentPeriod = { name, events };
      currentSection.periods.push(currentPeriod);
      continue;
    }
    const bare = line.trim();
    if (bare.length > 0) {
      currentPeriod = { name: bare, events: [] };
      currentSection.periods.push(currentPeriod);
    }
  }
  if (currentSection.periods.length > 0) {
    timeline.sections.push(currentSection);
  }
  return timeline;
}

// src/ascii/timeline.ts
var INDENT = "    ";
function renderTimelineAscii(text, config) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("%%"));
  const timeline = parseTimeline(lines);
  if (timeline.sections.length === 0) return "";
  const hasPeriods = timeline.sections.some((s) => s.periods.length > 0);
  if (!hasPeriods) return "";
  const useAscii = config.useAscii;
  const TL = useAscii ? "+" : "\u250C";
  const TR = useAscii ? "+" : "\u2510";
  const BL = useAscii ? "+" : "\u2514";
  const BR = useAscii ? "+" : "\u2518";
  const H = useAscii ? "-" : "\u2500";
  const V = useAscii ? "|" : "\u2502";
  const TEE = useAscii ? "+" : "\u251C";
  const ELBOW = useAscii ? "+" : "\u2514";
  const BRANCH = H + H + " ";
  const SDASH = useAscii ? "-" : "\u2500";
  const outputLines = [];
  const maxContentWidth = computeMaxWidth(timeline, INDENT);
  if (timeline.title) {
    const titlePad = Math.max(0, Math.floor((maxContentWidth - timeline.title.length) / 2));
    outputLines.push(" ".repeat(titlePad) + timeline.title);
  }
  for (let si = 0; si < timeline.sections.length; si++) {
    const section = timeline.sections[si];
    if (section.name) {
      const headerContent = " " + section.name + " ";
      const dashCount = Math.max(0, maxContentWidth - headerContent.length - 4);
      const headerLine = "  " + SDASH + SDASH + headerContent + SDASH.repeat(dashCount);
      outputLines.push(headerLine);
    }
    for (let pi = 0; pi < section.periods.length; pi++) {
      const period = section.periods[pi];
      renderPeriod(outputLines, period, { TL, TR, BL, BR, H, V, TEE, ELBOW, BRANCH });
    }
  }
  return outputLines.join("\n");
}
function renderPeriod(out, period, ch) {
  const label = period.name;
  const boxWidth = label.length + 2;
  out.push(INDENT + ch.TL + ch.H.repeat(boxWidth) + ch.TR);
  out.push(INDENT + ch.V + " " + label + " " + ch.V);
  if (period.events.length > 0) {
    const teePos = Math.floor(boxWidth / 2);
    const beforeTee = ch.H.repeat(teePos);
    const afterTee = ch.H.repeat(boxWidth - teePos - 1);
    const teeChar = ch.TL === "+" ? "+" : "\u252C";
    out.push(INDENT + ch.BL + beforeTee + teeChar + afterTee + ch.BR);
    const eventIndent = INDENT + " ".repeat(teePos + 1);
    for (let ei = 0; ei < period.events.length; ei++) {
      const isLast = ei === period.events.length - 1;
      const connector = isLast ? ch.ELBOW : ch.TEE;
      out.push(eventIndent + connector + ch.BRANCH + period.events[ei]);
    }
  } else {
    out.push(INDENT + ch.BL + ch.H.repeat(boxWidth) + ch.BR);
  }
}
function computeMaxWidth(timeline, indent) {
  let max = 0;
  if (timeline.title) {
    max = Math.max(max, timeline.title.length);
  }
  for (const section of timeline.sections) {
    if (section.name) {
      max = Math.max(max, section.name.length + 10);
    }
    for (const period of section.periods) {
      const boxWidth = period.name.length + 2;
      max = Math.max(max, indent.length + boxWidth + 2);
      for (const event of period.events) {
        const eventWidth = indent.length + Math.floor(boxWidth / 2) + 1 + 4 + event.length;
        max = Math.max(max, eventWidth);
      }
    }
  }
  return max;
}

// src/gantt/parser.ts
var TAG_SET = /* @__PURE__ */ new Set(["done", "active", "crit", "milestone"]);
function parseGanttChart(lines) {
  const chart = {
    dateFormat: "YYYY-MM-DD",
    excludes: [],
    sections: []
  };
  if (lines.length === 0) return chart;
  let currentSection = { tasks: [] };
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      chart.title = titleMatch[1].trim();
      continue;
    }
    const dfMatch = line.match(/^dateFormat\s+(.+)$/i);
    if (dfMatch) {
      chart.dateFormat = dfMatch[1].trim();
      continue;
    }
    const exMatch = line.match(/^excludes\s+(.+)$/i);
    if (exMatch) {
      chart.excludes.push(exMatch[1].trim());
      continue;
    }
    const sectionMatch = line.match(/^section\s+(.+)$/i);
    if (sectionMatch) {
      if (currentSection.tasks.length > 0) {
        chart.sections.push(currentSection);
      }
      currentSection = { name: sectionMatch[1].trim(), tasks: [] };
      continue;
    }
    const taskMatch = line.match(/^(.+?)\s*:(.+)$/);
    if (taskMatch) {
      const label = taskMatch[1].trim();
      const metadata = taskMatch[2].trim();
      const task = parseTaskMetadata(label, metadata);
      currentSection.tasks.push(task);
      continue;
    }
  }
  if (currentSection.tasks.length > 0) {
    chart.sections.push(currentSection);
  }
  return chart;
}
function parseTaskMetadata(label, metadata) {
  const parts = metadata.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
  const tags = [];
  const remaining = [];
  for (const part of parts) {
    if (TAG_SET.has(part.toLowerCase())) {
      tags.push(part.toLowerCase());
    } else {
      remaining.push(part);
    }
  }
  const task = { label, tags };
  if (remaining.length === 0) {
    return task;
  }
  if (remaining.length === 1) {
    const val = remaining[0];
    if (isDate(val) || isDuration(val)) {
      task.rawEnd = val;
    } else if (isAfterRef(val)) {
      task.rawStart = val;
    } else {
      task.id = val;
    }
    return task;
  }
  if (remaining.length === 2) {
    const [a, b] = remaining;
    if (isStartValue(a)) {
      task.rawStart = a;
      task.rawEnd = b;
    } else {
      task.id = a;
      if (isStartValue(b)) {
        task.rawStart = b;
      } else {
        task.rawEnd = b;
      }
    }
    return task;
  }
  if (remaining.length >= 3) {
    task.id = remaining[0];
    task.rawStart = remaining[1];
    task.rawEnd = remaining[2];
  }
  return task;
}
function isDate(val) {
  return /^\d{4}-\d{2}-\d{2}$/.test(val);
}
function isDuration(val) {
  return /^\d+[dwDW]$/.test(val);
}
function isAfterRef(val) {
  return /^after\s+/i.test(val);
}
function isStartValue(val) {
  return isDate(val) || isAfterRef(val);
}
function resolveGanttDates(chart) {
  const resolved = [];
  const taskEndById = /* @__PURE__ */ new Map();
  let prevEnd = new Date(2024, 0, 1);
  for (let si = 0; si < chart.sections.length; si++) {
    const section = chart.sections[si];
    for (const task of section.tasks) {
      let startDate;
      let endDate;
      if (task.rawStart && isAfterRef(task.rawStart)) {
        const refId = task.rawStart.replace(/^after\s+/i, "").trim();
        const refEnd = taskEndById.get(refId);
        startDate = refEnd ? new Date(refEnd.getTime()) : new Date(prevEnd.getTime());
      } else if (task.rawStart && isDate(task.rawStart)) {
        startDate = parseDate(task.rawStart);
      } else {
        startDate = new Date(prevEnd.getTime());
      }
      if (task.tags.includes("milestone") && !task.rawEnd) {
        endDate = new Date(startDate.getTime());
      } else if (task.rawEnd && isDate(task.rawEnd)) {
        endDate = parseDate(task.rawEnd);
      } else if (task.rawEnd && isDuration(task.rawEnd)) {
        endDate = addDuration(startDate, task.rawEnd);
      } else {
        endDate = new Date(startDate.getTime());
        endDate.setDate(endDate.getDate() + 1);
      }
      const rt = {
        label: task.label,
        id: task.id,
        tags: [...task.tags],
        startDate,
        endDate,
        sectionIndex: si
      };
      resolved.push(rt);
      if (task.id) {
        taskEndById.set(task.id, endDate);
      }
      prevEnd = endDate;
    }
  }
  return resolved;
}
function parseDate(val) {
  const [y, m, d] = val.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDuration(start, duration) {
  const match = duration.match(/^(\d+)([dwDW])$/);
  if (!match) return new Date(start.getTime());
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const result = new Date(start.getTime());
  if (unit === "d") {
    result.setDate(result.getDate() + amount);
  } else if (unit === "w") {
    result.setDate(result.getDate() + amount * 7);
  }
  return result;
}

// src/ascii/gantt.ts
var BAR_WIDTH = 30;
function renderGanttAscii(text, config) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("%%"));
  const chart = parseGanttChart(lines);
  const resolved = resolveGanttDates(chart);
  if (resolved.length === 0) return "";
  const useAscii = config.useAscii;
  const fillNormal = useAscii ? "#" : "\u2588";
  const fillDone = useAscii ? ":" : "\u2592";
  const fillCrit = useAscii ? "X" : "\u256C";
  const fillEmpty = useAscii ? "-" : "\u2500";
  const milestone = useAscii ? "<>" : "\u25C6";
  const globalStart = Math.min(...resolved.map((t) => t.startDate.getTime()));
  const globalEnd = Math.max(...resolved.map((t) => t.endDate.getTime()));
  const globalSpan = globalEnd - globalStart;
  const maxLabelWidth = Math.max(...resolved.map((t) => t.label.length));
  const sampleRowWidth = 4 + maxLabelWidth + 2 + BAR_WIDTH + 2 + 17;
  const outputLines = [];
  if (chart.title) {
    const titlePad = Math.max(0, Math.floor((sampleRowWidth - chart.title.length) / 2));
    outputLines.push(" ".repeat(titlePad) + chart.title);
  }
  let lastSectionIndex = -1;
  for (const task of resolved) {
    if (task.sectionIndex !== lastSectionIndex) {
      lastSectionIndex = task.sectionIndex;
      const section = chart.sections[task.sectionIndex];
      if (section.name) {
        outputLines.push("  " + section.name);
      }
    }
    const isMilestone = task.tags.includes("milestone");
    const labelPad = " ".repeat(maxLabelWidth - task.label.length);
    if (isMilestone) {
      const pos = globalSpan > 0 ? Math.min(Math.round((task.startDate.getTime() - globalStart) / globalSpan * (BAR_WIDTH - 1)), BAR_WIDTH - 1) : 0;
      const bar = fillEmpty.repeat(pos) + milestone + fillEmpty.repeat(Math.max(0, BAR_WIDTH - pos - milestoneWidth(milestone)));
      const dateStr = formatDate(task.startDate);
      outputLines.push("    " + task.label + labelPad + "  " + bar + "  " + dateStr);
    } else {
      let barStart = 0;
      let barEnd = BAR_WIDTH;
      if (globalSpan > 0) {
        barStart = Math.floor((task.startDate.getTime() - globalStart) / globalSpan * BAR_WIDTH);
        barEnd = Math.ceil((task.endDate.getTime() - globalStart) / globalSpan * BAR_WIDTH);
      }
      barStart = Math.max(0, Math.min(barStart, BAR_WIDTH));
      barEnd = Math.max(barStart, Math.min(barEnd, BAR_WIDTH));
      if (barEnd === barStart && barEnd < BAR_WIDTH) barEnd = barStart + 1;
      const fillChar = getFillChar(task, fillNormal, fillDone, fillCrit);
      const bar = fillEmpty.repeat(barStart) + fillChar.repeat(barEnd - barStart) + fillEmpty.repeat(BAR_WIDTH - barEnd);
      const dateStr = formatDate(task.startDate) + " -> " + formatDate(task.endDate);
      outputLines.push("    " + task.label + labelPad + "  " + bar + "  " + dateStr);
    }
  }
  return outputLines.join("\n");
}
function getFillChar(task, normal, done, crit) {
  if (task.tags.includes("crit")) return crit;
  if (task.tags.includes("done")) return done;
  return normal;
}
function formatDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return mm + "-" + dd;
}
function milestoneWidth(marker) {
  return marker.length;
}

// src/ascii/index.ts
function detectDiagramType(text) {
  const firstLine = text.trim().split(/[\n;]/)[0]?.trim().toLowerCase() ?? "";
  if (/^sequencediagram\s*$/.test(firstLine)) return "sequence";
  if (/^classdiagram\s*$/.test(firstLine)) return "class";
  if (/^erdiagram\s*$/.test(firstLine)) return "er";
  if (/^pie(\s|$)/.test(firstLine)) return "pie";
  if (/^timeline(\s|$)/.test(firstLine)) return "timeline";
  if (/^gantt(\s|$)/.test(firstLine)) return "gantt";
  return "flowchart";
}
function renderMermaidAscii(text, options = {}) {
  const config = {
    useAscii: options.useAscii ?? false,
    paddingX: options.paddingX ?? 5,
    paddingY: options.paddingY ?? 5,
    boxBorderPadding: options.boxBorderPadding ?? 1,
    graphDirection: "TD"
    // default, overridden for flowcharts below
  };
  const diagramType = detectDiagramType(text);
  switch (diagramType) {
    case "sequence":
      return renderSequenceAscii(text, config);
    case "class":
      return renderClassAscii(text, config);
    case "er":
      return renderErAscii(text, config);
    case "pie":
      return renderPieAscii(text, config);
    case "timeline":
      return renderTimelineAscii(text, config);
    case "gantt":
      return renderGanttAscii(text, config);
    case "flowchart":
    default: {
      const parsed = parseMermaid(text);
      if (parsed.direction === "LR" || parsed.direction === "RL") {
        config.graphDirection = "LR";
      } else {
        config.graphDirection = "TD";
      }
      const graph = convertToAsciiGraph(parsed, config);
      createMapping(graph);
      drawGraph(graph);
      if (parsed.direction === "BT") {
        flipCanvasVertically(graph.canvas);
      }
      return canvasToString(graph.canvas);
    }
  }
}

export { renderMermaidAscii };
