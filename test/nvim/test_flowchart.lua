local h = dofile(vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h") .. "/helpers.lua")
local detect = require("ascii-mermaid.detect")
local display = require("ascii-mermaid.display")

h.setup()

local bufnr = h.create_mermaid_buffer([[graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B]])

-- Block detection
local blocks = detect.find_blocks(bufnr)
h.assert(#blocks == 1, "expected 1 mermaid block, found " .. #blocks)
h.assert(blocks[1].content:find("graph TD") ~= nil, "block content should contain 'graph TD'")

-- Trigger rendering and wait
display.show(bufnr, require("ascii-mermaid").config)
local found = h.wait_for_extmarks(bufnr)
h.assert(found, "extmarks not found after rendering (timeout)")

-- Extmarks exist
local marks = h.get_extmarks(bufnr)
h.assert(#marks > 0, "expected at least 1 extmark")

-- Virtual text contains expected labels
local virt_lines = h.get_virt_text_lines(bufnr)
h.assert(#virt_lines > 0, "expected non-empty virtual text")
h.assert_any_match(virt_lines, "Start", "virtual text should contain 'Start'")
h.assert_any_match(virt_lines, "Great!", "virtual text should contain 'Great!'")
h.assert_any_match(virt_lines, "Debug", "virtual text should contain 'Debug'")

-- is_rendered reports true
h.assert(display.is_rendered(bufnr), "is_rendered should be true after rendering")

-- Clear works
display.clear(bufnr)
local marks_after = h.get_extmarks(bufnr)
h.assert(#marks_after == 0, "expected 0 extmarks after clear")
h.assert(not display.is_rendered(bufnr), "is_rendered should be false after clear")

h.pass()
