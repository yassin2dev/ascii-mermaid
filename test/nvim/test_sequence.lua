local h = dofile(vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h") .. "/helpers.lua")
local detect = require("ascii-mermaid.detect")
local display = require("ascii-mermaid.display")

h.setup()

local bufnr = h.create_mermaid_buffer([[sequenceDiagram
    Alice->>Bob: Hello Bob
    Bob-->>Alice: Hi Alice
    Alice->>Bob: How are you?
    Bob-->>Alice: Good thanks!]])

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

-- Virtual text contains expected participant names and messages
local virt_lines = h.get_virt_text_lines(bufnr)
h.assert(#virt_lines > 0, "expected non-empty virtual text")
h.assert_any_match(virt_lines, "Alice", "virtual text should contain 'Alice'")
h.assert_any_match(virt_lines, "Bob", "virtual text should contain 'Bob'")
h.assert_any_match(virt_lines, "Hello Bob", "virtual text should contain 'Hello Bob'")

-- Clear works
display.clear(bufnr)
h.assert(not display.is_rendered(bufnr), "is_rendered should be false after clear")

h.pass()
