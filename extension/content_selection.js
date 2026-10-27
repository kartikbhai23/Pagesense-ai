// PageSense AI - Text Selection Toolbar
// Select any text on a webpage to get Answer, Copy, Search, Translate options
(() => {
  "use strict";

  // Prevent double-loading
  if (window.__pagesenseSelToolbar) return;
  window.__pagesenseSelToolbar = true;

  // ── State ──
  let selectedText = "";
  let toolbarEl = null;
  let panelEl = null;
  let busy = false;

  // ── Inject CSS into the page ──
  const css = document.createElement("style");
  css.textContent = `
    #ps-sel-toolbar {
      all: initial !important;
      position: fixed !important;
      display: flex !important;
      align-items: center !important;
      gap: 2px !important;
      padding: 6px 10px !important;
      background: #fff !important;
      border: 1px solid #ddd !important;
      border-radius: 999px !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      font-size: 13px !important;
      white-space: nowrap !important;
      pointer-events: auto !important;
      user-select: none !important;
      animation: psSlideIn 0.15s ease-out !important;
    }
    @keyframes psSlideIn {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #ps-sel-toolbar .ps-logo {
      all: initial !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 26px !important;
      height: 26px !important;
      border-radius: 50% !important;
      background: linear-gradient(135deg, #29b6ff, #0878ff, #3c43e8) !important;
      color: #fff !important;
      font-size: 14px !important;
      font-weight: bold !important;
      margin-right: 4px !important;
      flex-shrink: 0 !important;
    }
    #ps-sel-toolbar button {
      all: initial !important;
      display: inline-flex !important;
      align-items: center !important;
      height: 32px !important;
      padding: 0 10px !important;
      border: none !important;
      border-radius: 7px !important;
      background: transparent !important;
      color: #222 !important;
      font: 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      cursor: pointer !important;
      white-space: nowrap !important;
    }
    #ps-sel-toolbar button:hover {
      background: #f0f2f5 !important;
    }
    #ps-sel-toolbar button.ps-primary {
      font-weight: 600 !important;
    }
    #ps-sel-toolbar .ps-divider {
      all: initial !important;
      display: inline-block !important;
      width: 1px !important;
      height: 22px !important;
      background: #e0e0e0 !important;
      margin: 0 3px !important;
    }

    /* ── Answer Panel ── */
    #ps-sel-panel {
      all: initial !important;
      position: fixed !important;
      display: flex !important;
      flex-direction: column !important;
      width: 500px !important;
      max-width: calc(100vw - 20px) !important;
      min-height: 150px !important;
      max-height: 420px !important;
      background: #fff !important;
      border: 1px solid #ddd !important;
      border-radius: 16px !important;
      box-shadow: 0 8px 36px rgba(0,0,0,0.2) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      overflow: hidden !important;
      animation: psPanelIn 0.2s ease-out !important;
    }
    @keyframes psPanelIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #ps-sel-panel .ps-hdr {
      all: initial !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 14px 16px 10px !important;
      border-bottom: 1px solid #f0f0f0 !important;
      font-family: inherit !important;
    }
    #ps-sel-panel .ps-brand {
      all: initial !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      color: #222 !important;
      font-family: inherit !important;
    }
    #ps-sel-panel .ps-brand .ps-logo {
      all: initial !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 24px !important;
      height: 24px !important;
      border-radius: 50% !important;
      background: linear-gradient(135deg, #29b6ff, #0878ff, #3c43e8) !important;
      color: #fff !important;
      font-size: 13px !important;
      font-weight: bold !important;
    }
    #ps-sel-panel .ps-close {
      all: initial !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 28px !important;
      height: 28px !important;
      border: none !important;
      border-radius: 6px !important;
      background: transparent !important;
      color: #888 !important;
      font-size: 20px !important;
      cursor: pointer !important;
      font-family: Arial, sans-serif !important;
    }
    #ps-sel-panel .ps-close:hover { background: #f0f2f5 !important; }
    #ps-sel-panel .ps-body {
      all: initial !important;
      display: block !important;
      flex: 1 !important;
      padding: 12px 18px 18px !important;
      overflow-y: auto !important;
      font: 14px/1.7 -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      color: #222 !important;
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
    }
    #ps-sel-panel .ps-body.loading {
      color: #aaa !important;
      font-style: italic !important;
    }
    #ps-sel-panel .ps-body.error {
      color: #d32f2f !important;
    }
  `;
  document.head.appendChild(css);

  // ── Helpers ──
  function getSelInfo() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const text = sel.toString().trim();
    if (text.length < 2) return null;
    try {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) return null;
      return { text, rect };
    } catch { return null; }
  }

  function removeToolbar() {
    if (toolbarEl) { toolbarEl.remove(); toolbarEl = null; }
  }

  function removePanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
    busy = false;
  }

  function removeAll() {
    removeToolbar();
    removePanel();
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // ── Show Toolbar ──
  function showToolbar(rect) {
    removeToolbar();

    const bar = document.createElement("div");
    bar.id = "ps-sel-toolbar";

    bar.innerHTML = `
      <span class="ps-logo">◉</span>
      <button class="ps-primary" data-action="answer">💬 Answer</button>
      <button data-action="copy">📋 Copy</button>
      <button data-action="search">🔍 Search</button>
      <button data-action="translate">🌐 Translate</button>
      <span class="ps-divider"></span>
      <button data-action="close" style="width:28px!important;padding:0!important;justify-content:center!important;font-size:16px!important;color:#999!important;">✕</button>
    `;

    // Handle button clicks
    bar.addEventListener("mousedown", e => e.stopPropagation());
    bar.addEventListener("click", e => {
      e.stopPropagation();
      const action = e.target.closest("button")?.dataset?.action;
      if (!action) return;

      if (action === "answer") {
        removeToolbar();
        showPanel(rect);
        askAI();
      } else if (action === "copy") {
        navigator.clipboard.writeText(selectedText).catch(() => {});
        const btn = e.target.closest("button");
        btn.textContent = "✓ Copied";
        setTimeout(() => { if (btn.isConnected) btn.textContent = "📋 Copy"; }, 1200);
      } else if (action === "search") {
        window.open("https://www.google.com/search?q=" + encodeURIComponent(selectedText), "_blank");
        removeAll();
      } else if (action === "translate") {
        window.open("https://translate.google.com/?sl=auto&tl=en&text=" + encodeURIComponent(selectedText), "_blank");
        removeAll();
      } else if (action === "close") {
        removeAll();
      }
    });

    document.body.appendChild(bar);
    toolbarEl = bar;

    // Position above selection
    requestAnimationFrame(() => {
      const bw = bar.offsetWidth;
      const bh = bar.offsetHeight;
      let left = rect.left + rect.width / 2 - bw / 2;
      let top = rect.top - bh - 10;
      if (top < 8) top = rect.bottom + 10;
      left = clamp(left, 8, innerWidth - bw - 8);
      top = clamp(top, 8, innerHeight - bh - 8);
      bar.style.left = Math.round(left) + "px";
      bar.style.top = Math.round(top) + "px";
    });
  }

  // ── Show Answer Panel ──
  function showPanel(rect) {
    removePanel();

    const p = document.createElement("div");
    p.id = "ps-sel-panel";

    p.innerHTML = `
      <div class="ps-hdr">
        <div class="ps-brand"><span class="ps-logo">◉</span> Answer</div>
        <button class="ps-close">×</button>
      </div>
      <div class="ps-body loading">Thinking...</div>
    `;

    p.querySelector(".ps-close").addEventListener("click", e => {
      e.stopPropagation();
      removePanel();
    });
    p.addEventListener("mousedown", e => e.stopPropagation());
    p.addEventListener("click", e => e.stopPropagation());

    document.body.appendChild(p);
    panelEl = p;

    // Position below selection
    requestAnimationFrame(() => {
      const pw = p.offsetWidth;
      const ph = p.offsetHeight;
      let left = rect.left + rect.width / 2 - pw / 2;
      let top = rect.bottom + 10;
      if (top + ph > innerHeight - 8) top = rect.top - ph - 10;
      left = clamp(left, 8, innerWidth - pw - 8);
      top = clamp(top, 8, innerHeight - ph - 8);
      p.style.left = Math.round(left) + "px";
      p.style.top = Math.round(top) + "px";
    });
  }

  // ── Ask Backend ──
  async function askAI() {
    if (busy) return;
    busy = true;
    const bodyEl = panelEl?.querySelector(".ps-body");
    if (!bodyEl) return;

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "PAGESENSE_SELECTION_CHAT",
        question: "STRICT REQUIREMENT: Provide ONLY the single correct option or direct answer (e.g., 'A', 'Option B', or the single correct word/phrase). Absolutely DO NOT provide any explanation, reasoning, preamble, or notes. Output ONLY the answer itself.",
        selected_text: selectedText,
        page_url: location.href,
        page_title: document.title || ""
      });

      if (!resp?.ok) throw new Error(resp?.error || "No answer received.");
      bodyEl.className = "ps-body";
      bodyEl.textContent = resp.answer;
    } catch (err) {
      bodyEl.className = "ps-body error";
      bodyEl.textContent = err?.message || "Failed to get answer.";
    } finally {
      busy = false;
    }
  }

  // ══════════════════════════════════════════════
  //  EVENTS
  // ══════════════════════════════════════════════

  // After user finishes selecting text → show toolbar
  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      if (panelEl) return; // don't interfere with open panel

      const info = getSelInfo();
      if (info) {
        selectedText = info.text.slice(0, 12000);
        showToolbar(info.rect);
      }
    }, 100);
  });

  // Click anywhere outside → close
  document.addEventListener("mousedown", (e) => {
    // Don't close if clicking inside our toolbar or panel
    const t = e.target;
    if (t && (t.closest("#ps-sel-toolbar") || t.closest("#ps-sel-panel"))) return;

    if (panelEl) { removeAll(); return; }
    if (toolbarEl) { removeToolbar(); }
  });

  // Escape → close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (panelEl) removePanel();
      else if (toolbarEl) removeToolbar();
    }
  });

  console.log("[PageSense AI] ✅ Selection toolbar ready!");
})();