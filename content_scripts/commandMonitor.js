// Twitch Command Monitor
// Monitors chat commands and triggers visual/audio alerts when they reach specified frequency

// Initialize command monitor (with protection against multiple executions)
(function () {
  "use strict";

  // Check if chat monitor already exists (permanent until page reload)
  if (
    window.twitchChatMonitor ||
    window.twitchChatMonitorExecuted ||
    document.getElementById("twitch-chat-monitor-executed")
  ) {
    console.log("Twitch Chat Monitor: Already executed in this tab");
    return;
  }

  // Mark as executed permanently (until page reload)
  window.twitchChatMonitorExecuted = true;

  // Create a hidden marker element as backup verification
  const marker = document.createElement("div");
  marker.id = "twitch-chat-monitor-executed";
  marker.style.display = "none";
  marker.setAttribute("data-executed", new Date().toISOString());
  document.body.appendChild(marker);

  class TwitchChatMonitor {
    constructor() {
      this.commandCooldowns = new Map(); // Track last detection time for each command
      this.commandHistory = []; // Store command detection history
      this.observer = null;
      this.chatContainer = null;
      this.isActive = false;
      this.cooldownMinutes = 10; // Cooldown time in minutes
      this.triggerCount = 3; // Number of times command must appear to trigger alert
      this.maxHistoryItems = 10; // Maximum items in history
      this.refreshInterval = null; // Periodic refresh interval
      this.isHistoryVisible = false; // Track history panel visibility
      this.uncopiedCommands = 0; // Count of commands not yet copied
      this.copiedCommands = new Set(); // Track which commands from history were copied
      this.neutralCommands = new Set(); // Track commands that became neutral (old commands)
      this.autoCloseAlert = 30; // Time in seconds to auto-close alert
      this.ignoredCommands = new Set(["!poke"]); // List of ignored commands
      this.latestMessageNode = null;
      this.debounceTimer = null;
      this.seenMessages = new WeakSet();
      this.debounceTimer = null;
      this.latestMessageLine = null;
      this.commandCounts = {}; // Added to store command counts
    }

    // Initialize the chat monitor
    init() {
      this.createMentionPulseAnimation();
      this.findChatElements();
      if (this.chatContainer) {
        this.startObserving();
        this.createToggleIcon(); // Create toggle icon
        console.log(`Twitch Chat Monitor: Initialized successfully`);
        console.log(
          `Twitch Chat Monitor: Configuration - Trigger: ${this.triggerCount} times, Cooldown: ${this.cooldownMinutes} minutes`
        );
      } else {
        console.log(
          "Twitch Chat Monitor: Chat container not found, retrying..."
        );
        setTimeout(() => this.init(), 2000);
      }
    }

    // Find chat container element
    findChatElements() {
      this.chatContainer = document.querySelector(
        '[data-test-selector="chat-scrollable-area__message-container"]'
      );
    }

    // Start observing chat for new messages
    startObserving() {
      if (this.observer) {
        this.observer.disconnect();
      }

      // Mark all existing messages as processed
      const existingMessages = this.chatContainer.querySelectorAll(
        '[data-a-target="chat-line-message-body"]'
      );
      console.log(
        `Twitch Chat Monitor: Marking ${existingMessages.length} existing messages as processed`
      );

      existingMessages.forEach((messageBody) => {
        messageBody.setAttribute("data-twitch-monitor-initial", "true");
      });

      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            // ✅ Garante que pegamos a linha completa da mensagem
            const messageLine = node.matches(
              '[data-a-target="chat-line-message"]'
            )
              ? node
              : node.querySelector('[data-a-target="chat-line-message"]');

            if (!messageLine) return;

            // ✅ Localiza o corpo da mensagem
            const messageBody = messageLine.querySelector(
              '[data-a-target="chat-line-message-body"]'
            );
            if (!messageBody || this.seenMessages.has(messageLine)) return;

            // 🔄 Guarda o mais recente e reinicia o timer
            this.latestMessageLine = messageLine;
            const finalBody = this.latestMessageLine.querySelector(
              '[data-a-target="chat-line-message-body"]'
            );
            const text = finalBody?.textContent?.trim();

            if (text && text.toLowerCase().includes("salazar016")) {
              this.highlightMentionMessage(messageLine);
            }

            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
              if (
                this.latestMessageLine &&
                !this.seenMessages.has(this.latestMessageLine) &&
                text
              ) {
                this.seenMessages.add(this.latestMessageLine);
                this.processNewMessage(this.latestMessageLine);
              }
            }, 150);
          });
        });
      });

      this.observer.observe(this.chatContainer, {
        childList: true,
      });

      this.isActive = true;

      // Set up periodic cleanup and refresh
      this.setupPeriodicRefresh();

      console.log("Twitch Chat Monitor: Started observing chat messages");
    }

    // Set up periodic refresh to clean expired cooldowns and update UI
    setupPeriodicRefresh() {
      // Clear any existing interval
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
      }

      // Set up new interval (every 30 seconds)
      this.refreshInterval = setInterval(() => {
        this.cleanExpiredCooldowns();
        // Only refresh visual timestamps if history panel is visible
        if (this.isHistoryVisible) {
          this.renderHistoryList();
        }
      }, 30000);
    }

    // Clean expired cooldowns and old marked messages
    cleanExpiredCooldowns() {
      const now = Date.now();
      const cooldownMs = this.cooldownMinutes * 60 * 1000;

      // Clean expired cooldowns
      for (const [command, timestamp] of this.commandCooldowns.entries()) {
        if (now - timestamp >= cooldownMs) {
          this.commandCooldowns.delete(command);
          console.log(
            `Twitch Chat Monitor: Cooldown expired for command "${command}"`
          );
        }
      }

      // Clean old marked messages
      const markedMessages = document.querySelectorAll(
        '[data-twitch-monitor-processed="true"]'
      );

      markedMessages.forEach((messageBody) => {
        try {
          // Try to find a timestamp in the message (Twitch usually has timestamps)
          const messageContainer = messageBody.closest(
            '[data-test-selector="chat-line-message"]'
          );
          if (messageContainer) {
            // If message is too old or no longer visible properly, remove our marker
            const rect = messageContainer.getBoundingClientRect();
            if (rect.height === 0) {
              messageBody.removeAttribute("data-twitch-monitor-processed");
            }
          }
        } catch (error) {
          // If any error accessing the message, remove marker
          messageBody.removeAttribute("data-twitch-monitor-processed");
        }
      });
    }

    // Process new chat message
    processNewMessage(messageNode) {
      try {
        // Check if this node contains a message body
        const messageBody = messageNode.querySelector(
          '[data-a-target="chat-line-message-body"]'
        );
        if (!messageBody) {
          return;
        }

        // Check if this message was already processed (marked) or is an initial message
        if (
          messageBody.hasAttribute("data-twitch-monitor-processed") ||
          messageBody.hasAttribute("data-twitch-monitor-initial")
        ) {
          return;
        }

        const messageText = messageBody.textContent.trim();
        if (!messageText) {
          return;
        }

        console.log(
          `Twitch Chat Monitor: [${new Date().toLocaleTimeString()}] Processing message:`,
          messageText
        );

        if (messageText.toLowerCase().includes("salazar016")) {
          this.highlightMentionMessage(messageBody);
          this.playMentionAlert();
          this.chromeAttentionMessage("You were mentioned!");

          // Mark this message as processed BEFORE handling
          messageBody.setAttribute("data-twitch-monitor-processed", "true");
          messageBody.setAttribute("data-monitor-id", Date.now().toString());

          return;
        }

        const command = this.extractCommand(messageText);
        if (command) {
          // Check if command is in the ignored list
          if (this.isIgnoredCommand(command)) {
            console.log(
              `Twitch Chat Monitor: Ignoring command "${command}" as it matches an ignored pattern`
            );
            return;
          }

          console.log(
            `Twitch Chat Monitor: New command detected: "${command}" from message: "${messageText}"`
          );

          // Mark this message as processed BEFORE handling
          messageBody.setAttribute("data-twitch-monitor-processed", "true");
          messageBody.setAttribute("data-monitor-id", Date.now().toString());

          // Handle the command
          this.handleCommand(command);
        }
      } catch (error) {
        console.error("Twitch Chat Monitor: Error processing message:", error);
      }
    }

    chromeAttentionMessage(command) {
      try {
        if (chrome?.runtime?.id) {
          chrome.runtime.sendMessage({
            action: "requestAttention",
            command,
          });
        }
      } catch (err) {
        console.warn(
          "Twitch Chat Monitor: Cannot send message to background (context may be invalidated)",
          err
        );
      }
    }

    // Play special audio alert for mentions
    playMentionAlert() {
      try {
        // Cria o AudioContext apenas uma vez (singleton)
        if (!this.mentionAudioContext) {
          this.mentionAudioContext = new (window.AudioContext ||
            window.webkitAudioContext)();
        }
        const audioContext = this.mentionAudioContext;

        // Create a more distinctive sound for mentions
        const createMentionSound = (
          frequency,
          duration,
          volume = 0.3,
          type = "sine"
        ) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.setValueAtTime(
            frequency,
            audioContext.currentTime
          );
          oscillator.type = type;

          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(
            volume,
            audioContext.currentTime + 0.01
          );
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + duration
          );

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        };

        // Play a distinct pattern for mentions - higher pitched and more urgent
        createMentionSound(880, 0.15, 0.3, "triangle");
        setTimeout(() => createMentionSound(880, 0.15, 0.3, "triangle"), 200);
        setTimeout(() => createMentionSound(1100, 0.3, 0.3, "triangle"), 400);
        setTimeout(() => createMentionSound(1320, 0.3, 0.3, "square"), 700);
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error playing mention alert:",
          error
        );
        // Fallback: try to play system notification sound
        try {
          const audio = new Audio("data:audio/beep");
          audio.play().catch(() => {
            console.log("Twitch Chat Monitor: Audio playback not available");
          });
        } catch (fallbackError) {
          console.log("Twitch Chat Monitor: Audio alerts not supported");
        }
      }
    }

    highlightMentionMessage(messageBody) {
      try {
        // Find the parent message container
        const messageContainer =
          messageBody.closest('[data-a-target="chat-line-message"]') ||
          messageBody.closest(".chat-line__message");

        if (messageContainer) {
          // Only adds the class that contains all styles and animations
          messageContainer.classList.add("mention-highlight");

          // Add a marker attribute to avoid re-processing
          messageContainer.setAttribute(
            "data-twitch-mention-highlighted",
            "true"
          );
        }
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error highlighting mention message:",
          error
        );
      }
    }

    createMentionPulseAnimation() {
      // Add pulsing animation with more vibrant colors
      const keyframesStyle = document.createElement("style");
      keyframesStyle.textContent = `
        .mention-highlight {
            border-radius: 4px !important;
            background-image: linear-gradient(-45deg,rgb(78, 8, 95), #e73c7e,rgb(162, 35, 213),rgb(68, 35, 213));
        }
      `;
      document.head.appendChild(keyframesStyle);
    }

    // Extract command from message (starts with "!" followed by word and optional parameters)
    extractCommand(messageText) {
      const commandRegex = /^!(\S+).*$/;
      const match = messageText.match(commandRegex);
      return match ? match[0].toLowerCase() : null; // Return full command including "!" and parameters
    }

    // Check if command should be ignored (exact match or starts with ignored command)
    isIgnoredCommand(command) {
      return Array.from(this.ignoredCommands).some(
        (ignoredCmd) =>
          command.toLowerCase() === ignoredCmd.toLowerCase() || // Exact match
          command.toLowerCase().startsWith(ignoredCmd.toLowerCase()) // Starts with ignored command
      );
    }

    // Handle command detection and auto-response
    handleCommand(command) {
      const now = Date.now();
      const lastTrigger = this.commandCooldowns.get(command);
      const cooldownMs = this.cooldownMinutes * 60 * 1000; // Convert minutes to milliseconds

      // Check if command is still in cooldown
      if (lastTrigger && now - lastTrigger < cooldownMs) {
        const remainingTime = Math.ceil(
          (cooldownMs - (now - lastTrigger)) / 1000 / 60
        );
        console.log(
          `Twitch Chat Monitor: Command "${command}" is in cooldown for ${remainingTime} more minute(s)`
        );
        return;
      }

      // Check if command is in the ignored list
      if (this.isIgnoredCommand(command)) {
        console.log(
          `Twitch Chat Monitor: Ignoring command "${command}" as it matches an ignored pattern`
        );
        return;
      }

      // Use the dictionary to get the count
      const commandCount = this.countCommand(command);
      console.log(
        `Twitch Chat Monitor: Command "${command}" total count: ${commandCount}/${this.triggerCount}`
      );

      // Check if we reached the trigger threshold
      if (commandCount >= this.triggerCount) {
        console.log(
          `Twitch Chat Monitor: Trigger reached for "${command}"! Activating alert`
        );

        // Set cooldown timestamp
        this.commandCooldowns.set(command, now);

        // Add to history
        this.addToHistory(command, now);

        // Send alert
        this.sendAlert(command);

        this.clearCommandCount(command);

        // Update notification area if visible
        if (this.isHistoryVisible) {
          this.updateNotificationArea();
        }
      }
    }

    // Count how many messages with this command are marked as processed
    countCommand(command) {
      this.commandCounts ??= {};
      this.commandCounts[command] = (this.commandCounts[command] ?? 0) + 1;
      return this.commandCounts[command];
    }

    clearCommandCount(command) {
      this.commandCounts[command] = 0;
    }
    // Show visual and audio alert for command
    sendAlert(command) {
      try {
        console.log(
          `Twitch Chat Monitor: Triggering alert for command: "${command}"`
        );

        // Show visual alert
        this.showVisualAlert(command);

        // Play audio alert
        this.playAudioAlert();

        // Flash browser tab
        this.flashBrowserTab(command);

        console.log(`Twitch Chat Monitor: Alert triggered for: "${command}"`);
      } catch (error) {
        console.error("Twitch Chat Monitor: Error triggering alert:", error);
      }
    }

    // Add command to history
    addToHistory(command, timestamp) {
      const historyItem = {
        command: command,
        timestamp: timestamp,
        time: new Date(timestamp).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        date: new Date(timestamp).toLocaleDateString("pt-BR"),
        id: `${command}-${timestamp}`, // Unique identifier for tracking copied status
      };

      // Add to beginning of array
      this.commandHistory.unshift(historyItem);

      // Keep only max items
      if (this.commandHistory.length > this.maxHistoryItems) {
        this.commandHistory = this.commandHistory.slice(
          0,
          this.maxHistoryItems
        );
      }

      // Increment uncopied commands counter
      this.uncopiedCommands++;
      this.updateToggleIndicator();

      console.log(
        `Twitch Chat Monitor: Added "${command}" to history at ${historyItem.time}`
      );
    }

    // Create toggle icon in top-left corner
    createToggleIcon() {
      try {
        // Remove existing icon if present
        const existingIcon = document.getElementById("twitch-history-toggle");
        if (existingIcon) {
          existingIcon.remove();
        }

        const toggleIcon = document.createElement("div");
        toggleIcon.id = "twitch-history-toggle";
        toggleIcon.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 10001;
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #9146ff, #6441a5);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(145, 70, 255, 0.4);
          transition: all 0.3s ease;
          font-size: 18px;
          user-select: none;
          position: relative;
        " title="Click to show/hide detected commands">
          📋
        </div>
      `;

        // Add hover effects via CSS
        if (!document.getElementById("toggle-icon-styles")) {
          const style = document.createElement("style");
          style.id = "toggle-icon-styles";
          style.textContent = `
          #twitch-history-toggle:hover > div {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(145, 70, 255, 0.6);
          }
          #twitch-history-toggle.active > div {
            background: linear-gradient(135deg, #00b894, #00a085);
            box-shadow: 0 4px 16px rgba(0, 184, 148, 0.4);
          }
        `;
          document.head.appendChild(style);
        }

        // Add click handler
        toggleIcon.addEventListener("click", () => {
          this.toggleHistoryPanel();
        });

        document.body.appendChild(toggleIcon);
        console.log("Twitch Chat Monitor: Toggle icon created");
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error creating toggle icon:",
          error
        );
      }
    }

    // Update toggle indicator to show uncopied commands count
    updateToggleIndicator() {
      try {
        const toggleIcon = document.getElementById("twitch-history-toggle");
        if (!toggleIcon) return;

        // Remove existing indicator
        const existingIndicator = toggleIcon.querySelector(
          ".uncopied-indicator"
        );
        if (existingIndicator) {
          existingIndicator.remove();
        }

        // Add indicator if there are uncopied commands
        if (this.uncopiedCommands > 0) {
          const indicator = document.createElement("div");
          indicator.className = "uncopied-indicator";
          indicator.innerHTML =
            this.uncopiedCommands > 9 ? "9+" : this.uncopiedCommands.toString();
          indicator.style.cssText = `
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ff4444;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          font-size: 11px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(255, 68, 68, 0.5);
          animation: pulse 2s infinite;
        `;

          toggleIcon.firstElementChild.appendChild(indicator);
        }
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error updating toggle indicator:",
          error
        );
      }
    }

    // Toggle history panel visibility
    toggleHistoryPanel() {
      try {
        const toggleIcon = document.getElementById("twitch-history-toggle");
        const notificationArea = document.getElementById(
          "twitch-command-history"
        );

        // If already animating out, don't do anything
        if (
          notificationArea &&
          notificationArea.dataset.animatingOut === "true"
        ) {
          return;
        }

        this.isHistoryVisible = !this.isHistoryVisible;

        if (this.isHistoryVisible) {
          // Show history panel
          this.updateNotificationArea();
          if (toggleIcon) {
            toggleIcon.classList.add("active");
          }

          console.log("Twitch Chat Monitor: History panel shown");
        } else {
          // Hide history panel
          if (notificationArea) {
            // Mark as animating out to prevent recreation
            notificationArea.dataset.animatingOut = "true";

            // Get the inner content div
            const contentDiv = notificationArea.querySelector("div");
            if (contentDiv) {
              // Apply animation to the content div
              contentDiv.style.animation = "slideOut 0.3s ease-in forwards";

              // Remove the entire notification area after animation
              contentDiv.addEventListener(
                "animationend",
                () => {
                  if (notificationArea.parentNode) {
                    notificationArea.remove();
                  }
                },
                { once: true }
              ); // Use once:true to ensure it only fires once
            } else {
              // Fallback if inner div not found
              notificationArea.remove();
            }
          }

          if (toggleIcon) {
            toggleIcon.classList.remove("active");
          }

          // Mark all current commands as neutral when panel is CLOSED
          this.commandHistory.forEach((item) => {
            this.neutralCommands.add(item.id);
          });
          this.uncopiedCommands = 0;
          this.copiedCommands.clear();
          this.updateToggleIndicator();

          console.log(
            "Twitch Chat Monitor: History panel hidden, all commands marked as neutral"
          );
        }
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error toggling history panel:",
          error
        );
      }
    }

    // Create or update notification area (only when visible)
    updateNotificationArea() {
      try {
        // Only create/update if supposed to be visible
        if (!this.isHistoryVisible) return;

        let notificationArea = document.getElementById(
          "twitch-command-history"
        );

        if (!notificationArea) {
          // Create notification area with slide-in animation
          notificationArea = document.createElement("div");
          notificationArea.id = "twitch-command-history";
          notificationArea.innerHTML = `
          <div style="
            position: fixed;
            top: 70px;
            left: 20px;
            z-index: 9999;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Inter', Arial, sans-serif;
            font-size: 12px;
            max-width: 300px;
            border: 1px solid rgba(145, 70, 255, 0.3);
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
          ">
            <div style="
              font-size: 14px; 
              font-weight: bold; 
              margin-bottom: 10px; 
              color: #9146ff;
              border-bottom: 1px solid rgba(145, 70, 255, 0.3);
              padding-bottom: 5px;
            ">
              📋 Commands Detected
            </div>
            <div id="command-history-list" style="max-height: 200px; overflow-y: auto; overflow-x: hidden;">
              <!-- History items will be inserted here -->
            </div>
          </div>
        `;

          // Add slide animations if not already added
          if (!document.getElementById("history-panel-styles")) {
            const style = document.createElement("style");
            style.id = "history-panel-styles";
            style.textContent = `
            @keyframes slideIn {
              0% { transform: translateX(-100%); opacity: 0; }
              100% { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
              0% { transform: translateX(0); opacity: 1; visibility: visible; }
              99% { transform: translateX(-100%); opacity: 0; visibility: visible; }
              100% { transform: translateX(-100%); opacity: 0; visibility: hidden; }
            }
            .history-item::after {
              content: '📋';
              opacity: 0;
              font-size: 10px;
              margin-left: 5px;
              transition: opacity 0.2s ease;
            }
            .history-item:hover::after {
              opacity: 0.6;
            }
          `;
            document.head.appendChild(style);
          }

          document.body.appendChild(notificationArea);
        }

        // Update history list
        this.renderHistoryList();
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error updating notification area:",
          error
        );
      }
    }

    // Render history list
    renderHistoryList() {
      try {
        const historyList = document.getElementById("command-history-list");
        if (!historyList) return;

        if (this.commandHistory.length === 0) {
          historyList.innerHTML =
            '<div style="opacity: 0.6; font-style: italic;">No commands detected yet</div>';
          return;
        }

        let historyHTML = "";
        this.commandHistory.forEach((item, index) => {
          const isRecent = Date.now() - item.timestamp < 60000; // Last minute
          const isCopied = this.copiedCommands.has(item.id);
          const isNeutral = this.neutralCommands.has(item.id);

          // Determine colors based on state
          let backgroundColor, borderColor, textColor;

          if (isCopied) {
            // Green for copied commands
            backgroundColor = "rgba(0, 184, 148, 0.15)";
            borderColor = "rgba(0, 184, 148, 0.3)";
            textColor = "#00b894";
          } else if (isNeutral) {
            // Gray for neutral commands
            backgroundColor = "rgba(255, 255, 255, 0.05)";
            borderColor = "rgba(255, 255, 255, 0.2)";
            textColor = "#ffffff";
          } else {
            // Red for not copied commands
            backgroundColor = "rgba(255, 68, 68, 0.15)";
            borderColor = "rgba(255, 68, 68, 0.3)";
            textColor = "#ff4444";
          }

          historyHTML += `
          <div class="history-item" data-command="${item.command}" data-id="${
            item.id
          }" style="
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            padding: 6px 8px;
            margin: 3px 0;
            background: ${backgroundColor};
            border: 1px solid ${borderColor};
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 11px;
          " title="Click to copy: ${item.command}">
            <div style="
              font-weight: bold; 
              color: ${textColor};
              flex: 1;
            ">${item.command}</div>
            <div style="
              font-size: 10px; 
              opacity: 0.7; 
              color: ${textColor};
              min-width: 45px;
              text-align: right;
            ">${item.time}</div>
            ${
              isRecent
                ? '<div style="width: 8px; height: 8px; background: #00f5ff; border-radius: 50%; margin-left: 5px; box-shadow: 0 0 4px #00f5ff;"></div>'
                : ""
            }
          </div>
        `;
        });

        historyList.innerHTML = historyHTML;

        // Add click listeners to history items
        this.addHistoryItemListeners();
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error rendering history list:",
          error
        );
      }
    }

    // Add click listeners to history items for copying
    addHistoryItemListeners() {
      try {
        const historyItems = document.querySelectorAll(".history-item");

        historyItems.forEach((item) => {
          item.addEventListener("click", (e) => {
            const command = item.getAttribute("data-command");
            if (command) {
              this.copyCommandFromHistory(command, item);
            }
          });

          // Store original colors for hover effects
          const originalBackground = item.style.background;
          const originalBorder = item.style.borderColor || item.style.border;

          // Add hover effects
          item.addEventListener("mouseenter", () => {
            item.style.transform = "scale(1.02)";
            // Brighten the existing background slightly on hover
            if (item.style.background.includes("0, 184, 148")) {
              // Green (copied) - make brighter green
              item.style.background = "rgba(0, 184, 148, 0.25)";
            } else if (item.style.background.includes("255, 68, 68")) {
              // Red (not copied) - make brighter red
              item.style.background = "rgba(255, 68, 68, 0.25)";
            } else {
              // Neutral - make brighter white
              item.style.background = "rgba(255, 255, 255, 0.1)";
            }
          });

          item.addEventListener("mouseleave", () => {
            item.style.transform = "scale(1)";
            item.style.background = originalBackground;
          });
        });
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error adding history item listeners:",
          error
        );
      }
    }

    // Copy command from history
    async copyCommandFromHistory(command, itemElement) {
      try {
        const itemId = itemElement.getAttribute("data-id");

        // Use modern Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(command);
          console.log(
            `Twitch Chat Monitor: Command "${command}" copied from history`
          );
        } else {
          // Fallback for older browsers
          const textArea = document.createElement("textarea");
          textArea.value = command;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand("copy");
          textArea.remove();
          console.log(
            `Twitch Chat Monitor: Command "${command}" copied from history (fallback)`
          );
        }

        // Mark this specific command as copied
        if (itemId) {
          this.copiedCommands.add(itemId);
        }

        // Decrement uncopied counter
        if (this.uncopiedCommands > 0) {
          this.uncopiedCommands--;
          this.updateToggleIndicator();
        }

        // Show visual feedback on the item
        this.showHistoryItemFeedback(itemElement, command);

        // Re-render the list to update colors
        setTimeout(() => {
          this.renderHistoryList();
        }, 1100); // After feedback animation
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error copying command from history:",
          error
        );
        this.showHistoryItemError(itemElement);
      }
    }

    // Show visual feedback when history item is copied
    showHistoryItemFeedback(itemElement, command) {
      try {
        // Flash green and show checkmark with immediate white text
        itemElement.style.background =
          "linear-gradient(135deg, #00b894, #00a085)";

        // Add checkmark temporarily with white text immediately
        const commandDiv = itemElement.querySelector("div");
        if (commandDiv) {
          const originalText = commandDiv.innerHTML;
          commandDiv.innerHTML = `✔ ${originalText} - Copied!`;
          commandDiv.style.color = "#ffffff"; // Force white color immediately
        }

        // Change timestamp text color to white
        const timestampDiv = itemElement.querySelector("div:nth-child(2)");
        if (timestampDiv) {
          timestampDiv.style.color = "#ffffff";
        }

        // Revert after 1 second
        setTimeout(() => {
          commandDiv.innerHTML = originalText;
        }, 1000);
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error showing history item feedback: ",
          error
        );
      }
    }

    // Show error feedback for history item
    showHistoryItemError(itemElement) {
      try {
        const originalBackground = itemElement.style.background;

        // Flash red
        itemElement.style.background =
          "linear-gradient(135deg, #e74c3c, #c0392b)";
        itemElement.style.transform = "scale(1.02)";

        // Revert after 500ms
        setTimeout(() => {
          itemElement.style.background = originalBackground;
          itemElement.style.transform = "scale(1)";
        }, 500);
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error showing history item error:",
          error
        );
      }
    }

    // Show visual alert overlay
    showVisualAlert(command) {
      try {
        // Remove any existing alert
        const existingAlert = document.getElementById("twitch-chat-alert");
        if (existingAlert) {
          existingAlert.remove();
        }

        // Create alert overlay
        const alertOverlay = document.createElement("div");
        alertOverlay.id = "twitch-chat-alert";
        alertOverlay.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          background: linear-gradient(135deg, #9146ff, #6441a5);
          color: white;
          padding: 20px 30px;
          border-radius: 10px;
          box-shadow: 0 8px 32px rgba(145, 70, 255, 0.3);
          font-family: 'Inter', Arial, sans-serif;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          border: 2px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          width: 280px;
          min-height: 200px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        ">
          <div style="margin-bottom: 10px; font-size: 24px;">🎯</div>
          <div>Command Detected!</div>
          <div style="
            font-size: 24px; 
            margin: 10px 0; 
            color: #00f5ff;
            text-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
            word-break: break-all;
            max-width: 100%;
            padding: 0 10px;
          ">${command}</div>
          <div style="font-size: 14px; opacity: 0.8;">${this.triggerCount} ${
          this.triggerCount === 1 ? "time" : "times"
        } in chat</div>
          <div style="
            font-size: 12px; 
            opacity: 0.6; 
            margin-top: 8px; 
            border-top: 1px solid rgba(255,255,255,0.2); 
            padding-top: 8px;
            width: 100%;
          ">👆 Click to copy</div>
        </div>
      `;

        // Add CSS animations
        if (!document.getElementById("twitch-alert-styles")) {
          const style = document.createElement("style");
          style.id = "twitch-alert-styles";
          style.textContent = `
          @keyframes slideInBounce {
            0% { transform: translateX(100%) scale(0.8); opacity: 0; }
            60% { transform: translateX(-10px) scale(1.05); opacity: 1; }
            100% { transform: translateX(0) scale(1); opacity: 1; }
          }
          @keyframes slideOutAlert {
            0% { transform: translateX(0) scale(1.02); opacity: 1; }
            100% { transform: translateX(100%) scale(0.8); opacity: 0; }
          }
          @keyframes pulse {
            0% { transform: scale(1); }
      
            50% { transform: scale(1.04); }
       
            100% { transform: scale(1); }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          @keyframes fadeInScale {
            0% { opacity: 0.7; transform: scale(1); }
            100% { opacity: 1; transform: scale(1.02); }
          }
          #twitch-chat-alert:hover {
            box-shadow: 0 12px 48px rgba(145, 70, 255, 0.4);
            transition: box-shadow 0.2s ease;
          }
          
          /* Classe para o estado inicial do alerta */
          .alert-enter {
            animation: slideInBounce 0.6s ease-out, pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            transform-origin: center;
          }
          
          /* Classe para o estado de saída do alerta */
          .alert-exit {
            animation: slideOutAlert 0.3s ease-in forwards !important;
            transform-origin: center;
          }
        `;
          document.head.appendChild(style);
        }

        // Add to page
        document.body.appendChild(alertOverlay);

        // Store timeout reference for potential cancellation
        const autoRemoveTimeout = setTimeout(() => {
          if (alertOverlay && alertOverlay.parentNode) {
            const contentDiv = alertOverlay.querySelector("div");
            if (contentDiv) {
              // Remove pulsing animation and add exit animation
              contentDiv.classList.remove("alert-enter");
              contentDiv.classList.add("alert-exit");

              // Remove element after animation ends
              contentDiv.addEventListener(
                "animationend",
                () => {
                  if (alertOverlay.parentNode) {
                    alertOverlay.remove();
                  }
                },
                { once: true }
              );
            } else {
              alertOverlay.remove();
            }
          }
        }, this.autoCloseAlert * 1000);

        // Add initial class for entry animations
        const contentDiv = alertOverlay.querySelector("div");
        if (contentDiv) {
          contentDiv.classList.add("alert-enter");
        }

        // Add click functionality to copy command to clipboard
        alertOverlay.addEventListener("click", () => {
          // Cancel the auto-remove timeout since we're closing manually after copy
          clearTimeout(autoRemoveTimeout);
          this.copyToClipboard(command, alertOverlay);
        });

        // Add hover effect
        alertOverlay.style.cursor = "pointer";
        alertOverlay.title = "Click to copy the command";
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error showing visual alert:",
          error
        );
      }
    }

    // Copy command to clipboard
    async copyToClipboard(command, alertElement) {
      try {
        // Use modern Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(command);
          console.log(
            `Twitch Chat Monitor: Command "${command}" copied to clipboard`
          );
        } else {
          // Fallback for older browsers
          const textArea = document.createElement("textarea");
          textArea.value = command;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand("copy");
          textArea.remove();
          console.log(
            `Twitch Chat Monitor: Command "${command}" copied to clipboard (fallback)`
          );
        }

        // Mark command as copied (decrement uncopied counter)
        if (this.uncopiedCommands > 0) {
          this.uncopiedCommands--;
          this.updateToggleIndicator();
        }

        // Find and mark the command as copied in history
        const historyItem = this.commandHistory.find(
          (item) => item.command === command
        );
        if (historyItem) {
          this.copiedCommands.add(historyItem.id);
          // Re-render the history list immediately if it's visible
          if (this.isHistoryVisible) {
            this.renderHistoryList();
          }
        }

        // Show visual feedback
        this.showCopyFeedback(alertElement, command);
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error copying to clipboard:",
          error
        );
        this.showCopyError(alertElement);
      }
    }

    // Show visual feedback when command is copied
    showCopyFeedback(alertElement, command) {
      try {
        // Get the content div
        const contentDiv = alertElement.querySelector("div");
        if (!contentDiv) {
          alertElement.remove();
          return;
        }

        // Remove entrada e pulsar
        contentDiv.classList.remove("alert-enter");

        // Preserve original styles while updating content
        const originalStyles = contentDiv.getAttribute("style");

        // Change content to show success
        contentDiv.innerHTML = `
        <div style="margin-bottom: 10px; font-size: 24px;">✅</div>
        <div>Copied!</div>
        <div style="
          font-size: 20px; 
          margin: 10px 0; 
          color: #ffffff;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
          word-break: break-all;
          max-width: 100%;
          padding: 0 10px;
        ">${command}</div>
        <div style="font-size: 14px; opacity: 0.8;">Ready to paste (Ctrl+V)</div>
      `;

        // Restore original styles and update colors
        contentDiv.setAttribute("style", originalStyles);
        contentDiv.style.background =
          "linear-gradient(135deg, #00b894, #00a085)";
        contentDiv.style.boxShadow = "0 8px 32px rgba(0, 184, 148, 0.3)";

        // Apply fade-in animation for the success state
        contentDiv.style.animation = "fadeInScale 0.3s ease-out";

        // Close alert after showing success feedback (1.5 seconds)
        setTimeout(() => {
          if (alertElement && alertElement.parentNode) {
            // Add exit animation
            contentDiv.classList.add("alert-exit");

            // Remove element after animation ends
            contentDiv.addEventListener(
              "animationend",
              () => {
                if (alertElement.parentNode) {
                  alertElement.remove();
                }
              },
              { once: true }
            );
          }
        }, 1500);
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error showing copy feedback:",
          error
        );
        if (alertElement && alertElement.parentNode) {
          alertElement.remove();
        }
      }
    }

    // Show error feedback if copy fails
    showCopyError(alertElement) {
      try {
        const originalContent = alertElement.innerHTML;

        // Change content to show error
        alertElement.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          color: white;
          padding: 20px 30px;
          border-radius: 10px;
          box-shadow: 0 8px 32px rgba(231, 76, 60, 0.3);
          font-family: 'Inter', Arial, sans-serif;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          animation: shake 0.5s ease-out;
          border: 2px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          min-width: 200px;
        ">
          <div style="margin-bottom: 10px; font-size: 24px;">❌</div>
          <div>Error copying</div>
          <div style="font-size: 14px; opacity: 0.8; margin-top: 10px;">Try again</div>
        </div>
      `;

        // Revert back to original after 2 seconds
        setTimeout(() => {
          if (alertElement && alertElement.parentNode) {
            alertElement.innerHTML = originalContent;
          }
        }, 2000);
      } catch (error) {
        console.error("Twitch Chat Monitor: Error showing copy error:", error);
      }
    }

    // Play audio alert
    playAudioAlert() {
      try {
        // Create and play notification sound
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();

        // Create beep sound
        const createBeep = (frequency, duration, volume = 0.3) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.setValueAtTime(
            frequency,
            audioContext.currentTime
          );
          oscillator.type = "sine";

          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(
            volume,
            audioContext.currentTime + 0.01
          );
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + duration
          );

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        };

        // Play three ascending beeps
        createBeep(800, 0.2, 0.3);
        setTimeout(() => createBeep(1000, 0.2, 0.3), 150);
        setTimeout(() => createBeep(1200, 0.3, 0.3), 300);
      } catch (error) {
        console.error("Twitch Chat Monitor: Error playing audio alert:", error);
        // Fallback: try to play system notification sound
        try {
          const audio = new Audio("data:audio/beep");
          audio.play().catch(() => {
            console.log("Twitch Chat Monitor: Audio playback not available");
          });
        } catch (fallbackError) {
          console.log("Twitch Chat Monitor: Audio alerts not supported");
        }
      }
    }

    // Flash browser tab
    flashBrowserTab(command) {
      try {
        const originalTitle = document.title;
        let flashCount = 0;
        const maxFlashes = 6;

        // Request tab attention using Chrome API
        this.chromeAttentionMessage(command);

        const flashInterval = setInterval(() => {
          if (flashCount >= maxFlashes) {
            document.title = originalTitle;
            clearInterval(flashInterval);
            return;
          }

          document.title =
            flashCount % 2 === 0
              ? `🔔 ${command} - Command Detected!`
              : originalTitle;

          flashCount++;
        }, 500);

        // Also flash the favicon if possible
        this.flashFavicon();
      } catch (error) {
        console.error(
          "Twitch Chat Monitor: Error flashing browser tab:",
          error
        );
      }
    }

    // Flash favicon
    flashFavicon() {
      try {
        const originalFavicon = document.querySelector('link[rel="icon"]');
        if (!originalFavicon) return;

        const originalHref = originalFavicon.href;

        // Create notification favicon (red dot)
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");

        // Draw red circle
        ctx.fillStyle = "#ff4444";
        ctx.beginPath();
        ctx.arc(16, 16, 14, 0, 2 * Math.PI);
        ctx.fill();

        // Draw exclamation mark
        ctx.fillStyle = "white";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("!", 16, 22);

        const notificationFavicon = canvas.toDataURL();

        // Flash favicon
        let flashCount = 0;
        const flashInterval = setInterval(() => {
          if (flashCount >= 6) {
            originalFavicon.href = originalHref;
            clearInterval(flashInterval);
            return;
          }

          originalFavicon.href =
            flashCount % 2 === 0 ? notificationFavicon : originalHref;
          flashCount++;
        }, 500);
      } catch (error) {
        console.error("Twitch Chat Monitor: Error flashing favicon:", error);
      }
    }

    // Stop observing (cleanup)
    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      // Clear refresh interval
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }

      this.isActive = false;
      this.isHistoryVisible = false;
      this.uncopiedCommands = 0;
      this.copiedCommands.clear();
      this.neutralCommands.clear();
      this.commandCooldowns.clear();
      this.commandHistory = [];

      // Remove notification area
      const notificationArea = document.getElementById(
        "twitch-command-history"
      );
      if (notificationArea) {
        notificationArea.remove();
      }

      // Remove toggle icon
      const toggleIcon = document.getElementById("twitch-history-toggle");
      if (toggleIcon) {
        toggleIcon.remove();
      }

      console.log("Twitch Chat Monitor: Stopped observing");
    }

    // Set trigger count (how many times command must appear to trigger alert)
    setTriggerCount(count) {
      if (typeof count === "number" && count >= 1 && count <= 10) {
        this.triggerCount = Math.floor(count);
        console.log(
          `Twitch Chat Monitor: Trigger count set to ${this.triggerCount}`
        );
        return true;
      } else {
        console.error(
          "Twitch Chat Monitor: Invalid trigger count. Must be a number between 1 and 10."
        );
        return false;
      }
    }

    // Set cooldown time in minutes
    setCooldownMinutes(minutes) {
      if (typeof minutes === "number" && minutes >= 1 && minutes <= 60) {
        this.cooldownMinutes = Math.floor(minutes);
        console.log(
          `Twitch Chat Monitor: Cooldown time set to ${this.cooldownMinutes} minutes`
        );
        return true;
      } else {
        console.error(
          "Twitch Chat Monitor: Invalid cooldown time. Must be a number between 1 and 60 minutes."
        );
        return false;
      }
    }

    // Get current status
    getStatus() {
      const markedMessages = document.querySelectorAll(
        '[data-twitch-monitor-processed="true"]'
      );
      const initialMessages = document.querySelectorAll(
        '[data-twitch-monitor-initial="true"]'
      );
      const chatMessages = document.querySelectorAll(
        '[data-a-target="chat-line-message"]'
      );

      const status = {
        monitor: {
          isActive: this.isActive,
          isHistoryVisible: this.isHistoryVisible,
          uncopiedCommands: this.uncopiedCommands,
        },
        config: {
          triggerCount: this.triggerCount,
          cooldownMinutes: this.cooldownMinutes,
          maxHistoryItems: this.maxHistoryItems,
          autoCloseAlert: this.autoCloseAlert,
        },
        commands: {
          cooldowns: Object.fromEntries(this.commandCooldowns),
          history: this.commandHistory,
          copied: Array.from(this.copiedCommands),
          neutral: Array.from(this.neutralCommands),
        },
        chat: {
          container: !!this.chatContainer,
          totalMessages: chatMessages.length,
          markedMessages: markedMessages.length,
          initialMessages: initialMessages.length,
          processedCommands: this.getMarkedMessages(),
        },
      };

      console.group("📊 Twitch Chat Monitor Status");

      console.log("\n📌 Monitor State:");
      console.table({
        Active: status.monitor.isActive,
        "History Panel Visible": status.monitor.isHistoryVisible,
        "Uncopied Commands": status.monitor.uncopiedCommands,
      });

      console.log("\n⚙️ Configuration:");
      console.table({
        "Trigger Count": status.config.triggerCount,
        "Cooldown (minutes)": status.config.cooldownMinutes,
        "Max History Items": status.config.maxHistoryItems,
        "Auto Close Alert (seconds)": status.config.autoCloseAlert,
      });

      console.log("\n💬 Chat Statistics:");
      console.table({
        "Chat Container Found": status.chat.container,
        "Total Messages": status.chat.totalMessages,
        "Marked Messages": status.chat.markedMessages,
        "Initial Messages": status.chat.initialMessages,
      });

      if (status.commands.history.length > 0) {
        console.log("\n📜 Command History:");
        console.table(
          status.commands.history.map((item) => ({
            Command: item.command,
            Time: item.time,
            Date: item.date,
            Copied: this.copiedCommands.has(item.id),
            Neutral: this.neutralCommands.has(item.id),
          }))
        );
      }

      if (Object.keys(status.commands.cooldowns).length > 0) {
        console.log("\n⏳ Active Cooldowns:");
        const now = Date.now();
        console.table(
          Object.entries(status.commands.cooldowns).map(
            ([command, timestamp]) => ({
              Command: command,
              "Started At": new Date(timestamp).toLocaleTimeString(),
              "Remaining (min)": Math.ceil(
                (this.cooldownMinutes * 60 * 1000 - (now - timestamp)) /
                  (60 * 1000)
              ),
            })
          )
        );
      }

      if (status.chat.processedCommands.length > 0) {
        console.log("\n🔍 Last Processed Commands:");
        console.table(status.chat.processedCommands);
      }

      console.groupEnd();

      return status;
    }

    // Debug function to see all marked messages
    getMarkedMessages() {
      const markedMessages = document.querySelectorAll(
        '[data-a-target="chat-line-message-body"][data-twitch-monitor-processed="true"]:not([data-twitch-monitor-initial])'
      );
      const messages = [];

      markedMessages.forEach((messageBody) => {
        const messageText = messageBody.textContent.trim();
        const command = this.extractCommand(messageText);
        messages.push({
          text: messageText,
          command: command,
          isCommand: !!command,
        });
      });

      console.log("All marked messages:", messages);
      return messages;
    }

    // Add command to ignored list
    addIgnoredCommand(command) {
      if (command && typeof command === "string") {
        this.ignoredCommands.add(command);
        console.log(
          `Twitch Chat Monitor: Added "${command}" to ignored commands list`
        );
        return true;
      }
      return false;
    }

    // Remove command from ignored list
    removeIgnoredCommand(command) {
      if (command && typeof command === "string") {
        const removed = this.ignoredCommands.delete(command);
        if (removed) {
          console.log(
            `Twitch Chat Monitor: Removed "${command}" from ignored commands list`
          );
        }
        return removed;
      }
      return false;
    }

    // Get list of ignored commands
    getIgnoredCommands() {
      return Array.from(this.ignoredCommands);
    }
  }
  // Initialize command monitor
  const twitchChatMonitor = new TwitchChatMonitor();

  // Start monitoring when page is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => twitchChatMonitor.init(), 1750);
    });
  } else {
    setTimeout(() => twitchChatMonitor.init(), 1750);
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    twitchChatMonitor.stop();
    delete window.twitchChatMonitorExecuted;
  });

  // Expose to global scope for debugging
  window.twitchChatMonitor = twitchChatMonitor;
})();
