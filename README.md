# 🧹 Twitch Chat Overlay Cleaner

A lightweight Chrome extension that removes overlays blocking Twitch chat visualization and adds smart navigation features. It cleans problematic elements on all Twitch pages and provides a "View Stream" button in chat popups for seamless navigation between chat and stream views.

## 🚀 Features

- **One-Click Cleaning**: Remove chat overlays with a single click
- **Smart Navigation**: Adds "View Stream" button in chat popups for easy navigation
- **Multi-Tab Support**: Automatically detects and processes all open Twitch tabs
- **Visual Feedback**: Badge counter shows how many tabs were processed
- **Lightweight**: Minimal resource usage with optimized selectors
- **Modular Design**: Separate scripts for different functionalities
- **Non-Intrusive**: Only affects Twitch.tv pages and doesn't store any data

## 📦 Installation

### From Chrome Web Store (Recommended)
*Coming soon - Extension will be published to Chrome Web Store*

### Manual Installation (Developer Mode)

1. **Download the Extension**
   ```bash
   git clone https://github.com/AirtonSerra/twitch-chat-overlay-cleaner.git
   ```
   Or download as ZIP and extract

2. **Enable Developer Mode**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the extension folder
   - The extension icon should appear in your toolbar

## 🎯 Usage

1. **Open Twitch**: Navigate to any Twitch stream or chat popup
2. **Click the Extension**: Click the 🧹 icon in your Chrome toolbar
3. **Watch the Magic**: 
   - Chat overlays will be removed instantly on all Twitch pages
   - A "View Stream" button will be added in chat popups for easy navigation
4. **Multi-Tab Support**: The extension automatically works on all open Twitch tabs

### Specific Behaviors
- **Regular Twitch Pages**: Only removes overlay elements
- **Chat Popups**: Removes overlays + adds "View Stream" button to navigate to main stream page

### Visual Feedback
- **Green Badge with Number**: Shows successful processing on X tabs (overlays removed + buttons added where applicable)
- **Gray Badge with "0"**: No Twitch tabs found
- **Red Badge with "!"**: Error occurred during processing

## 🛠️ Technical Details

### Files Structure
```
twitch-chat-overlay-cleaner/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for tab management
├── remover.js            # Content script for overlay removal
├── viewStreamButton.js   # Content script for navigation button in chat popups
└── README.md             # This file
```

### Targeted Elements (`remover.js`)
The extension removes the following problematic elements on all Twitch pages:
- `.chat-room__content div.Layout-sc-1xcs6mc-0`
- `.stream-chat-header`
- `.community-highlight-stack__card--wide`

### Added Elements (`viewStreamButton.js`)
The extension adds navigation elements specifically in chat popups:
- **"View Stream" Button**: Injected into `.Layout-sc-1xcs6mc-0.lnazSn` container
- **Purpose**: Navigate from chat popup to main stream page
- **Scope**: Only active in chat popup URLs (`/popout/.../chat`)

### Permissions
- `scripting`: Execute content scripts on Twitch pages
- `activeTab`: Access the current active tab
- `tabs`: Query and manage browser tabs
- `host_permissions`: Limited to `https://www.twitch.tv/*`

## 🔧 Development

### Prerequisites
- Google Chrome or Chromium-based browser
- Basic knowledge of JavaScript and Chrome Extensions API

### Making Changes

1. **Modify Overlay Removal** (`remover.js`)
   - Add new selectors to target additional overlay elements
   - Test on various Twitch streams and layouts

2. **Modify Navigation Features** (`viewStreamButton.js`)
   - Update button styling or functionality
   - Modify URL parsing logic for different popup formats
   - Test specifically on chat popup pages

3. **Update Background Script** (`background.js`)
   - Modify tab detection logic
   - Add or remove content scripts from execution
   - Add new features like scheduling or custom preferences

4. **Testing**
   - Load the extension in developer mode
   - Test on both regular Twitch pages and chat popups
   - Check browser console for errors from both scripts

### Adding New Selectors

To target additional overlay elements:

```javascript
// In remover.js, add new selectors to the array
const selectors = [
  ".chat-room__content div.Layout-sc-1xcs6mc-0",
  ".stream-chat-header", 
  ".community-highlight-stack__card--wide",
  ".your-new-selector-here"  // Add new selectors here
];
```

### Adding New Navigation Elements

To inject additional UI elements in chat popups:

```javascript
// In viewStreamButton.js, create a new function similar to addViewStreamButton()
function addNewNavigationElement() {
  const currentUrl = window.location.href;
  
  // Only add if in chat popup
  if (currentUrl.includes('/popout/') && currentUrl.includes('/chat')) {
    const targetContainer = document.querySelector('.your-target-selector');
    
    if (targetContainer && !targetContainer.querySelector('.your-element-check')) {
      const elementHTML = `<div>Your HTML content here</div>`;
      targetContainer.insertAdjacentHTML('beforeend', elementHTML);
    }
  }
}
```

### Script Execution

Both scripts run simultaneously when the extension is activated:

1. **`remover.js`** (Universal)
   - Executes on ALL Twitch pages
   - Removes problematic overlay elements
   - Provides console feedback

2. **`viewStreamButton.js`** (Conditional)
   - Only executes functionality in chat popup URLs
   - Detects popup format: `/popout/[streamer]/chat`
   - Extracts streamer name and creates navigation URL
   - Adds "View Stream" button with click handler

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the Repository**
2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make Your Changes**
4. **Test Thoroughly**
5. **Commit Your Changes**
   ```bash
   git commit -m "Add amazing feature"
   ```
6. **Push to Branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Reporting Issues

Found a bug or have a suggestion? Please:
1. Check existing issues first
2. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Browser version and OS
   - Screenshots if applicable

## 📋 Browser Support

- ✅ Google Chrome (Manifest V3)
- ✅ Microsoft Edge (Chromium-based)
- ✅ Opera (Chromium-based)
- ✅ Brave Browser
- ❌ Firefox (Manifest V2 - different implementation needed)

## 🔒 Privacy

This extension:
- ✅ Does **NOT** collect any personal data
- ✅ Does **NOT** track user behavior
- ✅ Only operates on Twitch.tv domains
- ✅ No network requests or data transmission
- ✅ All processing happens locally in your browser

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Twitch community for feedback and testing
- Chrome Extension API documentation
- Open source community for inspiration

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/twitch-chat-overlay-cleaner/issues)
- **Email**: your-email@example.com
- **Discord**: YourUsername#1234

---

⭐ **Star this repository** if you find it helpful!

Made with ❤️ for the Twitch community 