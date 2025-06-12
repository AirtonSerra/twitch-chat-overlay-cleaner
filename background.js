// Global state to control execution
let isEnabled = false;

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
      files: ['remover.js', 'viewStreamButton.js', 'commandMonitor.js']
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
function stopMonitoring() {
  isEnabled = false;
  
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
    stopMonitoring();
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

// Clean up when extension is deactivated
chrome.runtime.onSuspend.addListener(() => {
  if (isEnabled) {
    stopMonitoring();
  }
}); 