// Auto-detects page text numbers (words & chars) and captures full page context
let lastWordCount = 0;
let debounceTimer = null;

function extractFullPageContext() {
  try {
    const parts = [];

    // 1. Meta description & headings summary for top-level context
    const metaDesc = document.querySelector('meta[name="description"]')?.content;
    if (metaDesc) {
      parts.push("Meta Description: " + metaDesc.trim());
    }

    // 2. Full visible text + fallback to textContent for collapsed/tabbed sections
    const bodyText = document.body ? document.body.innerText.trim() : "";
    if (bodyText) {
      parts.push(bodyText);
    }

    // 3. Also grab text inside <article>, <main>, or accordion/details elements that might be collapsed
    const hiddenDetails = Array.from(document.querySelectorAll("details:not([open]), [aria-hidden='true']"))
      .map(el => el.textContent.replace(/\s+/g, " ").trim())
      .filter(t => t.length > 40);
    if (hiddenDetails.length > 0) {
      parts.push("Additional Page Sections:\n" + hiddenDetails.slice(0, 15).join("\n"));
    }

    // 4. Collect mailto emails
    const mailLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
      .map(a => a.href.replace(/^mailto:/i, "").split("?")[0].trim())
      .filter(Boolean);

    // 5. Collect phone numbers / tel: links
    const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
      .map(a => a.href.replace(/^tel:/i, "").trim())
      .filter(Boolean);

    if (mailLinks.length > 0) {
      parts.push("Contact Emails: " + [...new Set(mailLinks)].join(", "));
    }
    if (telLinks.length > 0) {
      parts.push("Contact Phones: " + [...new Set(telLinks)].join(", "));
    }

    const fullText = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
    const chars = fullText.length;

    return {
      text: fullText,
      words: words,
      chars: chars,
      title: document.title || "Webpage",
      url: window.location.href,
      ready: words >= 20
    };
  } catch (e) {
    return { text: "", words: 0, chars: 0, title: document.title, url: window.location.href, ready: false };
  }
}

function notifyExtension() {
  const data = extractFullPageContext();
  if (data.words !== lastWordCount) {
    lastWordCount = data.words;
    chrome.runtime.sendMessage({
      action: "AUTO_CONTEXT_DETECTED",
      words: data.words,
      chars: data.chars,
      ready: data.ready
    }).catch(() => {});
  }
}

// Initial scan
notifyExtension();

// Watch for dynamic SPA / infinite-scroll DOM updates automatically
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(notifyExtension, 500);
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

// Respond to popup.js requests immediately with fresh full context
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_FULL_CONTEXT") {
    const freshData = extractFullPageContext();
    sendResponse(freshData);
  }
  return true;
});
