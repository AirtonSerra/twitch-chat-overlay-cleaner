// Optimized Twitch Chat Overlay Cleaner
const selectors = [
  ".chat-room__content div.Layout-sc-1xcs6mc-0",
  ".stream-chat-header", 
  ".community-highlight-stack__card--wide"
];

selectors.forEach(selector => {
  const element = document.querySelector(selector);
  if (element) element.remove();
});
