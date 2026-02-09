local h = dofile(vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h") .. "/helpers.lua")
local detect = require("ascii-mermaid.detect")
local display = require("ascii-mermaid.display")

h.setup()

local bufnr = h.create_mermaid_buffer([[gantt
    title Project Plan
    dateFormat YYYY-MM-DD
    section Planning
        Requirements :done, req1, 2024-01-01, 14d
        Design       :active, des1, after req1, 14d
    section Development
        Backend      :crit, dev1, 2024-02-01, 30d]])

-- Block detection
local blocks = detect.find_blocks(bufnr)
h.assert(#blocks == 1, "expected 1 mermaid block, found " .. #blocks)

-- Render and wait
display.show(bufnr, require("ascii-mermaid").config)
local found = h.wait_for_extmarks(bufnr)
h.assert(found, "extmarks not found after rendering (timeout)")

-- Extmarks exist
local marks = h.get_extmarks(bufnr)
h.assert(#marks > 0, "expected at least 1 extmark")

-- Virtual text contains expected task labels and section names
local virt_lines = h.get_virt_text_lines(bufnr)
h.assert(#virt_lines > 0, "expected non-empty virtual text")
h.assert_any_match(virt_lines, "Requirements", "virtual text should contain 'Requirements'")
h.assert_any_match(virt_lines, "Backend", "virtual text should contain 'Backend'")
h.assert_any_match(virt_lines, "Planning", "virtual text should contain 'Planning'")

-- Clear works
display.clear(bufnr)
h.assert(not display.is_rendered(bufnr), "is_rendered should be false after clear")

h.pass()
