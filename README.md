<p align="center">
  <img src="assets/icon.png" width="160" height="160" alt="Nakshathram Logo">
</p>

<h1 align="center">Nakshathram</h1>

<p align="center">
  <strong>A premium, modern Manglish-to-Malayalam rich text editor built for the next generation of Malayali writers.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows-blueviolet.svg?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/license-ISC-green.svg?style=flat-square" alt="License">
</p>

---

## ✨ Features

### 💎 Premium Design
Experience a sleek, distraction-free writing environment. **Nakshathram** features a modern dark-themed interface with glassmorphism elements, custom titlebars, and smooth micro-animations.

### ✍️ Intelligent Transliteration
Type in Manglish and watch it transform into perfect Malayalam script instantly. Supported by the Varnam engine and intelligent auto-suggestions, it makes Malayalam typing feel natural and fast.

### 🧩 Modular Plugin System (`.star`)
The world's first (?) Manglish editor with an extensible plugin architecture. 
- **Spotify Integration**: Search and play music right in your sidebar while you write.
- **Cloud Sync**: Optional Google Drive integration for seamless file management.
- **Pluggable Architecture**: Add new features by simply dropping `.star` plugin files into the app.

### 📄 Rich Text Capabilities
Full control over your typography.
- Real-time font size adjustments.
- Standard bold, italic, and underline styling.
- Native file management with auto-saving and history.

### 🌍 Multi-language Support
Not just Malayalam! Easily toggle between English and a wide array of other Indian scripts directly from the floating status bar.

---

## 🚀 Getting Started

### Installation (Windows)
1. Download the latest **`Nakshathram Setup 1.0.0.exe`** from the [Releases](https://github.com/MindMatrix-07/Nakshathram/releases) page.
2. Run the installer and follow the on-screen instructions.
3. Launch **Nakshathram** from your desktop or start menu.

### Developer Setup
If you want to run the code locally:
```bash
# Clone the repository
git clone https://github.com/MindMatrix-07/Nakshathram.git

# Install dependencies
npm install

# Start the app
npm start
```

### Adding Plugins
To add a plugin (like Spotify or GDrive):
1. Open the **Plugins** menu in the sidebar.
2. Click **Add Plugin (.star file)**.
3. Select your `.star` file from your local storage.

---

## 🛠 Tech Stack
- **Framework**: Electron.js
- **Styling**: Vanilla CSS (Premium Dark Theme)
- **Engine**: Varnam (Integrated via API/Local logic)
- **Packaging**: Electron Builder

## 📜 License
This project is licensed under the ISC License.

---

<p align="center">
  Made with ❤️ for the Malayalam Community.
</p>
