local render = require("ascii-mermaid.render")
local detect = require("ascii-mermaid.detect")

local M = {}

local ns = vim.api.nvim_create_namespace("ascii_mermaid")

-- Track rendered blocks per buffer:
-- { [bufnr] = { [start_line] = entry } }
-- Entry fields depend on mode, see render_block_inline / render_block_replace.
local rendered = {}

-- Track which block the cursor is currently inside (for replace mode overlay toggle).
-- { [bufnr] = start_line | nil }
local cursor_block = {}

local function content_hash(str)
  local h = 0
  for i = 1, #str do
    h = (h * 31 + string.byte(str, i)) % 2147483647
  end
  return h
end

---Create overlay extmarks for a replace-mode entry.
---@param bufnr number
---@param entry table
local function show_overlays(bufnr, entry)
  if entry.overlays_visible then
    return
  end

  local overlay_ids = {}
  -- Only overlay content lines between the fences — tree-sitter markdown
  -- highlighting prevents overlays on the fence lines from rendering.
  local overlay_start = entry.start_line + 1
  local src_end = entry.block_end_line - 1
  local overlay_count = math.max(0, src_end - overlay_start + 1)
  local diagram_count = #entry.lines
  local has_overflow = diagram_count > overlay_count

  -- Overflow goes on the closing fence line (always a valid buffer line)
  local fence_end = entry.block_end_line
  local total_lines = vim.api.nvim_buf_line_count(bufnr)
  local has_next_line = (fence_end + 1) < total_lines

  local overlay_slots = overlay_count

  -- Extend overlays to the full window width so the right edge is invisible
  -- (at the window boundary where every line ends anyway).
  local winid = vim.fn.bufwinid(bufnr)
  local uniform_width = winid ~= -1 and vim.api.nvim_win_get_width(winid) or 120

  for i = 0, overlay_slots - 1 do
    local line_idx = overlay_start + i
    local text
    if i < diagram_count and entry.lines[i + 1] ~= "" then
      text = "  " .. entry.lines[i + 1]
    else
      -- No diagram content for this source line — hide with space overlay
      text = " "
    end
    local text_width = vim.fn.strdisplaywidth(text)
    if uniform_width > text_width then
      text = text .. string.rep(" ", uniform_width - text_width)
    end

    local id = vim.api.nvim_buf_set_extmark(bufnr, ns, line_idx, 0, {
      virt_text = { { text, "Comment" } },
      virt_text_pos = "overlay",
    })
    table.insert(overlay_ids, id)
  end

  -- Overflow: remaining diagram lines that don't fit in the source block
  if diagram_count > overlay_slots then
    local overflow_virt_lines = {}
    for i = overlay_slots + 1, diagram_count do
      table.insert(overflow_virt_lines, { { "  " .. entry.lines[i], "Comment" } })
    end

    if has_next_line then
      -- Place on the line after the closing fence (virt_lines_above=true)
      -- so they appear between the closing fence and the next content.
      local id = vim.api.nvim_buf_set_extmark(bufnr, ns, fence_end + 1, 0, {
        virt_lines = overflow_virt_lines,
        virt_lines_above = true,
      })
      table.insert(overlay_ids, id)
    else
      -- Closing fence is last line; use it for virt_lines below
      local id = vim.api.nvim_buf_set_extmark(bufnr, ns, fence_end, 0, {
        virt_lines = overflow_virt_lines,
        virt_lines_above = false,
      })
      table.insert(overlay_ids, id)
    end
  end

  entry.overlay_ids = overlay_ids
  entry.overlays_visible = true
end

---Remove overlay extmarks for a replace-mode entry (reveal source).
---@param bufnr number
---@param entry table
local function hide_overlays(bufnr, entry)
  if not entry.overlays_visible then
    return
  end

  if entry.overlay_ids then
    for _, id in ipairs(entry.overlay_ids) do
      vim.api.nvim_buf_del_extmark(bufnr, ns, id)
    end
    entry.overlay_ids = {}
  end

  entry.overlays_visible = false
end

---Clear a single entry's extmarks (any mode).
---@param bufnr number
---@param entry table
local function clear_entry(bufnr, entry)
  if entry.mode == "replace" or entry.mode == "readonly" then
    hide_overlays(bufnr, entry)
  elseif entry.id then
    vim.api.nvim_buf_del_extmark(bufnr, ns, entry.id)
  end
end

---Render a block using inline mode (virt_lines below closing fence).
---@param bufnr number
---@param block table
---@param lines string[]
---@param hash number
local function render_block_inline(bufnr, block, lines, hash)
  local virt_lines = {}
  table.insert(virt_lines, { { "", "Comment" } })
  for _, line in ipairs(lines) do
    table.insert(virt_lines, { { "  " .. line, "Comment" } })
  end
  table.insert(virt_lines, { { "", "Comment" } })

  local extmark_id = vim.api.nvim_buf_set_extmark(bufnr, ns, block.end_line, 0, {
    virt_lines = virt_lines,
    virt_lines_above = false,
  })

  rendered[bufnr][block.start_line] = {
    id = extmark_id,
    hash = hash,
    pending = false,
    mode = "inline",
  }
end

---Render a block using replace mode (overlay extmarks on source lines).
---@param bufnr number
---@param block table
---@param lines string[]
---@param hash number
local function render_block_replace(bufnr, block, lines, hash, mode)
  local entry = {
    hash = hash,
    pending = false,
    mode = mode or "replace",
    lines = lines,
    start_line = block.start_line,
    block_end_line = block.end_line,
    overlay_ids = {},
    overlays_visible = false,
  }

  rendered[bufnr][block.start_line] = entry

  -- Don't overlay if cursor is currently inside this block (readonly always overlays)
  if mode ~= "readonly" and cursor_block[bufnr] == block.start_line then
    return
  end

  show_overlays(bufnr, entry)
end

---@param bufnr number
---@param block table { start_line, end_line, content }
---@param config table plugin config
local function render_block(bufnr, block, config)
  local hash = content_hash(block.content)

  if not rendered[bufnr] then
    rendered[bufnr] = {}
  end

  local entry = rendered[bufnr][block.start_line]
  if entry then
    if entry.hash == hash then
      return -- already rendered or in-flight, content unchanged
    end
    -- Content changed -- remove old extmarks
    clear_entry(bufnr, entry)
  end

  -- Mark as pending immediately to prevent duplicate async renders
  rendered[bufnr][block.start_line] = { id = nil, hash = hash, pending = true, mode = "inline" }

  local render_opts = {
    useAscii = config.use_ascii,
    paddingX = config.padding_x,
    paddingY = config.padding_y,
  }

  render.render(block.content, render_opts, function(lines, err)
    if err then
      vim.notify(err, vim.log.levels.WARN)
      if rendered[bufnr] then
        rendered[bufnr][block.start_line] = nil
      end
      return
    end
    if not lines or #lines == 0 then
      return
    end
    if not vim.api.nvim_buf_is_valid(bufnr) then
      return
    end

    -- Check we haven't been cleared or superseded while async was in-flight
    local current = rendered[bufnr] and rendered[bufnr][block.start_line]
    if not current or current.hash ~= hash then
      return
    end

    -- Determine effective mode for this block
    local mode = config.display_mode or "inline"
    if mode == "hybrid" then
      local threshold = config.hybrid_threshold or 15
      if #lines >= threshold then
        mode = "replace"
      else
        mode = "inline"
      end
    end

    if mode == "replace" or mode == "readonly" then
      render_block_replace(bufnr, block, lines, hash, mode)
    else
      render_block_inline(bufnr, block, lines, hash)
    end
  end)
end

--- Render all mermaid blocks in the buffer.
---@param bufnr number
---@param config table
function M.show(bufnr, config)
  local blocks = detect.find_blocks(bufnr)
  for _, block in ipairs(blocks) do
    render_block(bufnr, block, config)
  end
end

--- Clear all rendered diagrams in the buffer.
---@param bufnr number
function M.clear(bufnr)
  vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)
  rendered[bufnr] = nil
  cursor_block[bufnr] = nil
end

--- Toggle rendering for the buffer.
---@param bufnr number
---@param config table
function M.toggle(bufnr, config)
  if rendered[bufnr] and next(rendered[bufnr]) then
    M.clear(bufnr)
  else
    M.show(bufnr, config)
  end
end

--- Check if any diagrams are currently rendered in the buffer.
---@param bufnr number
---@return boolean
function M.is_rendered(bufnr)
  return rendered[bufnr] ~= nil and next(rendered[bufnr]) ~= nil
end

--- Handle CursorMoved: show/hide overlays as cursor enters/leaves mermaid blocks.
--- Called from CursorMoved autocmd when display_mode is "replace" or "hybrid".
---@param bufnr number
---@param config table
function M.on_cursor_moved(bufnr, config)
  local mode = config.display_mode or "inline"
  if mode == "inline" or mode == "readonly" then
    return
  end

  if not rendered[bufnr] then
    return
  end

  local cursor_line = vim.api.nvim_win_get_cursor(0)[1] - 1 -- 0-indexed

  -- Find which block (if any) the cursor is inside
  local new_block = nil
  for start_line, entry in pairs(rendered[bufnr]) do
    if entry.mode == "replace" and entry.block_end_line then
      if cursor_line >= start_line and cursor_line <= entry.block_end_line then
        new_block = start_line
        break
      end
    end
  end

  local old_block = cursor_block[bufnr]

  if new_block == old_block then
    return -- no change
  end

  -- Restore overlays on the block we left
  if old_block and rendered[bufnr][old_block] then
    show_overlays(bufnr, rendered[bufnr][old_block])
  end

  -- Hide overlays on the block we entered
  if new_block and rendered[bufnr][new_block] then
    hide_overlays(bufnr, rendered[bufnr][new_block])
  end

  cursor_block[bufnr] = new_block
end

return M
