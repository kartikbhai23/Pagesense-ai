chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "AUTO_CONTEXT_DETECTED" && sender.tab && sender.tab.id) {
    const words = message.words || 0;
    let badgeText = "";
    if (words >= 1000) {
      badgeText = (words / 1000).toFixed(1) + "k";
    } else if (words > 0) {
      badgeText = String(words);
    }

    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: badgeText
    });

    // Muted forest green badge matching Version 2 editorial palette
    chrome.action.setBadgeBackgroundColor({
      tabId: sender.tab.id,
      color: words >= 50 ? "#2B4C38" : "#9C4328"
    });
  }
  return false;
});
