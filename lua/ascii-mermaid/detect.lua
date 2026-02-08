local M = {}

--- Find mermaid code blocks using tree-sitter, with regex fallback.
--- Returns a list of { start_line, end_line, content } (0-indexed lines).
---@param bufnr number
---@return table[]
function M.find_blocks(bufnr)
  local ok, blocks = pcall(M._treesitter_detect, bufnr)
  if ok and #blocks > 0 then
    return blocks
  end
  return M._regex_detect(bufnr)
end

---@param bufnr number
---@return table[]
function M._treesitter_detect(bufnr)
  local parser = vim.treesitter.get_parser(bufnr, "markdown")
  local tree = parser:parse()[1]
  local root = tree:root()

  local query = vim.treesitter.query.parse(
    "markdown",
    [[
      (fenced_code_block
        (info_string (language) @lang)
        (code_fence_content) @content) @block
    ]]
  )

  local blocks = {}
  for id, node, _ in query:iter_captures(root, bufnr, 0, -1) do
    local name = query.captures[id]
    if name == "block" then
      local start_row, _, end_row, _ = node:range()
      -- Collect child captures for this block node
      local lang_text = nil
      local content_text = nil
      for child_id, child_node, _ in query:iter_captures(node, bufnr, start_row, end_row) do
        local child_name = query.captures[child_id]
        if child_name == "lang" then
          lang_text = vim.treesitter.get_node_text(child_node, bufnr)
        elseif child_name == "content" then
          content_text = vim.treesitter.get_node_text(child_node, bufnr)
        end
      end
      if lang_text and lang_text:match("^mermaid") and content_text then
        table.insert(blocks, {
          start_line = start_row,
          end_line = end_row - 1,
          content = content_text,
        })
      end
    end
  end
  return blocks
end

---@param bufnr number
---@return table[]
function M._regex_detect(bufnr)
  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  local blocks = {}
  local i = 1
  while i <= #lines do
    if lines[i]:match("^```mermaid") then
      local start_line = i - 1 -- convert to 0-indexed
      local content_lines = {}
      i = i + 1
      while i <= #lines and not lines[i]:match("^```%s*$") do
        table.insert(content_lines, lines[i])
        i = i + 1
      end
      if i <= #lines then
        table.insert(blocks, {
          start_line = start_line,
          end_line = i - 1, -- 0-indexed closing fence line
          content = table.concat(content_lines, "\n"),
        })
      end
    end
    i = i + 1
  end
  return blocks
end

return M
