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
  let lastMouse = { x: 0, y: 0 };

  // ── Inject CSS into the page ──
  const css = document.createElement("style");
  css.textContent = `
    #ps-sel-toolbar {
      box-sizing: border-box !important;
      position: fixed !important;
      display: flex !important;
      align-items: center !important;
      gap: 3px !important;
      padding: 6px 10px !important;
      background: #ffffff !important;
      border: 1px solid #d1d5db !important;
      border-radius: 999px !important;
      box-shadow: 0 8px 30px rgba(0,0,0,0.22) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      font-size: 13px !important;
      line-height: normal !important;
      margin: 0 !important;
      white-space: nowrap !important;
      pointer-events: auto !important;
      user-select: none !important;
      animation: psSlideIn 0.15s ease-out !important;
    }
    @keyframes psSlideIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #ps-sel-toolbar .ps-logo {
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
      box-sizing: border-box !important;
      display: inline-flex !important;
      align-items: center !important;
      height: 32px !important;
      padding: 0 10px !important;
      border: none !important;
      border-radius: 7px !important;
      background: transparent !important;
      color: #1f2937 !important;
      font: 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      cursor: pointer !important;
      white-space: nowrap !important;
      margin: 0 !important;
    }
    #ps-sel-toolbar button:hover {
      background: #f3f4f6 !important;
    }
    #ps-sel-toolbar button.ps-primary {
      font-weight: 600 !important;
      color: #0284c7 !important;
    }
    #ps-sel-toolbar button.ps-primary:hover {
      background: #e0f2fe !important;
    }
    #ps-sel-toolbar .ps-divider {
      display: inline-block !important;
      width: 1px !important;
      height: 20px !important;
      background: #e5e7eb !important;
      margin: 0 3px !important;
    }

    /* ── Answer Panel ── */
    #ps-sel-panel {
      box-sizing: border-box !important;
      position: fixed !important;
      display: flex !important;
      flex-direction: column !important;
      width: 440px !important;
      max-width: calc(100vw - 20px) !important;
      min-height: 120px !important;
      max-height: 380px !important;
      background: #ffffff !important;
      border: 1px solid #d1d5db !important;
      border-radius: 14px !important;
      box-shadow: 0 12px 40px rgba(0,0,0,0.25) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      animation: psPanelIn 0.2s ease-out !important;
    }
    @keyframes psPanelIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #ps-sel-panel .ps-hdr {
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 12px 16px !important;
      border-bottom: 1px solid #f3f4f6 !important;
      background: #fafafa !important;
      margin: 0 !important;
    }
    #ps-sel-panel .ps-brand {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      color: #111827 !important;
    }
    #ps-sel-panel .ps-brand .ps-logo {
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
      box-sizing: border-box !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 28px !important;
      height: 28px !important;
      border: none !important;
      border-radius: 6px !important;
      background: transparent !important;
      color: #6b7280 !important;
      font-size: 18px !important;
      cursor: pointer !important;
      font-family: Arial, sans-serif !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    #ps-sel-panel .ps-close:hover {
      background: #e5e7eb !important;
      color: #111827 !important;
    }
    #ps-sel-panel .ps-body {
      box-sizing: border-box !important;
      display: block !important;
      flex: 1 !important;
      padding: 16px 20px 20px !important;
      overflow-y: auto !important;
      font: 16px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      font-weight: 600 !important;
      color: #111827 !important;
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
      margin: 0 !important;
    }
    #ps-sel-panel .ps-body.loading {
      color: #6b7280 !important;
      font-weight: normal !important;
      font-style: italic !important;
    }
    #ps-sel-panel .ps-body.error {
      color: #dc2626 !important;
      font-weight: normal !important;
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
      <button data-action="close" style="width:26px!important;padding:0!important;justify-content:center!important;font-size:15px!important;color:#9ca3af!important;">✕</button>
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

    // Position above or near selection
    requestAnimationFrame(() => {
      const bw = bar.offsetWidth || 340;
      const bh = bar.offsetHeight || 44;

      const refX = (lastMouse.x > 0) ? lastMouse.x : (rect.left + rect.width / 2);
      const refY = (lastMouse.y > 0) ? lastMouse.y : rect.top;

      let left = refX - bw / 2;
      let top = refY - bh - 12;

      // If offscreen at top, place below cursor/selection
      if (top < 10) {
        top = (lastMouse.y > 0) ? (lastMouse.y + 16) : (rect.bottom + 10);
      }

      left = clamp(left, 10, window.innerWidth - bw - 10);
      top = clamp(top, 10, window.innerHeight - bh - 10);

      bar.style.setProperty("left", Math.round(left) + "px", "important");
      bar.style.setProperty("top", Math.round(top) + "px", "important");
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
      const pw = p.offsetWidth || 440;
      const ph = p.offsetHeight || 180;

      const refX = (lastMouse.x > 0) ? lastMouse.x : (rect.left + rect.width / 2);
      let left = refX - pw / 2;
      let top = (lastMouse.y > 0) ? (lastMouse.y + 16) : (rect.bottom + 10);

      if (top + ph > window.innerHeight - 10) {
        top = (lastMouse.y > 0) ? (lastMouse.y - ph - 16) : (rect.top - ph - 10);
      }

      left = clamp(left, 10, window.innerWidth - pw - 10);
      top = clamp(top, 10, window.innerHeight - ph - 10);

      p.style.setProperty("left", Math.round(left) + "px", "important");
      p.style.setProperty("top", Math.round(top) + "px", "important");
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
      const msg = err?.message || "Failed to get answer.";
      if (msg.includes("context invalidated") || msg.includes("Extension context")) {
        bodyEl.textContent = "⚠️ Extension was reloaded! Please refresh this webpage (Ctrl + R / F5) to reconnect.";
      } else {
        bodyEl.textContent = msg;
      }
    } finally {
      busy = false;
    }
  }

  // ══════════════════════════════════════════════
  //  EVENTS
  // ══════════════════════════════════════════════

  // Track mouse coordinates on release
  document.addEventListener("mouseup", (e) => {
    lastMouse = { x: e.clientX, y: e.clientY };

    setTimeout(() => {
      if (panelEl) return; // don't interfere with open panel

      const info = getSelInfo();
      if (info) {
        selectedText = info.text.slice(0, 12000);
        showToolbar(info.rect);
      }
    }, 80);
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