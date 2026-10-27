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

// PageSense AI selected-text chat feature. Added alongside the existing badge handler.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "PAGESENSE_SELECTION_CHAT") return false;

  (async () => {
    const selectedText = String(message.selected_text || "").trim();
    const question = String(message.question || "").trim();
    if (!selectedText) throw new Error("Select some text first.");
    if (!question) throw new Error("Enter a question.");
    if (selectedText.length > 12000) throw new Error("Select a shorter passage (maximum 12,000 characters).");
    if (question.length > 1000) throw new Error("Keep the question under 1,000 characters.");

    const response = await fetch("https://pagesense-ai.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        page_url: String(message.page_url || "https://example.com/"),
        page_title: String(message.page_title || "Webpage"),
        page_content: selectedText,
        word_count: selectedText.split(/\s+/).filter(Boolean).length,
        char_count: selectedText.length
      })
    });

    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Backend returned an unreadable response (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(data?.detail || data?.error || `Backend request failed (HTTP ${response.status}).`);
    if (!data?.answer) throw new Error("The backend response did not contain an answer.");
    sendResponse({ ok: true, answer: String(data.answer) });
  })().catch(error => sendResponse({ ok: false, error: error?.message || "Could not reach PageSense AI." }));
  return true;
});
