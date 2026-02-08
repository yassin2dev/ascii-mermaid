local M = {}

--- Resolve the path to the plugin root.
---@return string
local function plugin_root()
  local source = debug.getinfo(1, "S").source:sub(2)
  return vim.fn.fnamemodify(source, ":h:h:h")
end

--- Render mermaid source to ASCII asynchronously.
---@param source string mermaid diagram source
---@param opts table render options passed to renderMermaidAscii
---@param callback fun(lines: string[]|nil, err: string|nil)
function M.render(source, opts, callback)
  local engine = plugin_root() .. "/ts/dist/index.js"
  local stdin_data = vim.json.encode({ source = source, options = opts })

  local node_code = string.format(
    'import{renderMermaidAscii}from"%s";'
      .. "let d='';process.stdin.setEncoding('utf-8');"
      .. "process.stdin.on('data',c=>d+=c);"
      .. "process.stdin.on('end',()=>{try{"
      .. "const{source:s,options:o}=JSON.parse(d);"
      .. "process.stdout.write(renderMermaidAscii(s,o||{}))"
      .. "}catch(e){process.stderr.write(e.message);process.exitCode=1}})",
    engine
  )

  vim.system(
    { "node", "--input-type=module", "-e", node_code },
    {
      stdin = stdin_data,
      text = true,
    },
    function(result)
      vim.schedule(function()
        if result.code ~= 0 then
          local err_msg = result.stderr or "unknown error"
          callback(nil, "ascii-mermaid: render failed: " .. err_msg)
          return
        end
        local output = result.stdout or ""
        -- Strip trailing empty lines
        output = output:gsub("%s+$", "")
        local lines = vim.split(output, "\n", { plain = true })
        callback(lines, nil)
      end)
    end
  )
end

return M
