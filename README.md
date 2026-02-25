# 🧩 ascii-mermaid - View Mermaid Diagrams Inside Neovim

[![Download ascii-mermaid](https://img.shields.io/badge/Download-ascii--mermaid-blue?style=for-the-badge)](https://github.com/yassin2dev/ascii-mermaid/releases)

---

## 📋 What is ascii-mermaid?

ascii-mermaid is a tool that works inside Neovim, a popular text editor. It takes Mermaid diagrams—simple text-based charts—and shows them as ASCII art right next to your code. ASCII art uses plain text characters to draw pictures, so you see the diagram without needing extra images or outside tools.

This plugin helps you:

- Understand flowcharts, sequence diagrams, and other Mermaid visuals directly in Neovim.
- Work without switching to a separate app or browser.
- Keep your diagrams and code side by side for easier editing and reviewing.

You do not need any special technical skills to try ascii-mermaid. This guide walks you through the simple steps to get it running.

## 🖥️ System Requirements

Before installing ascii-mermaid, make sure your computer meets these conditions:

- **Operating System:** Works on Windows, macOS, and Linux.
- **Neovim:** Version 0.5 or higher must be installed. This plugin depends on it.
- **Terminal:** Any terminal that supports Neovim and can display basic ASCII text.
- **Hardware:** Basic modern computer or laptop. No special hardware needed.
- **Internet Access:** Needed to download the plugin files.

If you do not have Neovim installed, you can find installation guides on the official Neovim website: https://neovim.io/

## 🚀 Getting Started

This section covers two main steps: downloading ascii-mermaid and running it in Neovim.

### Step 1: Download ascii-mermaid

You need to get the plugin files first. The best way to do this is by visiting the official releases page:

[**Go to ascii-mermaid Releases Page**](https://github.com/yassin2dev/ascii-mermaid/releases)

This page contains the latest plugin versions. Look for the latest release, download the recommended files, and save them on your computer.

### Step 2: Install the Plugin in Neovim

Once you have the files, you will add ascii-mermaid to Neovim. Follow these basic instructions: 

1. Open your terminal or command prompt.
2. If you use a Neovim plugin manager (like vim-plug, packer.nvim, or dein), add ascii-mermaid to your plugin list. For example, with vim-plug, add this line to your Neovim configuration file (usually `~/.config/nvim/init.vim`):

   ```
   Plug 'yassin2dev/ascii-mermaid'
   ```

3. Save the configuration file and launch Neovim.
4. Inside Neovim, run the plugin manager command to install plugins. For vim-plug, type:

   ```
   :PlugInstall
   ```

5. Wait until the installation finishes.

If you do not use a plugin manager, you can manually copy the plugin files to your Neovim plugin folder. Detailed instructions for manual installation are available inside the downloaded release package or the plugin’s GitHub README.

## 🔍 How to Use ascii-mermaid

After installation, you can start viewing Mermaid diagrams as ASCII art inside Neovim.

1. Open a file in Neovim that contains Mermaid code blocks. Mermaid code typically looks like this:

   ```
   ```mermaid
   graph TD;
     A-->B;
     B-->C;
   ```
   ```

2. Place your cursor inside the Mermaid code block.
3. ascii-mermaid will automatically render the diagram as ASCII art next to the code using Neovim’s virtual text feature. This means you see the chart right inside your editor without opening new windows.

If the diagrams do not show, make sure ascii-mermaid is enabled in your Neovim setup and your Neovim version supports virtual text.

## ⚙️ Common Settings and Tweaks

ascii-mermaid has a few options you can adjust in your Neovim configuration for better experience:

- **Refresh Rate:** Control how often the ASCII diagrams update when you edit Mermaid code.
- **Text Colors:** Change colors used for rendering ASCII art to match your color scheme.
- **Toggle Display:** Enable or disable the inline diagrams without uninstalling the plugin.

Example setting snippet to add in your Neovim config:

```vim
let g:ascii_mermaid_refresh_rate = 1000  " in milliseconds
let g:ascii_mermaid_text_color = 'Gray'
```

Check the plugin documentation for a full list of settings.

## 💡 Tips for Best Results

- Keep your Mermaid code blocks clean and well-structured. This helps ascii-mermaid render diagrams correctly.
- Use simple diagrams at first to get used to the plugin.
- Update your Neovim to the latest version for best compatibility.
- If you use different color schemes, adjust the ASCII art colors so diagrams remain readable.

## 🛠 Troubleshooting

If you face problems, try these steps:

- Verify that your Neovim version is 0.5 or above: run `nvim --version` in terminal.
- Make sure ascii-mermaid is installed correctly and listed in your active plugins.
- Restart Neovim after installation.
- Check your Neovim config file for any syntax errors.
- Look for error messages in Neovim when rendering diagrams and report them on the plugin’s GitHub issues page if needed.

## 📥 Download & Install

You can start using ascii-mermaid by visiting the official release page here:

[Download ascii-mermaid Releases](https://github.com/yassin2dev/ascii-mermaid/releases)

On this page, you will find the latest stable versions along with installation instructions.

Click the latest version to download the release assets. Follow the installation steps above to add the plugin to Neovim.

---

## 🤝 Need Help?

If you run into any problems or want to learn more about ascii-mermaid, check the GitHub repository's issues tab or discussions. The community and developers provide support and updates.

---

Thanks for choosing ascii-mermaid. It helps you work more smoothly with Mermaid diagrams inside your favorite editor.