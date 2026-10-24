// PageSense V2 - Premium SaaS Interface Engine
// Word & character metrics are extracted and tracked internally for LLM context,
// but kept clean from visual clutter in the UI per editorial guidelines.

const questionInput = document.getElementById("question");
const askButton = document.getElementById("ask-button");
const rescanBtn = document.getElementById("rescan-btn");
const clearBtn = document.getElementById("clear-btn");
const toggleDossierBtn = document.getElementById("toggle-dossier-btn");
const dossierDrawer = document.getElementById("dossier-drawer");
const drawerCloseBtn = document.getElementById("drawer-close-btn");
const drawerUrl = document.getElementById("drawer-url");
const copyUrlBtn = document.getElementById("copy-url-btn");
const copyContextBtn = document.getElementById("copy-context-btn");
const copyCommandBtn = document.getElementById("copy-command-btn");
const retryBackendBtn = document.getElementById("retry-backend-btn");
const capacityText = document.getElementById("capacity-text");
const contactsField = document.getElementById("contacts-field");
const contactsList = document.getElementById("contacts-list");

const pageDomainEl = document.getElementById("page-domain");
const pageTitleEl = document.getElementById("page-title");
const readTimeBadge = document.getElementById("read-time-badge");
const contextDot = document.getElementById("context-dot");
const contextState = document.getElementById("context-state");
const contextMeter = document.getElementById("context-meter");
const backendDot = document.getElementById("backend-dot");
const backendStatusText = document.getElementById("backend-status-text");
const offlineBanner = document.getElementById("offline-banner");
const chatBox = document.getElementById("chat-box");
const inquiryForm = document.getElementById("inquiry-form");

let cachedPage = {
  url: "",
  domain: "",
  title: "",
  text: "",
  words: 0,
  chars: 0,
  contacts: []
};

function formatDomain(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, "").toUpperCase();
  } catch (e) {
    return "WEBPAGE";
  }
}

function calculateReadTime(words) {
  if (!words || words <= 0) return "— min read";
  const mins = Math.max(1, Math.ceil(words / 225));
  return `~${mins} min read`;
}

function renderMarkdown(text) {
  if (!text) return "";
  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");

  const lines = safe.split("\n");
  let html = "";
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith("* ") || line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${line.substring(2)}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      if (line) {
        html += `<div>${line}</div>`;
      } else {
        html += "<div class='msg-spacer'></div>";
      }
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function removeEmptyState() {
  const empty = document.getElementById("empty-state");
  if (empty) empty.remove();
}

function updateAskButtonState() {
  if (askButton && !askButton.dataset.inFlight) {
    const hasText = questionInput && questionInput.value.trim().length > 0;
    askButton.disabled = !hasText;
  }
}

function appendUserMessage(text) {
  removeEmptyState();
  const wrapper = document.createElement("div");
  wrapper.className = "msg-user";
  wrapper.innerHTML = `
    <div class="msg-user-meta">YOU</div>
    <div class="msg-user-content"></div>
  `;
  wrapper.querySelector(".msg-user-content").textContent = text;
  chatBox.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function appendLoadingMessage() {
  removeEmptyState();
  const wrapper = document.createElement("div");
  wrapper.className = "msg-loading";
  wrapper.id = "active-loading-msg";
  wrapper.innerHTML = `
    <div class="loading-label-row">
      <span class="loading-pulse-dots">
        <span></span><span></span><span></span>
      </span>
      <span>Analyzing page context…</span>
    </div>
    <div class="loading-track">
      <div class="loading-bar-sweep"></div>
    </div>
  `;
  chatBox.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return wrapper;
}

function appendBotMessage(rawMarkdown) {
  const loading = document.getElementById("active-loading-msg");
  if (loading) loading.remove();

  const wrapper = document.createElement("div");
  wrapper.className = "msg-bot reply-popup-anim";

  const meta = document.createElement("div");
  meta.className = "msg-bot-meta";
  meta.innerHTML = `
    <div class="msg-bot-author">
      <span class="bot-badge-beacon"></span>
      <span>PAGESENSE</span>
    </div>
    <button class="copy-answer-btn" title="Copy answer" aria-label="Copy answer">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span class="copy-btn-text">Copy</span>
    </button>
  `;

  const content = document.createElement("div");
  content.className = "msg-bot-content";
  content.innerHTML = renderMarkdown(rawMarkdown);

  const copyBtn = meta.querySelector(".copy-answer-btn");
  const copyBtnText = meta.querySelector(".copy-btn-text");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(rawMarkdown).then(() => {
      copyBtnText.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtnText.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 1800);
    }).catch(() => {
      copyBtnText.textContent = "Failed";
    });
  });

  wrapper.appendChild(meta);
  wrapper.appendChild(content);
  chatBox.appendChild(wrapper);

  wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function appendErrorMessage(errText, isOffline = false) {
  const loading = document.getElementById("active-loading-msg");
  if (loading) loading.remove();

  const wrapper = document.createElement("div");
  wrapper.className = "msg-error";
  if (isOffline) {
    wrapper.innerHTML = `
      <div class="error-title">Backend Server Offline</div>
      <div class="error-msg">Start local API: <code>uvicorn main:app --reload</code></div>
    `;
  } else {
    wrapper.innerHTML = `
      <div class="error-title">Inquiry Error</div>
      <div class="error-msg">${errText.replace(/</g, "&lt;")}</div>
    `;
  }
  chatBox.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resetChatQuietly() {
  chatBox.innerHTML = `
    <div class="editorial-empty-state" id="empty-state">
      <div class="empty-dossier-card">
        <div class="empty-header">
          <div class="empty-card-mac-dots" aria-hidden="true">
            <span class="mini-dot red"></span>
            <span class="mini-dot yellow"></span>
            <span class="mini-dot green"></span>
          </div>
          <span class="empty-badge">FULL PAGE INDEXED</span>
        </div>
        <p class="empty-lead">
          PageSense has ingested the active tab context. Ask any question or choose a prompt below:
        </p>
        <div class="empty-suggestions">
          <button class="suggestion-link" data-prompt="Summarize this entire page into clear, concise executive bullet points.">
            <span class="suggestion-text">What is the primary objective of this page?</span>
            <svg class="suggestion-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
          <button class="suggestion-link" data-prompt="What technical specifications or key details are outlined here?">
            <span class="suggestion-text">What specifications or details are outlined here?</span>
            <svg class="suggestion-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
          <button class="suggestion-link" data-prompt="Identify any deadlines, dates, or contact info mentioned.">
            <span class="suggestion-text">Identify any deadlines, dates, or contact info.</span>
            <svg class="suggestion-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  attachSuggestionListeners();
}

function attachSuggestionListeners() {
  document.querySelectorAll(".suggestion-link").forEach(btn => {
    btn.onclick = () => {
      const prompt = btn.getAttribute("data-prompt");
      handleAsk(prompt);
    };
  });
}

async function checkBackend() {
  try {
    const res = await fetch("https://pagesense-ai.onrender.com/health", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      backendDot.className = "status-indicator-dot online";
      backendStatusText.textContent = "Connected";
      offlineBanner.hidden = true;
      offlineBanner.style.display = "none";
      return true;
    }
  } catch (e) { }

  backendDot.className = "status-indicator-dot offline";
  backendStatusText.textContent = "Offline";
  offlineBanner.hidden = false;
  offlineBanner.style.display = "flex";
  return false;
}

// Fallback direct script injection if content script wasn't active
async function fallbackExecuteScript(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const parts = [];
        const metaDesc = document.querySelector('meta[name="description"]')?.content;
        if (metaDesc) parts.push("Meta Description: " + metaDesc.trim());

        const visibleText = document.body ? document.body.innerText.trim() : "";
        if (visibleText) parts.push(visibleText);

        const mailLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
          .map(a => a.href.replace(/^mailto:/i, "").split("?")[0].trim())
          .filter(Boolean);
        const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
          .map(a => a.href.replace(/^tel:/i, "").trim())
          .filter(Boolean);
        const contacts = Array.from(new Set([...mailLinks, ...telLinks]));

        const fullText = parts.join("\n\n");
        const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
        return {
          text: fullText,
          words: words,
          chars: fullText.length,
          contacts: contacts
        };
      }
    });
    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
  } catch (err) {
    console.warn("Fallback extraction warning:", err);
  }
  return { text: "", words: 0, chars: 0, contacts: [] };
}

async function autoDetectPageContext() {
  contextState.textContent = "Scanning…";
  contextDot.className = "context-bullet scanning";
  pageTitleEl.classList.add("context-scanning-shimmer");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith("http")) {
      pageDomainEl.textContent = "RESTRICTED";
      pageTitleEl.textContent = "Open standard http/https webpage to scan";
      pageTitleEl.classList.remove("context-scanning-shimmer");
      readTimeBadge.textContent = "— min read";
      contextDot.className = "context-bullet";
      contextState.textContent = "Unavailable";
      updateSplashStatus("Restricted page");
      scheduleSplashDismiss(150);
      return;
    }

    cachedPage.url = tab.url;
    cachedPage.domain = formatDomain(tab.url);
    cachedPage.title = tab.title || "Webpage";

    pageDomainEl.textContent = cachedPage.domain;
    pageTitleEl.textContent = cachedPage.title;
    drawerUrl.value = cachedPage.url;
    updateSplashStatus(`Scanning ${cachedPage.domain}…`);

    chrome.tabs.sendMessage(tab.id, { action: "GET_FULL_CONTEXT" }, async (response) => {
      let data = response;
      if (chrome.runtime.lastError || !data || !data.text) {
        data = await fallbackExecuteScript(tab.id);
      }

      cachedPage.text = data.text || "";
      cachedPage.words = data.words || 0;
      cachedPage.chars = data.chars || 0;
      cachedPage.contacts = data.contacts || [];

      readTimeBadge.textContent = calculateReadTime(cachedPage.words);
      capacityText.textContent = `${cachedPage.chars.toLocaleString()} / 250,000 chars`;
      pageTitleEl.classList.remove("context-scanning-shimmer");

      if (cachedPage.words > 0) {
        contextDot.className = "context-bullet ready";
        contextState.textContent = "Context Ready";
        const pct = Math.min(100, Math.max(8, Math.round((cachedPage.chars / 250000) * 100)));
        contextMeter.style.width = `${pct}%`;
        updateSplashStatus("Context Ready");
      } else {
        contextDot.className = "context-bullet";
        contextState.textContent = "No Text Found";
        contextMeter.style.width = "0%";
        updateSplashStatus("No Text Found");
      }

      if (cachedPage.contacts && cachedPage.contacts.length > 0) {
        contactsField.hidden = false;
        contactsList.textContent = cachedPage.contacts.join(" | ");
      } else {
        contactsField.hidden = true;
      }

      scheduleSplashDismiss(100);
    });
  } catch (err) {
    pageTitleEl.textContent = "Could not access active tab";
    pageTitleEl.classList.remove("context-scanning-shimmer");
    contextDot.className = "context-bullet";
    contextState.textContent = "Error";
    scheduleSplashDismiss(150);
  }
}

async function handleAsk(customPrompt = null) {
  const question = (customPrompt || questionInput.value).trim();
  if (!question) return;

  if (!customPrompt) questionInput.value = "";
  updateAskButtonState();
  appendUserMessage(question);

  askButton.dataset.inFlight = "true";
  askButton.disabled = true;
  appendLoadingMessage();

  try {
    if (!cachedPage.url || !cachedPage.url.startsWith("http")) {
      throw new Error("Please open a standard website (http/https) first.");
    }

    if (!cachedPage.text) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const fallback = await fallbackExecuteScript(tab.id);
        cachedPage.text = fallback.text;
        cachedPage.words = fallback.words;
        cachedPage.chars = fallback.chars;
      }
    }

    const response = await fetch("https://pagesense-ai.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: question,
        page_url: cachedPage.url,
        page_title: cachedPage.title,
        page_content: cachedPage.text,
        word_count: cachedPage.words,
        char_count: cachedPage.chars
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || `Server error (${response.status})`);
    }

    appendBotMessage(data.answer);
  } catch (error) {
    const isOffline = error.message && (error.message.includes("Failed to fetch") || error.name === "TypeError");
    appendErrorMessage(error.message, isOffline);
    if (isOffline) {
      backendDot.className = "status-indicator-dot offline";
      backendStatusText.textContent = "Offline";
      offlineBanner.hidden = false;
      offlineBanner.style.display = "flex";
    }
  } finally {
    delete askButton.dataset.inFlight;
    updateAskButtonState();
  }
}

// Event Listeners
inquiryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleAsk();
});

questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleAsk();
  }
});

questionInput.addEventListener("input", updateAskButtonState);

rescanBtn.addEventListener("click", () => {
  autoDetectPageContext();
});

clearBtn.addEventListener("click", () => {
  resetChatQuietly();
});

toggleDossierBtn.addEventListener("click", () => {
  dossierDrawer.hidden = !dossierDrawer.hidden;
});

drawerCloseBtn.addEventListener("click", () => {
  dossierDrawer.hidden = true;
});

copyUrlBtn.addEventListener("click", () => {
  if (cachedPage.url) {
    navigator.clipboard.writeText(cachedPage.url).then(() => {
      copyUrlBtn.textContent = "Copied";
      setTimeout(() => { copyUrlBtn.textContent = "Copy"; }, 1500);
    });
  }
});

copyContextBtn.addEventListener("click", () => {
  if (cachedPage.text) {
    navigator.clipboard.writeText(cachedPage.text).then(() => {
      copyContextBtn.textContent = "Copied to Clipboard";
      setTimeout(() => { copyContextBtn.textContent = "Copy Full Extracted Text"; }, 2000);
    });
  }
});

if (copyCommandBtn) {
  copyCommandBtn.addEventListener("click", () => {
    navigator.clipboard.writeText("uvicorn main:app --reload").then(() => {
      const btnText = copyCommandBtn.querySelector(".btn-text") || copyCommandBtn;
      const oldText = btnText.textContent;
      btnText.textContent = "Copied!";
      setTimeout(() => { btnText.textContent = oldText; }, 1800);
    });
  });
}

if (retryBackendBtn) {
  retryBackendBtn.addEventListener("click", async () => {
    const icon = retryBackendBtn.querySelector(".retry-icon");
    const textEl = retryBackendBtn.querySelector(".retry-text");
    if (icon) icon.classList.add("spin");
    if (textEl) textEl.textContent = "Checking…";
    retryBackendBtn.disabled = true;

    await checkBackend();

    setTimeout(() => {
      if (icon) icon.classList.remove("spin");
      if (textEl) textEl.textContent = "Retry";
      retryBackendBtn.disabled = false;
    }, 450);
  });
}

document.querySelectorAll(".action-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    handleAsk(chip.getAttribute("data-prompt"));
  });
});

// Escape to close drawer
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !dossierDrawer.hidden) {
    dossierDrawer.hidden = true;
  }
});

// ── Startup frontend loading animation ──
let splashDismissed = false;
const startupStartTime = Date.now();

function updateSplashStatus(text) {
  const label = document.querySelector(".splash-status-label");
  if (label) label.textContent = text;
}

function dismissSplash() {
  if (splashDismissed) return;
  splashDismissed = true;

  const splash = document.getElementById("splash-overlay");
  const appLayout = document.querySelector(".app-layout");

  if (splash) {
    splash.classList.add("splash-fade-out");
  }

  if (appLayout) {
    appLayout.classList.remove("app-hidden");
    appLayout.classList.add("app-reveal");
  }

  setTimeout(() => {
    if (splash) splash.remove();
  }, 420);
}

function scheduleSplashDismiss(extraDelay = 0) {
  const elapsed = Date.now() - startupStartTime;
  const minDuration = 550;
  const remaining = Math.max(0, minDuration - elapsed);
  setTimeout(() => {
    dismissSplash();
  }, remaining + extraDelay);
}

// Fallback safety timeout so splash never hangs
setTimeout(() => {
  dismissSplash();
}, 1200);

// Initialize
attachSuggestionListeners();
checkBackend();
autoDetectPageContext();
updateAskButtonState();
