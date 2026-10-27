(() => {
  "use strict";
  if (window.__pagesenseSelectionAssistantLoaded) return;
  window.__pagesenseSelectionAssistantLoaded = true;

  console.log("[PageSense AI] Selection assistant initializing...");

  const MAX_SELECTION_LENGTH = 12000;
  let selectedText = "";
  let toolbar = null;
  let panel = null;
  let answerText = null;
  let busy = false;
  let lastSelectionRect = null;
  let isSelecting = false; // Track if user is currently dragging to select

  // --- Create isolated Shadow DOM container ---
  let root, shadow, host;
  try {
    root = document.createElement("div");
    root.id = "pagesense-selection-assistant-root";
    root.setAttribute("style", [
      "all:initial !important",
      "position:fixed !important",
      "top:0 !important",
      "left:0 !important",
      "width:0 !important",
      "height:0 !important",
      "overflow:visible !important",
      "z-index:2147483647 !important",
      "pointer-events:none !important"
    ].join(";"));

    (document.body || document.documentElement).appendChild(root);
    shadow = root.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = getCSS();
    shadow.appendChild(style);

    host = document.createElement("div");
    host.className = "ps-host";
    shadow.appendChild(host);
  } catch (err) {
    console.error("[PageSense AI] Failed to init:", err);
    return;
  }

  // --- Helpers ---
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function getSelection2() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const text = sel.toString().trim();
    if (!text || text.length < 2) return null;
    const range = sel.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return { text, rect };
  }

  function position(element, where) {
    if (!lastSelectionRect) return;
    const r = lastSelectionRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    const pad = 8;

    // Need to read size after it's in the DOM
    const ew = element.offsetWidth || 420;
    const eh = element.offsetHeight || 50;

    let left = r.left + r.width / 2 - ew / 2;
    let top;

    if (where === "above") {
      top = r.top - eh - gap;
      if (top < pad) top = r.bottom + gap;
    } else {
      top = r.bottom + gap;
      if (top + eh > vh - pad) top = r.top - eh - gap;
    }

    left = clamp(left, pad, vw - ew - pad);
    top = clamp(top, pad, vh - eh - pad);
    element.style.left = Math.round(left) + "px";
    element.style.top = Math.round(top) + "px";
  }

  // --- UI Management ---
  function removeToolbar() {
    if (toolbar) { toolbar.remove(); toolbar = null; }
  }

  function closePanel() {
    if (panel) { panel.remove(); panel = null; }
    answerText = null;
    busy = false;
  }

  function closeAll() {
    removeToolbar();
    closePanel();
  }

  // --- Actions ---
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(selectedText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = selectedText;
      ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    const btn = toolbar?.querySelector('[data-act="copy"]');
    if (btn) {
      btn.textContent = "✓ Copied";
      setTimeout(() => { if (btn.isConnected) btn.textContent = "📋  Copy"; }, 1200);
    }
  }

  function doSearch() {
    window.open("https://www.google.com/search?q=" + encodeURIComponent(selectedText), "_blank");
    closeAll();
  }

  function doTranslate() {
    window.open("https://translate.google.com/?sl=auto&tl=en&text=" + encodeURIComponent(selectedText) + "&op=translate", "_blank");
    closeAll();
  }

  // --- Toolbar ---
  function showToolbar() {
    removeToolbar();
    toolbar = el("div", "ps-toolbar");

    // Prevent clicks inside toolbar from propagating to document (which would close it)
    toolbar.addEventListener("mousedown", e => e.stopPropagation());
    toolbar.addEventListener("mouseup", e => e.stopPropagation());
    toolbar.addEventListener("click", e => e.stopPropagation());

    const logo = el("span", "ps-logo", "◉");

    const btnAnswer = el("button", "ps-btn ps-btn-answer");
    btnAnswer.innerHTML = "💬&nbsp;&nbsp;Answer";
    btnAnswer.addEventListener("click", () => {
      removeToolbar();
      showAnswerPanel();
      doAsk("Explain the selected text clearly and concisely. Define any technical terms and give a brief example if useful.");
    });

    const btnCopy = el("button", "ps-btn");
    btnCopy.innerHTML = "📋&nbsp;&nbsp;Copy";
    btnCopy.dataset.act = "copy";
    btnCopy.addEventListener("click", doCopy);

    const btnSearch = el("button", "ps-btn");
    btnSearch.innerHTML = "🔍&nbsp;&nbsp;Search";
    btnSearch.addEventListener("click", doSearch);

    const btnTranslate = el("button", "ps-btn");
    btnTranslate.innerHTML = "🌐&nbsp;&nbsp;Translate";
    btnTranslate.addEventListener("click", doTranslate);

    const divider = el("span", "ps-divider");

    const btnClose = el("button", "ps-btn ps-btn-close", "⌄");
    btnClose.addEventListener("click", closeAll);

    toolbar.append(logo, btnAnswer, btnCopy, btnSearch, btnTranslate, divider, btnClose);
    host.appendChild(toolbar);

    // Position after rendering
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (toolbar) position(toolbar, "above");
      });
    });
  }

  // --- Answer Panel ---
  function showAnswerPanel() {
    closePanel();
    panel = el("section", "ps-panel");

    // Prevent clicks inside panel from propagating
    panel.addEventListener("mousedown", e => e.stopPropagation());
    panel.addEventListener("mouseup", e => e.stopPropagation());
    panel.addEventListener("click", e => e.stopPropagation());

    const hdr = el("div", "ps-panel-header");
    const brand = el("div", "ps-panel-brand");
    brand.innerHTML = '<span class="ps-logo">◉</span><strong>Answer</strong>';
    const closeBtn = el("button", "ps-panel-close", "×");
    closeBtn.addEventListener("click", closePanel);
    hdr.append(brand, closeBtn);

    answerText = el("div", "ps-panel-body");
    answerText.innerHTML = '<span class="ps-caret"></span>';

    panel.append(hdr, answerText);
    host.appendChild(panel);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (panel) position(panel, "below");
      });
    });
  }

  async function doAsk(question) {
    if (busy) return;
    busy = true;
    if (answerText) {
      answerText.textContent = "";
      answerText.innerHTML = '<span class="ps-caret"></span>';
      answerText.classList.add("ps-loading");
    }

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "PAGESENSE_SELECTION_CHAT",
        question,
        selected_text: selectedText,
        page_url: location.href,
        page_title: document.title || location.hostname
      });
      if (!resp?.ok) throw new Error(resp?.error || "Could not get an answer.");
      if (answerText) {
        answerText.classList.remove("ps-loading");
        answerText.textContent = resp.answer || "No answer was returned.";
      }
    } catch (err) {
      if (answerText) {
        answerText.classList.remove("ps-loading");
        answerText.textContent = err?.message || "Something went wrong.";
        answerText.classList.add("ps-error");
      }
    } finally {
      busy = false;
      if (panel) requestAnimationFrame(() => { if (panel) position(panel, "below"); });
    }
  }

  // =================================================================
  //  EVENT LISTENERS
  // =================================================================

  // Track selection dragging to avoid premature close
  document.addEventListener("mousedown", () => {
    isSelecting = true;
  }, true);

  // On mouse-up: check if user made a selection and show toolbar
  document.addEventListener("mouseup", (e) => {
    // Small delay to let the browser finalize the selection
    setTimeout(() => {
      isSelecting = false;

      // If answer panel is open, don't show/hide toolbar
      if (panel) return;

      const info = getSelection2();
      if (info && info.text.length >= 2) {
        selectedText = info.text.slice(0, MAX_SELECTION_LENGTH);
        lastSelectionRect = info.rect;
        showToolbar();
      }
    }, 50);
  }, true);

  // Click anywhere on the page (not on our UI) = close everything
  document.addEventListener("click", (e) => {
    // The toolbar/panel have stopPropagation, so if we reach here it's outside our UI
    if (panel) {
      closeAll();
      return;
    }
    if (toolbar) {
      // Only close if there's no active selection anymore
      setTimeout(() => {
        const info = getSelection2();
        if (!info) removeToolbar();
      }, 60);
    }
  }, true);

  // Scroll → reposition
  let scrollRaf = null;
  window.addEventListener("scroll", () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = null;
      const info = getSelection2();
      if (info) lastSelectionRect = info.rect;
      if (toolbar) position(toolbar, "above");
      if (panel) position(panel, "below");
    });
  }, true);

  // Resize → reposition
  window.addEventListener("resize", () => {
    if (toolbar) position(toolbar, "above");
    if (panel) position(panel, "below");
  });

  // Escape key → close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (panel) { closePanel(); e.preventDefault(); }
      else if (toolbar) { removeToolbar(); e.preventDefault(); }
    }
  });

  console.log("[PageSense AI] Selection assistant loaded ✓");

  // =================================================================
  //  CSS (inlined to avoid web_accessible_resources issues)
  // =================================================================
  function getCSS() {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }

      .ps-host {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        color: #1a1a1a;
      }

      /* Make toolbar and panel receive pointer events */
      .ps-toolbar, .ps-panel {
        pointer-events: auto !important;
      }

      /* ============ TOOLBAR ============ */
      .ps-toolbar {
        position: fixed;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 6px 8px;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 999px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);
        white-space: nowrap;
        user-select: none;
        opacity: 0;
        transform: translateY(6px) scale(0.96);
        animation: ps-show 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes ps-show {
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .ps-logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, #29b6ff 0%, #0878ff 50%, #3c43e8 100%);
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        flex-shrink: 0;
        margin-right: 2px;
      }

      .ps-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 34px;
        padding: 0 10px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #1a1a1a;
        font-size: 13px;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
      }

      .ps-btn:hover {
        background: #f0f2f5;
      }

      .ps-btn-answer {
        font-weight: 600;
      }

      .ps-divider {
        width: 1px;
        height: 24px;
        background: #e0e0e0;
        margin: 0 2px;
        flex-shrink: 0;
      }

      .ps-btn-close {
        width: 32px;
        padding: 0;
        justify-content: center;
        font-size: 18px;
        color: #666;
      }

      /* ============ ANSWER PANEL ============ */
      .ps-panel {
        position: fixed;
        display: flex;
        flex-direction: column;
        width: min(520px, calc(100vw - 24px));
        min-height: 160px;
        max-height: min(400px, calc(100vh - 24px));
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 18px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.06);
        overflow: hidden;
        opacity: 0;
        transform: translateY(8px);
        animation: ps-panel-show 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes ps-panel-show {
        to { opacity: 1; transform: translateY(0); }
      }

      .ps-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 18px 12px;
        border-bottom: 1px solid #f0f0f0;
      }

      .ps-panel-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 17px;
      }

      .ps-panel-brand .ps-logo {
        width: 26px;
        height: 26px;
        font-size: 14px;
      }

      .ps-panel-close {
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #888;
        font-size: 22px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      }

      .ps-panel-close:hover {
        background: #f0f2f5;
      }

      .ps-panel-body {
        flex: 1;
        padding: 14px 20px 20px;
        overflow-y: auto;
        font-size: 14.5px;
        line-height: 1.65;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .ps-panel-body.ps-loading {
        color: transparent;
      }

      .ps-caret {
        display: inline-block;
        width: 6px;
        height: 20px;
        background: #6ea8fe;
        border-radius: 2px;
        animation: ps-blink 1s steps(2, start) infinite;
      }

      .ps-error {
        color: #d32f2f;
      }

      @keyframes ps-blink {
        to { visibility: hidden; }
      }

      /* ============ RESPONSIVE ============ */
      @media (max-width: 480px) {
        .ps-toolbar { gap: 0; padding: 4px 6px; }
        .ps-btn { padding: 0 6px; font-size: 12px; height: 30px; }
        .ps-logo { width: 24px; height: 24px; font-size: 14px; }
      }

      @media (prefers-reduced-motion: reduce) {
        .ps-toolbar, .ps-panel { animation: none; opacity: 1; transform: none; }
        .ps-caret { animation: none; }
      }
    `;
  }
})();