(() => {
  "use strict";
  if (window.__pagesenseSelectionAssistantLoaded) return;
  window.__pagesenseSelectionAssistantLoaded = true;

  const MAX_SELECTION_LENGTH = 12000;
  let selectedText = "";
  let toolbar = null;
  let panel = null;
  let answerText = null;
  let busy = false;
  let selectionTimer = null;
  let hideTimer = null;
  let lastSelectionRect = null;

  const root = document.createElement("div");
  root.id = "pagesense-selection-assistant-root";
  Object.assign(root.style, {
    all: "initial", position: "fixed", inset: "0",
    zIndex: "2147483647", pointerEvents: "none"
  });
  document.documentElement.appendChild(root);

  const shadow = root.attachShadow({ mode: "open" });
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = chrome.runtime.getURL("content_selection.css");
  shadow.appendChild(css);
  const host = document.createElement("div");
  host.className = "ps-host";
  shadow.appendChild(host);

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function selectionInfo() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.toString().trim()) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return { text: sel.toString().trim(), rect };
  }

  function place(element, preferred = "below") {
    const rect = lastSelectionRect;
    const margin = 10;
    const width = element.offsetWidth || 420;
    const height = element.offsetHeight || 55;
    let left = rect ? rect.left + rect.width / 2 - width / 2 : 20;
    let top = rect ? (preferred === "above" ? rect.top - height - 10 : rect.bottom + 10) : 80;
    if (top + height > innerHeight - margin) top = rect ? rect.top - height - 10 : innerHeight - height - margin;
    left = clamp(left, margin, innerWidth - width - margin);
    top = clamp(top, margin, innerHeight - height - margin);
    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(top)}px`;
  }

  function clearHideTimer() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
  }

  function closePanel() {
    if (panel) panel.remove();
    panel = null;
    answerText = null;
    busy = false;
  }

  function removeToolbar() {
    if (toolbar) toolbar.remove();
    toolbar = null;
  }

  function closeAll() {
    closePanel();
    removeToolbar();
  }

  async function copySelection() {
    try {
      await navigator.clipboard.writeText(selectedText);
      const copyButton = toolbar?.querySelector('[data-action="copy"]');
      if (copyButton) {
        copyButton.textContent = "✓ Copied";
        setTimeout(() => { if (copyButton.isConnected) copyButton.textContent = "▢ Copy"; }, 1200);
      }
    } catch {
      const area = document.createElement("textarea");
      area.value = selectedText;
      Object.assign(area.style, { position: "fixed", opacity: "0", left: "-9999px" });
      document.documentElement.appendChild(area);
      area.select();
      const success = document.execCommand("copy");
      area.remove();
      const copyButton = toolbar?.querySelector('[data-action="copy"]');
      if (copyButton) copyButton.textContent = success ? "✓ Copied" : "Copy failed";
      setTimeout(() => { if (copyButton?.isConnected) copyButton.textContent = "▢ Copy"; }, 1200);
    }
  }

  function openSearch() {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedText)}`, "_blank", "noopener");
    closeAll();
  }

  function openTranslate() {
    window.open(`https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(selectedText)}&op=translate`, "_blank", "noopener");
    closeAll();
  }

  function createToolbar() {
    removeToolbar();
    toolbar = el("div", "ps-toolbar");
    const logo = el("span", "ps-toolbar-logo", "◉");
    logo.setAttribute("aria-label", "PageSense AI");
    const answer = el("button", "ps-tool-button ps-answer-action", "▤  Answer");
    answer.type = "button";
    answer.dataset.action = "answer";
    answer.addEventListener("click", () => {
      removeToolbar();
      openAnswerPanel();
      askBackend("Explain the selected text clearly and concisely. Define any technical terms and give a brief example if useful.");
    });

    const copy = el("button", "ps-tool-button", "▢  Copy");
    copy.type = "button";
    copy.dataset.action = "copy";
    copy.addEventListener("click", copySelection);

    const search = el("button", "ps-tool-button", "◎  Search");
    search.type = "button";
    search.addEventListener("click", openSearch);

    const translate = el("button", "ps-tool-button", "文  Translate");
    translate.type = "button";
    translate.addEventListener("click", openTranslate);

    const divider = el("span", "ps-toolbar-divider");
    const more = el("button", "ps-tool-button ps-more-button", "⌄");
    more.type = "button";
    more.setAttribute("aria-label", "Close selection toolbar");
    more.addEventListener("click", closeAll);

    toolbar.append(logo, answer, copy, search, translate, divider, more);
    host.appendChild(toolbar);
    place(toolbar, "above");
  }

  function openAnswerPanel() {
    closePanel();
    panel = el("section", "ps-answer-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "PageSense AI answer");

    const header = el("div", "ps-answer-header");
    const brand = el("div", "ps-answer-brand");
    brand.append(el("span", "ps-toolbar-logo", "◉"), el("strong", "", "Answer"));
    const close = el("button", "ps-close-button", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close answer");
    close.addEventListener("click", closePanel);
    header.append(brand, close);

    answerText = el("div", "ps-answer-content");
    answerText.appendChild(el("span", "ps-loading-caret"));
    panel.append(header, answerText);
    host.appendChild(panel);
    place(panel, "below");
  }

  async function askBackend(question) {
    if (busy) return;
    busy = true;
    if (answerText) {
      answerText.textContent = "Thinking…";
      answerText.classList.add("ps-loading");
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: "PAGESENSE_SELECTION_CHAT",
        question,
        selected_text: selectedText,
        page_url: location.href,
        page_title: document.title || location.hostname
      });
      if (!response?.ok) throw new Error(response?.error || "Could not get an answer.");
      if (answerText) {
        answerText.classList.remove("ps-loading");
        answerText.textContent = response.answer || "No answer was returned.";
      }
    } catch (error) {
      if (answerText) {
        answerText.classList.remove("ps-loading");
        answerText.textContent = error?.message || "Could not get an answer. Please try again.";
        answerText.classList.add("ps-answer-error");
      }
    } finally {
      busy = false;
      if (panel) place(panel, "below");
    }
  }

  document.addEventListener("selectionchange", () => {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      if (panel) return;
      const info = selectionInfo();
      if (!info || info.text.length < 2) {
        removeToolbar();
        return;
      }
      selectedText = info.text.slice(0, MAX_SELECTION_LENGTH);
      lastSelectionRect = info.rect;
      createToolbar();
    }, 160);
  });

  document.addEventListener("mouseup", () => {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      if (!panel && toolbar) {
        const info = selectionInfo();
        if (!info) removeToolbar();
      }
    }, 500);
  }, true);

  document.addEventListener("mousedown", event => {
    if (root.contains(event.target)) return;
    // A click elsewhere closes the selection toolbar, but the answer panel remains until dismissed.
    if (toolbar && !panel) removeToolbar();
  }, true);

  window.addEventListener("scroll", () => {
    const info = selectionInfo();
    if (info) lastSelectionRect = info.rect;
    if (toolbar) place(toolbar, "above");
    if (panel) place(panel, "below");
  }, true);
  window.addEventListener("resize", () => {
    if (toolbar) place(toolbar, "above");
    if (panel) place(panel, "below");
  });
})();