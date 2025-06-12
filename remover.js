// Optimized Twitch Chat Overlay Cleaner
(function() {
  'use strict';

  // Check if already executed in this tab
  const REMOVER_ID = 'twitch-overlay-remover-executed';
  
  if (
    window.twitchOverlayRemoverExecuted || 
    document.getElementById(REMOVER_ID) ||
    sessionStorage.getItem(REMOVER_ID)
  ) {
    console.log('Twitch Chat Overlay Cleaner: Already executed in this tab');
    return;
  }

  // Mark as executed
  window.twitchOverlayRemoverExecuted = true;
  sessionStorage.setItem(REMOVER_ID, 'true');
  
  // Create hidden marker
  const marker = document.createElement('div');
  marker.id = REMOVER_ID;
  marker.style.display = 'none';
  document.body.appendChild(marker);

  const selectors = [
    ".chat-room__content div.Layout-sc-1xcs6mc-0",
    ".stream-chat-header", 
    ".community-highlight-stack__card--wide"
  ];

  // Remove overlay elements
  selectors.forEach(selector => {
    const element = document.querySelector(selector);
    if (element) element.remove();
  });

  console.log('Twitch Chat Overlay Cleaner: Overlay elements removed successfully');

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    delete window.twitchOverlayRemoverExecuted;
    sessionStorage.removeItem(REMOVER_ID);
    const markerElement = document.getElementById(REMOVER_ID);
    if (markerElement) {
      markerElement.remove();
    }
  });
})();
