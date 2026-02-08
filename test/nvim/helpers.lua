local M = {}

local plugin_root = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h:h:h")

--- Setup the plugin runtime path and load it (no auto-render).
---@param opts? table  extra config overrides (merged after defaults)
function M.setup(opts)
  vim.opt.rtp:prepend(plugin_root)
  local config = { auto = false, debounce_ms = 0, display_mode = "inline" }
  if opts then
    config = vim.tbl_deep_extend("force", config, opts)
  end
  require("ascii-mermaid").setup(config)
end

--- Create a buffer with a mermaid code block from raw source.
---@param mermaid_src string  mermaid source (without ``` fences)
---@return number bufnr
function M.create_mermaid_buffer(mermaid_src)
  local lines = { "# Test", "", "```mermaid" }
  for line in mermaid_src:gmatch("[^\n]+") do
    table.insert(lines, line)
  end
  table.insert(lines, "```")
  table.insert(lines, "")
  local bufnr = vim.api.nvim_create_buf(true, true)
  vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
  vim.bo[bufnr].filetype = "markdown"
  vim.bo[bufnr].modified = false
  return bufnr
end

--- Wait for extmarks to appear in the ascii_mermaid namespace.
---@param bufnr number
---@param timeout_ms? number  default 10000
---@return boolean
function M.wait_for_extmarks(bufnr, timeout_ms)
  timeout_ms = timeout_ms or 10000
  local ns = vim.api.nvim_create_namespace("ascii_mermaid")
  local ok = vim.wait(timeout_ms, function()
    local marks = vim.api.nvim_buf_get_extmarks(bufnr, ns, 0, -1, { details = true })
    return #marks > 0
  end, 100)
  return ok
end

--- Get all extmarks with details in the ascii_mermaid namespace.
---@param bufnr number
---@return table[]
function M.get_extmarks(bufnr)
  local ns = vim.api.nvim_create_namespace("ascii_mermaid")
  return vim.api.nvim_buf_get_extmarks(bufnr, ns, 0, -1, { details = true })
end

--- Extract all virtual text line strings from extmarks.
---@param bufnr number
---@return string[]
function M.get_virt_text_lines(bufnr)
  local marks = M.get_extmarks(bufnr)
  local result = {}
  for _, mark in ipairs(marks) do
    local details = mark[4]
    if details and details.virt_lines then
      for _, virt_line in ipairs(details.virt_lines) do
        for _, chunk in ipairs(virt_line) do
          if chunk[1] and #chunk[1] > 0 then
            table.insert(result, chunk[1])
          end
        end
      end
    end
  end
  return result
end

--- Get all overlay extmarks (virt_text_pos = "overlay") in the ascii_mermaid namespace.
---@param bufnr number
---@return table[]
function M.get_overlay_extmarks(bufnr)
  local ns = vim.api.nvim_create_namespace("ascii_mermaid")
  local marks = vim.api.nvim_buf_get_extmarks(bufnr, ns, 0, -1, { details = true })
  local result = {}
  for _, mark in ipairs(marks) do
    local details = mark[4]
    if details and details.virt_text_pos == "overlay" then
      table.insert(result, mark)
    end
  end
  return result
end

--- Extract overlay text content as strings.
---@param bufnr number
---@return string[]
function M.get_overlay_text_lines(bufnr)
  local marks = M.get_overlay_extmarks(bufnr)
  local result = {}
  for _, mark in ipairs(marks) do
    local details = mark[4]
    if details and details.virt_text then
      for _, chunk in ipairs(details.virt_text) do
        if chunk[1] and #chunk[1] > 0 then
          table.insert(result, chunk[1])
        end
      end
    end
  end
  return result
end

--- Get overlay extmarks with their line positions and text widths.
--- Returns { { line = 0-indexed, text = string, width = number } ... }
---@param bufnr number
---@return table[]
function M.get_overlay_details(bufnr)
  local marks = M.get_overlay_extmarks(bufnr)
  local result = {}
  for _, mark in ipairs(marks) do
    local line = mark[2]
    local details = mark[4]
    if details and details.virt_text then
      local full_text = ""
      for _, chunk in ipairs(details.virt_text) do
        full_text = full_text .. (chunk[1] or "")
      end
      table.insert(result, {
        line = line,
        text = full_text,
        width = vim.fn.strdisplaywidth(full_text),
      })
    end
  end
  return result
end

--- Assert condition; on failure print message and exit with code 1.
---@param cond boolean
---@param msg string
function M.assert(cond, msg)
  if not cond then
    io.stderr:write("FAIL: " .. msg .. "\n")
    vim.cmd("cquit! 1")
  end
end

--- Assert that at least one string in the list contains the pattern (plain text match).
---@param strings string[]
---@param pattern string
---@param msg string
function M.assert_any_match(strings, pattern, msg)
  for _, s in ipairs(strings) do
    if s:find(pattern, 1, true) then
      return
    end
  end
  io.stderr:write("FAIL: " .. msg .. "\n")
  io.stderr:write("  Looking for: " .. pattern .. "\n")
  io.stderr:write("  In " .. #strings .. " virtual text lines\n")
  vim.cmd("cquit! 1")
end

--- Exit successfully.
function M.pass()
  vim.cmd("quit!")
end

return M
