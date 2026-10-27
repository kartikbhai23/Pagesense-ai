(() => {
  "use strict";

  // Prevent duplicate initialization if Chrome injects this script more than once.
  if (window.__pagesenseSelectionAssistantLoaded) return;
  window.__pagesenseSelectionAssistantLoaded = true;

  const MIN_SELECTION_LENGTH = 2;
  const MAX_SELECTION_LENGTH = 12000;
  const ROOT_ID = "pagesense-selection-assistant-root";

  let selectedText = "";
  let selectionButton = null;
  let panel = null;
  let questionInput = null;
  let answerElement = null;
  let statusElement = null;
  let currentView = "button";
  let requestInProgress = false;
  let hideTimer = null;

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.all = "initial";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "2147483647";
  root.style.pointerEvents = "none";
  document.documentElement.appendChild(root);

  const shadow = root.attachShadow({ mode: "open" });
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("content_selection.css");
  shadow.appendChild(styleLink);

  const host = document.createElement("div");
  host.className = "ps-host";
  shadow.appendChild(host);

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return rect;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function positionNearSelection(element) {
    const rect = getSelectionRect();
    const margin = 10;
    const width = element.offsetWidth || 170;
    const height = element.offsetHeight || 42;

    let left = rect ? rect.left + rect.width / 2 - width / 2 : window.innerWidth / 2 - width / 2;
    let top = rect ? rect.bottom + 8 : 80;

    if (top + height > window.innerHeight - margin) {
      top = rect ? rect.top - height - 8 : window.innerHeight - height - margin;
    }

    left = clamp(left, margin, window.innerWidth - width - margin);
    top = clamp(top, margin, window.innerHeight - height - margin);

    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(top)}px`;
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function removePanel() {
    if (panel) panel.remove();
    panel = null;
    questionInput = null;
    answerElement = null;
    statusElement = null;
  }

  function removeSelectionButton() {
    if (selectionButton) selectionButton.remove();
    selectionButton = null;
  }

  function closeAssistant() {
    removePanel();
    removeSelectionButton();
    currentView = "button";
  }

  function createSelectionButton() {
    removeSelectionButton();
    selectionButton = makeElement("button", "ps-selection-button", "✦ Ask a question");
    selectionButton.type = "button";
    selectionButton.setAttribute("aria-label", "Ask PageSense AI about selected text");
    selectionButton.addEventListener("mousedown", (event) => event.preventDefault());
    selectionButton.addEventListener("click", () => {
      clearHideTimer();
      removeSelectionButton();
      openQuestionPanel();
    });
    host.appendChild(selectionButton);
    positionNearSelection(selectionButton);
  }

  function openQuestionPanel() {
    removePanel();
    currentView = "question";

    panel = makeElement("section", "ps-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "PageSense AI selected-text assistant");

    const header = makeElement("div", "ps-header");
    const brand = makeElement("div", "ps-brand");
    const logo = makeElement("span", "ps-logo", "✦");
    const title = makeElement("span", "ps-title", "PageSense AI");
    brand.append(logo, title);

    const closeButton = makeElement("button", "ps-icon-button", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close assistant");
    closeButton.addEventListener("click", closeAssistant);
    header.append(brand, closeButton);

    const selectedPreview = makeElement("div", "ps-selected-preview");
    selectedPreview.textContent = selectedText.length > 500
      ? `${selectedText.slice(0, 500)}…`
      : selectedText;

    const form = makeElement("form", "ps-question-form");
    questionInput = makeElement("textarea", "ps-question-input");
    questionInput.rows = 2;
    questionInput.maxLength = 1000;
    questionInput.placeholder = "Ask about the selected text…";
    questionInput.setAttribute("aria-label", "Your question");
    questionInput.required = true;

    const sendButton = makeElement("button", "ps-send-button", "Ask");
    sendButton.type = "submit";
    form.append(questionInput, sendButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = questionInput.value.trim();
      if (!question || requestInProgress) return;
      await askBackend(question);
    });

    statusElement = makeElement("div", "ps-status", "");
    panel.append(header, selectedPreview, form, statusElement);
    host.appendChild(panel);
    positionNearSelection(panel);
    questionInput.focus({ preventScroll: true });
  }

  function showAnswerView(question, answer) {
    if (!panel) return;
    currentView = "answer";
    panel.replaceChildren();

    const header = makeElement("div", "ps-header");
    const brand = makeElement("div", "ps-brand");
    brand.append(
      makeElement("span", "ps-logo", "✦"),
      makeElement("span", "ps-title", "PageSense AI")
    );

    const closeButton = makeElement("button", "ps-icon-button", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close assistant");
    closeButton.addEventListener("click", closeAssistant);
    header.append(brand, closeButton);

    const questionBlock = makeElement("div", "ps-question-asked");
    questionBlock.appendChild(makeElement("div", "ps-small-label", "YOUR QUESTION"));
    questionBlock.appendChild(makeElement("div", "ps-question-text", question));

    const answerBlock = makeElement("div", "ps-answer-block");
    answerBlock.appendChild(makeElement("div", "ps-small-label", "ANSWER"));
    answerElement = makeElement("div", "ps-answer-text", answer);
    answerBlock.appendChild(answerElement);

    const followupForm = makeElement("form", "ps-question-form ps-followup-form");
    questionInput = makeElement("textarea", "ps-question-input");
    questionInput.rows = 2;
    questionInput.maxLength = 1000;
    questionInput.placeholder = "Ask a follow-up…";
    questionInput.setAttribute("aria-label", "Ask a follow-up question");
    questionInput.required = true;

    const sendButton = makeElement("button", "ps-send-button", "Send");
    sendButton.type = "submit";
    followupForm.append(questionInput, sendButton);
    followupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const followup = questionInput.value.trim();
      if (!followup || requestInProgress) return;
      await askBackend(followup);
    });

    statusElement = makeElement("div", "ps-status", "");
    panel.append(header, questionBlock, answerBlock, followupForm, statusElement);
    positionNearSelection(panel);
    panel.style.top = `${clamp(parseFloat(panel.style.top) || 80, 10, window.innerHeight - Math.min(panel.offsetHeight, window.innerHeight - 20) - 10)}px`;
    questionInput.focus({ preventScroll: true });
  }

  async function askBackend(question) {
    if (requestInProgress) return;
    requestInProgress = true;

    if (statusElement) statusElement.textContent = "Thinking…";
    if (questionInput) questionInput.disabled = true;

    const message = {
      type: "PAGESENSE_SELECTION_CHAT",
      question,
      selected_text: selectedText,
      page_url: location.href,
      page_title: document.title || location.hostname
    };

    try {
      const response = await chrome.runtime.sendMessage(message);
      if (!response || !response.ok) {
        throw new Error(response?.error || "The backend did not return an answer.");
      }
      showAnswerView(question, response.answer || "No answer was returned.");
    } catch (error) {
      if (statusElement) {
        statusElement.textContent = error?.message || "Could not get an answer. Please try again.";
        statusElement.classList.add("ps-error");
      }
      if (questionInput) {
        questionInput.disabled = false;
        questionInput.focus({ preventScroll: true });
      }
    } finally {
      requestInProgress = false;
    }
  }

  let selectionTimer = null;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      if (currentView !== "button" || panel) return;
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";

      if (text.length < MIN_SELECTION_LENGTH || !getSelectionRect()) {
        removeSelectionButton();
        return;
      }

      selectedText = text.slice(0, MAX_SELECTION_LENGTH);
      createSelectionButton();
    }, 180);
  });

  document.addEventListener("mousedown", (event) => {
    if (!root.contains(event.target)) {
      // Do not immediately hide the button on the mouseup that created a selection.
      clearHideTimer();
    }
  }, true);

  document.addEventListener("mouseup", () => {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      if (currentView === "button" && selectionButton) {
        const selection = window.getSelection();
        if (!selection || !selection.toString().trim()) removeSelectionButton();
      }
    }, 500);
  }, true);

  window.addEventListener("scroll", () => {
    if (selectionButton) positionNearSelection(selectionButton);
    if (panel) positionNearSelection(panel);
  }, true);

  window.addEventListener("resize", () => {
    if (selectionButton) positionNearSelection(selectionButton);
    if (panel) positionNearSelection(panel);
  });
})();