-- Debug script: run after rendering in replace mode
-- :luafile test/debug_replace.lua

local bufnr = vim.api.nvim_get_current_buf()
local ns = vim.api.nvim_create_namespace("ascii_mermaid")
local marks = vim.api.nvim_buf_get_extmarks(bufnr, ns, 0, -1, { details = true })

print("=== ascii_mermaid extmarks: " .. #marks .. " total ===")
for i, mark in ipairs(marks) do
  local id, row, col = mark[1], mark[2], mark[3]
  local d = mark[4]
  local vtp = d.virt_text_pos or "nil"
  local vt_len = d.virt_text and #d.virt_text or 0
  local vl_len = d.virt_lines and #d.virt_lines or 0
  print(string.format("  mark[%d] id=%d row=%d col=%d virt_text_pos=%s virt_text_chunks=%d virt_lines=%d",
    i, id, row, col, vtp, vt_len, vl_len))
  if d.virt_text then
    for j, chunk in ipairs(d.virt_text) do
      print(string.format("    virt_text[%d] = [%s] (len=%d)", j, chunk[1]:sub(1, 60), #chunk[1]))
    end
  end
  if d.virt_lines then
    for j, vl in ipairs(d.virt_lines) do
      local txt = vl[1] and vl[1][1] or ""
      print(string.format("    virt_line[%d] = [%s]", j, txt:sub(1, 60)))
    end
  end
end

-- Also show buffer line count and block range
local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
print("\n=== Buffer: " .. #lines .. " lines ===")
for i, line in ipairs(lines) do
  if line:match("^```") then
    print(string.format("  line %d (0-idx %d): %s", i, i - 1, line))
  end
end
