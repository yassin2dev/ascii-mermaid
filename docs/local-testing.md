# Local Testing

## Quick start

Open Neovim and run:

```vim
:set rtp+=/home/kais/Work/ascii-mermaid
:lua require("ascii-mermaid").setup()
:edit test.md
```

Diagrams render automatically on `BufEnter` and `CursorHold`.

## Commands

- `:MermaidRender` -- toggle rendering for current buffer
- `:MermaidRenderAll` -- force re-render all blocks
- `:MermaidClear` -- clear all rendered diagrams

## Rebuilding the engine

```bash
cd ts && npm install && npm run build
```
