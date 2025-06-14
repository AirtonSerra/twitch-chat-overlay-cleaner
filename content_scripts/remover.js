// Optimized Twitch Chat Overlay Cleaner
(function () {
  "use strict";

  // Check if already executed in this tab
  const REMOVER_ID = "twitch-overlay-remover-executed";

  if (
    window.twitchOverlayRemoverExecuted ||
    document.getElementById(REMOVER_ID)
  ) {
    console.log("Twitch Chat Overlay Cleaner: Already executed in this tab");
    return;
  }

  // Mark as executed
  window.twitchOverlayRemoverExecuted = true;

  // Create hidden marker
  const marker = document.createElement("div");
  marker.id = REMOVER_ID;
  marker.style.display = "none";
  document.body.appendChild(marker);

  const oneTimeRemovalSelectors = [
    ".chat-room__content div.Layout-sc-1xcs6mc-0",
  ];
  const periodicRemovalSelectors = [
    ".stream-chat-header",
    ".community-highlight-stack__card--wide",
  ];

  oneTimeRemovalSelectors.forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) element.remove();
  });

  // Function to remove elements based on selectors
  function removeElements() {
    periodicRemovalSelectors.forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) element.remove();
    });
  }

  // Execute removal every second for 30 seconds
  let secondsElapsed = 0;
  const interval = setInterval(() => {
    removeElements();
    secondsElapsed++;

    if (secondsElapsed >= 30) {
      clearInterval(interval);
    }
  }, 1000);

  // Execute once immediately
  removeElements();

  console.log(
    "Twitch Chat Overlay Cleaner: Overlay elements removed successfully"
  );

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    delete window.twitchOverlayRemoverExecuted;
    const markerElement = document.getElementById(REMOVER_ID);
    if (markerElement) {
      markerElement.remove();
    }
  });
})();
