// View Stream Button for Twitch Chat Popups
// Adds a "View Stream" button to navigate from chat popup to main stream page

(function () {
  "use strict";

  // Check if already executed in this tab
  const BUTTON_ID = "twitch-view-stream-executed";

  if (window.twitchViewStreamExecuted || document.getElementById(BUTTON_ID)) {
    console.log("Twitch View Stream Button: Already executed in this tab");
    return;
  }

  // Mark as executed
  window.twitchViewStreamExecuted = true;

  // Create hidden marker
  const marker = document.createElement("div");
  marker.id = BUTTON_ID;
  marker.style.display = "none";
  document.body.appendChild(marker);

  function addViewStreamButton() {
    const currentUrl = window.location.href;

    const targetContainer = document.querySelector(
      ".Layout-sc-1xcs6mc-0.lnazSn"
    );

    if (targetContainer) {
      // Check if button already exists to avoid duplicates
      if (
        !targetContainer.querySelector('[data-a-target="view-stream-button"]')
      ) {
        // Extract streamer name from popup URL
        // Format: https://www.twitch.tv/popout/STREAMER_NAME/chat?popout=
        const match = currentUrl.match(/\/popout\/([^\/]+)\/chat/);
        if (match) {
          const streamerName = match[1];
          const targetUrl = `https://www.twitch.tv/${streamerName}`;

          // Create the view stream button HTML
          const viewStreamButtonHTML = `
            <div class="InjectLayout-sc-1i43xsx-0 iDMNUO" style="margin-right: 5px;">
              <button data-a-target="view-stream-button" aria-label="View Stream" class="ScCoreButton-sc-ocjdkq-0 jxDhnp" onclick="window.open('${targetUrl}', '_blank')">
                <div class="ScCoreButtonLabel-sc-s7h2b7-0 kaIUar">
                  <div data-a-target="tw-core-button-label-text" class="Layout-sc-1xcs6mc-0 JckMc">View Stream</div>
                </div>
              </button>
            </div>
          `;

          // Insert the button at the beginning
          targetContainer.insertAdjacentHTML(
            "afterbegin",
            viewStreamButtonHTML
          );
          console.log(
            'Twitch Chat Overlay Cleaner: "View Stream" button added successfully'
          );
        }
      }
    }
  }

  // Execute view stream button addition
  addViewStreamButton();

  // Try again after a short delay in case the DOM needs more time to load
  setTimeout(addViewStreamButton, 1000);

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    delete window.twitchViewStreamExecuted;
    const markerElement = document.getElementById(BUTTON_ID);
    if (markerElement) {
      markerElement.remove();
    }
  });
})();
