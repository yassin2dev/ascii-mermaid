local h = dofile(vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h") .. "/helpers.lua")
local display = require("ascii-mermaid.display")

local mermaid_src = [=[graph TD
    A[Start] --> B[End]]=]

-- ============================================================
-- Test 1: Inline mode produces virt_lines (no overlays)
-- ============================================================
h.setup({ display_mode = "inline" })

local bufnr1 = h.create_mermaid_buffer(mermaid_src)
local cfg_inline = require("ascii-mermaid").config

display.show(bufnr1, cfg_inline)
local found1 = h.wait_for_extmarks(bufnr1)
h.assert(found1, "inline: extmarks not found after rendering (timeout)")

local virt_lines1 = h.get_virt_text_lines(bufnr1)
h.assert(#virt_lines1 > 0, "inline: expected non-empty virtual text lines")
h.assert_any_match(virt_lines1, "Start", "inline: virtual text should contain 'Start'")

local overlays1 = h.get_overlay_extmarks(bufnr1)
h.assert(#overlays1 == 0, "inline: expected no overlay extmarks, found " .. #overlays1)

display.clear(bufnr1)

-- ============================================================
-- Test 2: Replace mode produces virt_lines + overlay blanks
-- ============================================================
local cfg_replace = vim.tbl_deep_extend("force", cfg_inline, { display_mode = "replace" })

local bufnr2 = h.create_mermaid_buffer(mermaid_src)
display.show(bufnr2, cfg_replace)
local found2 = h.wait_for_extmarks(bufnr2)
h.assert(found2, "replace: extmarks not found after rendering (timeout)")

local overlays2 = h.get_overlay_extmarks(bufnr2)
h.assert(#overlays2 > 0, "replace: expected overlay extmarks for diagram content")

-- "Start" may be in overlay text or overflow virt_lines depending on diagram height
local all_text2 = h.get_virt_text_lines(bufnr2)
for _, t in ipairs(h.get_overlay_text_lines(bufnr2)) do
  table.insert(all_text2, t)
end
h.assert_any_match(all_text2, "Start", "replace: rendered text should contain 'Start'")

-- is_rendered reports true
h.assert(display.is_rendered(bufnr2), "replace: is_rendered should be true after rendering")

-- Clear works
display.clear(bufnr2)
local marks_after2 = h.get_extmarks(bufnr2)
h.assert(#marks_after2 == 0, "replace: expected 0 extmarks after clear")
h.assert(not display.is_rendered(bufnr2), "replace: is_rendered should be false after clear")

-- ============================================================
-- Test 3: Replace mode cursor toggle (on_cursor_moved)
-- ============================================================
local bufnr3 = h.create_mermaid_buffer(mermaid_src)
display.show(bufnr3, cfg_replace)
local found3 = h.wait_for_extmarks(bufnr3)
h.assert(found3, "cursor: extmarks not found after rendering (timeout)")

-- Verify overlays are visible initially
local overlays3a = h.get_overlay_extmarks(bufnr3)
h.assert(#overlays3a > 0, "cursor: overlays should be visible initially")

-- Move cursor inside the mermaid block (line 4 = source content, 1-indexed)
vim.api.nvim_set_current_buf(bufnr3)
vim.api.nvim_win_set_cursor(0, { 4, 0 })
display.on_cursor_moved(bufnr3, cfg_replace)

-- Overlays should be hidden
local overlays3b = h.get_overlay_extmarks(bufnr3)
h.assert(#overlays3b == 0, "cursor: overlays should be hidden when cursor is inside block, found " .. #overlays3b)

-- Move cursor outside the block (line 1)
vim.api.nvim_win_set_cursor(0, { 1, 0 })
display.on_cursor_moved(bufnr3, cfg_replace)

-- Overlays should be restored
local overlays3c = h.get_overlay_extmarks(bufnr3)
h.assert(#overlays3c > 0, "cursor: overlays should be restored when cursor leaves block")

display.clear(bufnr3)

-- ============================================================
-- Test 4: Hybrid mode below threshold -> inline behavior
-- ============================================================
local cfg_hybrid_high = vim.tbl_deep_extend("force", cfg_inline, {
  display_mode = "hybrid",
  hybrid_threshold = 999,
})

local bufnr4 = h.create_mermaid_buffer(mermaid_src)
display.show(bufnr4, cfg_hybrid_high)
local found4 = h.wait_for_extmarks(bufnr4)
h.assert(found4, "hybrid-low: extmarks not found after rendering (timeout)")

local overlays4 = h.get_overlay_extmarks(bufnr4)
h.assert(#overlays4 == 0, "hybrid-low: expected no overlays (should use inline), found " .. #overlays4)

local virt_lines4 = h.get_virt_text_lines(bufnr4)
h.assert(#virt_lines4 > 0, "hybrid-low: expected virt_lines for small diagram")

display.clear(bufnr4)

-- ============================================================
-- Test 5: Hybrid mode above threshold -> replace behavior
-- ============================================================
local cfg_hybrid_low = vim.tbl_deep_extend("force", cfg_inline, {
  display_mode = "hybrid",
  hybrid_threshold = 1,
})

local bufnr5 = h.create_mermaid_buffer(mermaid_src)
display.show(bufnr5, cfg_hybrid_low)
local found5 = h.wait_for_extmarks(bufnr5)
h.assert(found5, "hybrid-high: extmarks not found after rendering (timeout)")

local overlays5 = h.get_overlay_extmarks(bufnr5)
h.assert(#overlays5 > 0, "hybrid-high: expected overlay extmarks for large diagram, found 0")

display.clear(bufnr5)

-- ============================================================
-- Test 6: Replace mode — overlay covers full source line width
-- Padding uses a transparent hl so source text doesn't leak through.
-- ============================================================
local wide_src = [=[stateDiagram-v2
    [*] --> Idle
    Idle --> Active: start
    Active --> Idle: stop
    Active --> [*]]=]

local bufnr6 = h.create_mermaid_buffer(wide_src)
display.show(bufnr6, cfg_replace)
local found6 = h.wait_for_extmarks(bufnr6)
h.assert(found6, "width: extmarks not found after rendering (timeout)")

local details6 = h.get_overlay_details(bufnr6)
h.assert(#details6 > 0, "width: expected overlay extmarks")

-- Each overlay must be at least as wide as the source line it covers
for _, d in ipairs(details6) do
  local src_line = vim.api.nvim_buf_get_lines(bufnr6, d.line, d.line + 1, false)[1] or ""
  local src_width = vim.fn.strdisplaywidth(src_line)
  h.assert(d.width >= src_width,
    "width: overlay at line " .. d.line .. " is " .. d.width
    .. " chars but source is " .. src_width .. " chars")
end

display.clear(bufnr6)

-- ============================================================
-- Test 7: Replace mode — no overlay line is entirely whitespace
-- All-space overlays create visible block artifacts.
-- ============================================================
local bufnr7 = h.create_mermaid_buffer(wide_src)
display.show(bufnr7, cfg_replace)
local found7 = h.wait_for_extmarks(bufnr7)
h.assert(found7, "no-blank: extmarks not found after rendering (timeout)")

local details7 = h.get_overlay_details(bufnr7)
for _, d in ipairs(details7) do
  local trimmed = d.text:match("^%s*(.-)%s*$")
  h.assert(trimmed ~= "",
    "no-blank: overlay at line " .. d.line .. " is entirely whitespace (would cause blocks)")
end

display.clear(bufnr7)

-- ============================================================
-- Test 8: Replace mode — fence lines have no overlay
-- Tree-sitter markdown highlighting prevents overlays on fence lines.
-- ============================================================
local bufnr8 = h.create_mermaid_buffer(mermaid_src)
display.show(bufnr8, cfg_replace)
local found8 = h.wait_for_extmarks(bufnr8)
h.assert(found8, "fence: extmarks not found after rendering (timeout)")

-- Opening fence is at line 2, closing fence at end.
-- Neither should have overlays.
local details8 = h.get_overlay_details(bufnr8)
local buf8_lines = vim.api.nvim_buf_get_lines(bufnr8, 0, -1, false)
local fence_start = 2
local fence_end = nil
for i, l in ipairs(buf8_lines) do
  if i > fence_start + 1 and l:match("^```%s*$") then
    fence_end = i - 1 -- 0-indexed
    break
  end
end

for _, d in ipairs(details8) do
  h.assert(d.line ~= fence_start,
    "fence: opening fence (line " .. fence_start .. ") should not have an overlay")
  if fence_end then
    h.assert(d.line ~= fence_end,
      "fence: closing fence (line " .. fence_end .. ") should not have an overlay")
  end
end

display.clear(bufnr8)

-- ============================================================
-- Test 9: Readonly mode produces overlays (same as replace)
-- ============================================================
local cfg_readonly = vim.tbl_deep_extend("force", cfg_inline, { display_mode = "readonly" })

local bufnr9 = h.create_mermaid_buffer(mermaid_src)
display.show(bufnr9, cfg_readonly)
local found9 = h.wait_for_extmarks(bufnr9)
h.assert(found9, "readonly: extmarks not found after rendering (timeout)")

local overlays9 = h.get_overlay_extmarks(bufnr9)
h.assert(#overlays9 > 0, "readonly: expected overlay extmarks for diagram content")

local all_text9 = h.get_virt_text_lines(bufnr9)
for _, t in ipairs(h.get_overlay_text_lines(bufnr9)) do
  table.insert(all_text9, t)
end
h.assert_any_match(all_text9, "Start", "readonly: rendered text should contain 'Start'")

display.clear(bufnr9)

-- ============================================================
-- Test 10: Readonly mode does NOT toggle overlays on cursor move
-- ============================================================
local bufnr10 = h.create_mermaid_buffer(mermaid_src)
display.show(bufnr10, cfg_readonly)
local found10 = h.wait_for_extmarks(bufnr10)
h.assert(found10, "readonly-cursor: extmarks not found after rendering (timeout)")

-- Verify overlays are visible initially
local overlays10a = h.get_overlay_extmarks(bufnr10)
h.assert(#overlays10a > 0, "readonly-cursor: overlays should be visible initially")

-- Move cursor inside the mermaid block (line 4 = source content, 1-indexed)
vim.api.nvim_set_current_buf(bufnr10)
vim.api.nvim_win_set_cursor(0, { 4, 0 })
display.on_cursor_moved(bufnr10, cfg_readonly)

-- Overlays should STILL be visible (readonly does not toggle)
local overlays10b = h.get_overlay_extmarks(bufnr10)
h.assert(#overlays10b > 0, "readonly-cursor: overlays should remain visible when cursor is inside block, found " .. #overlays10b)

display.clear(bufnr10)

h.pass()
