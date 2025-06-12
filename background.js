// Background script for Twitch Chat Overlay Cleaner
// Executes the cleaning script when the extension icon is clicked

chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Get all open tabs
    const allTabs = await chrome.tabs.query({});
    
    // Filter Twitch tabs
    const twitchTabs = allTabs.filter(tab => 
      tab.url && tab.url.includes('twitch.tv')
    );
    
    if (twitchTabs.length > 0) {
      let successCount = 0;
      let errorCount = 0;
      
      // Execute the cleaning script in all Twitch tabs
      for (const twitchTab of twitchTabs) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: twitchTab.id },
            files: ['remover.js', 'viewStreamButton.js']
          });
          successCount++;
          console.log(`Twitch Chat Overlay Cleaner executed successfully on tab: ${twitchTab.title}`);
        } catch (error) {
          errorCount++;
          console.error(`Error executing on tab ${twitchTab.id}:`, error);
        }
      }
      
      console.log(`Twitch Chat Overlay Cleaner: Executed on ${successCount}/${twitchTabs.length} Twitch tabs`);
      
      // Show badge with number of tabs cleaned
      chrome.action.setBadgeText({
        text: successCount.toString()
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#9146ff'
      });
      
      // Clear badge after 4 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({
          text: ''
        });
      }, 4000);
      
    } else {
      // No Twitch tabs found
      console.log('No Twitch tabs found');
      
      chrome.action.setBadgeText({
        text: '0'
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#666666'
      });
      
      // Clear badge after 3 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({
          text: ''
        });
      }, 3000);
    }
    
  } catch (error) {
    console.error('Error getting tabs:', error);
    
    // Show error badge
    chrome.action.setBadgeText({
      text: '!'
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#FF0000'
    });
    
    setTimeout(() => {
      chrome.action.setBadgeText({
        text: ''
      });
    }, 3000);
  }
}); 