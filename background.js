// Global state to control execution
let isEnabled = false;

// Function to get monitor status
async function getMonitorStatus() {
  try {
    const allTabs = await chrome.tabs.query({});
    const twitchTabs = allTabs.filter(tab => tab.url && tab.url.includes('twitch.tv'));
    const popoutTabs = twitchTabs.filter(tab => isTwitchPopoutChat(tab.url));
    
    const status = {
      isEnabled,
      storedState: await chrome.storage.local.get('isEnabled'),
      extensionId: chrome.runtime.id,
      activeTabs: {
        total: allTabs.length,
        twitch: twitchTabs.length,
        popoutChat: popoutTabs.length,
        popoutChatTabs: popoutTabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          status: tab.status
        }))
      }
    };
    
    console.table({
      'Extension Enabled': status.isEnabled,
      'Stored State': status.storedState.isEnabled,
      'Extension ID': status.extensionId,
      'Total Tabs': status.activeTabs.total,
      'Twitch Tabs': status.activeTabs.twitch,
      'Popout Chat Tabs': status.activeTabs.popoutChat
    });
    
    if (status.activeTabs.popoutChatTabs.length > 0) {
      console.log('\nPopout Chat Tabs Details:');
      console.table(status.activeTabs.popoutChatTabs);
    }
    
    return status;
  } catch (error) {
    console.error('[Service Worker] Error getting monitor status:', error);
    return null;
  }
}

// Make status function available globally for service worker
globalThis.getMonitorStatus = getMonitorStatus;

// Initialize extension state
async function initializeExtension() {
  try {
    // Get saved state, default to enabled
    const result = await chrome.storage.local.get('isEnabled');
    isEnabled = result.isEnabled !== undefined ? result.isEnabled : true;
    
    if (isEnabled) {
      await startMonitoring();
    } else {
      await stopMonitoring();
    }
  } catch (error) {
    console.error('[Service Worker] Error initializing extension:', error);
  }
}

// Function to execute scripts in a Twitch tab
async function executeScripts(tabId) {
  try {
    // First inject and execute the load checker script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return new Promise((resolve) => {
          const wait = () => {
            console.log('Page fully loaded or timeout reached.');
            resolve();
          };

          if (document.readyState === 'complete') {
            console.log('Page already in complete state.');
            wait();
          } else {
            let resolved = false;

            window.addEventListener('load', () => {
              if (!resolved) {
                resolved = true;
                wait();
              }
            });

            // Fallback timeout in case 'load' event was missed
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                wait();
              }
            }, 5000); // 5 seconds fallback
          }
        });
      }
    });

    // Then execute our main scripts
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [
        'content_scripts/remover.js',
        'content_scripts/viewStreamButton.js',
        'content_scripts/commandMonitor.js'
      ]
    });
    console.log(`Twitch Chat Overlay Cleaner executed successfully on tab: ${tabId}`);
  } catch (error) {
    console.error(`Error executing on tab ${tabId}:`, error);
  }
}

// Function to check if URL is from Twitch popout chat
function isTwitchPopoutChat(url) {
  return url && url.includes('twitch.tv') && url.includes('/popout/') && url.includes('/chat');
}

// Function to start monitoring
async function startMonitoring() {
  isEnabled = true;
  await chrome.storage.local.set({ isEnabled: true });
  
  // Execute on all existing Twitch popout chat tabs
  const allTabs = await chrome.tabs.query({});
  const twitchPopoutTabs = allTabs.filter(tab => isTwitchPopoutChat(tab.url));
  
  for (const tab of twitchPopoutTabs) {
    await executeScripts(tab.id);
  }
  
  // Update icon to active state
  chrome.action.setIcon({
    path: {
      "16": "icons/icon16-active.png",
      "32": "icons/icon32-active.png",
      "48": "icons/icon48-active.png",
      "128": "icons/icon128-active.png"
    }
  });
  
  console.log('Twitch popout chat monitoring started');
}

// Function to stop monitoring
async function stopMonitoring() {
  isEnabled = false;
  await chrome.storage.local.set({ isEnabled: false });
  
  // Update icon to inactive state
  chrome.action.setIcon({
    path: {
      "16": "icons/icon16-inactive.png",
      "32": "icons/icon32-inactive.png",
      "48": "icons/icon48-inactive.png",
      "128": "icons/icon128-inactive.png"
    }
  });
  
  console.log('Twitch popout chat monitoring stopped');
}

// Extension icon click listener
chrome.action.onClicked.addListener(async () => {
  if (isEnabled) {
    await stopMonitoring();
  } else {
    await startMonitoring();
  }
});

// Listen for new tabs being created
chrome.tabs.onCreated.addListener(async (tab) => {
  if (isEnabled && isTwitchPopoutChat(tab.url)) {
    await executeScripts(tab.id);
  }
});

// Listen for tab URL updates and refreshes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!isEnabled) return;

  // Handle URL changes
  if (changeInfo.url && isTwitchPopoutChat(changeInfo.url)) {
    console.log(`[Service Worker] URL changed in tab ${tabId}, executing scripts...`);
    await executeScripts(tabId);
    return;
  }

  // Handle page refresh (when status changes to loading)
  if (changeInfo.status === 'loading' && isTwitchPopoutChat(tab.url)) {
    console.log(`[Service Worker] Page refresh detected in tab ${tabId}, waiting for complete...`);
    
    // Wait for the page to be completely loaded
    const checkComplete = async () => {
      try {
        const updatedTab = await chrome.tabs.get(tabId);
        if (updatedTab.status === 'complete') {
          console.log(`[Service Worker] Tab ${tabId} loaded completely after refresh, executing scripts...`);
          await executeScripts(tabId);
        } else {
          // Check again in 500ms
          setTimeout(checkComplete, 500);
        }
      } catch (error) {
        console.error(`[Service Worker] Error checking tab ${tabId} status:`, error);
      }
    };

    // Start checking after a short delay
    setTimeout(checkComplete, 1000);
  }
});

// Handle extension disable/uninstall events
chrome.management.onDisabled.addListener(async (info) => {
  if (info.id === chrome.runtime.id) {
    await stopMonitoring();
  }
});

chrome.management.onUninstalled.addListener(async (id) => {
  if (id === chrome.runtime.id) {
    await stopMonitoring();
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    if (message.action === 'requestAttention') {
      // Get the window ID of the sender tab
      const tab = sender.tab;
      if (tab && tab.windowId) {
        // Make the window flash to draw attention
        await chrome.windows.update(tab.windowId, { 
          focused: true,
          drawAttention: true 
        });
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Initialize when extension loads
initializeExtension(); 