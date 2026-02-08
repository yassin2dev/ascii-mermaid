local display = require("ascii-mermaid.display")

local M = {}

M.config = {
  auto = true,
  use_ascii = false,
  debounce_ms = 500,
  padding_x = 2,
  padding_y = 1,
  display_mode = "replace",
  hybrid_threshold = 15,
}

local debounce_timers = {}

local function debounced_render(bufnr)
  if debounce_timers[bufnr] then
    debounce_timers[bufnr]:stop()
  end
  debounce_timers[bufnr] = vim.defer_fn(function()
    debounce_timers[bufnr] = nil
    display.show(bufnr, M.config)
  end, M.config.debounce_ms)
end

function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})

  -- Check node is available
  if vim.fn.executable("node") ~= 1 then
    vim.notify("ascii-mermaid: node is not installed or not in PATH", vim.log.levels.ERROR)
    return
  end

  -- User commands
  vim.api.nvim_create_user_command("MermaidRender", function()
    display.toggle(vim.api.nvim_get_current_buf(), M.config)
  end, { desc = "Toggle mermaid ASCII rendering" })

  vim.api.nvim_create_user_command("MermaidRenderAll", function()
    display.clear(vim.api.nvim_get_current_buf())
    display.show(vim.api.nvim_get_current_buf(), M.config)
  end, { desc = "Force render all mermaid blocks" })

  vim.api.nvim_create_user_command("MermaidClear", function()
    display.clear(vim.api.nvim_get_current_buf())
  end, { desc = "Clear all rendered mermaid diagrams" })

  vim.api.nvim_create_user_command("MermaidStyle", function(args)
    local style = args.args
    if style ~= "ascii" and style ~= "unicode" then
      vim.notify("ascii-mermaid: invalid style '" .. style .. "' (use ascii or unicode)", vim.log.levels.ERROR)
      return
    end
    M.config.use_ascii = (style == "ascii")
    local bufnr = vim.api.nvim_get_current_buf()
    display.clear(bufnr)
    display.show(bufnr, M.config)
  end, {
    nargs = 1,
    complete = function()
      return { "ascii", "unicode" }
    end,
    desc = "Switch mermaid rendering style (ascii or unicode)",
  })

  vim.api.nvim_create_user_command("MermaidMode", function(args)
    local mode = args.args
    if mode ~= "inline" and mode ~= "replace" and mode ~= "hybrid" then
      vim.notify("ascii-mermaid: invalid mode '" .. mode .. "' (use inline, replace, or hybrid)", vim.log.levels.ERROR)
      return
    end
    M.config.display_mode = mode
    local bufnr = vim.api.nvim_get_current_buf()
    display.clear(bufnr)
    display.show(bufnr, M.config)
  end, {
    nargs = 1,
    complete = function()
      return { "inline", "replace", "hybrid" }
    end,
    desc = "Switch mermaid display mode",
  })

  -- Autocmds
  local group = vim.api.nvim_create_augroup("ascii_mermaid", { clear = true })

  if M.config.auto then
    vim.api.nvim_create_autocmd("BufEnter", {
      group = group,
      pattern = "*.md",
      callback = function(ev)
        display.show(ev.buf, M.config)
      end,
    })

    vim.api.nvim_create_autocmd({ "CursorHold", "CursorHoldI" }, {
      group = group,
      pattern = "*.md",
      callback = function(ev)
        debounced_render(ev.buf)
      end,
    })

    vim.api.nvim_create_autocmd("BufDelete", {
      group = group,
      callback = function(ev)
        if debounce_timers[ev.buf] then
          debounce_timers[ev.buf]:stop()
          debounce_timers[ev.buf] = nil
        end
      end,
    })
  end

  -- CursorMoved autocmd for replace/hybrid overlay toggle
  if M.config.display_mode == "replace" or M.config.display_mode == "hybrid" then
    vim.api.nvim_create_autocmd("CursorMoved", {
      group = group,
      pattern = "*.md",
      callback = function(ev)
        display.on_cursor_moved(ev.buf, M.config)
      end,
    })
  end
end

return M
