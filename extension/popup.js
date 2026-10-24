const questionInput = document.getElementById("question");
const askButton = document.getElementById("ask-button");
const pageTitle = document.getElementById("page-title");
const status = document.getElementById("status");
const answer = document.getElementById("answer");

function renderMarkdown(text) {
    if (!text) return "";

    // 1. Escape HTML special characters
    let safe = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. Bold: **text**
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // 3. Italic: *text* (excluding already matched bold)
    safe = safe.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

    // 4. Inline code: `text`
    safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");

    // 5. Lists & Paragraphs
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
                html += "<div style='height: 6px;'></div>";
            }
        }
    }
    if (inList) {
        html += "</ul>";
    }

    return html;
}

async function getCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (tab) {
            pageTitle.textContent = tab.title || "Current webpage";
            return tab;
        }
    } catch (err) {
        console.error("Error getting active tab:", err);
    }
    pageTitle.textContent = "Current webpage";
    return null;
}

async function getPageText(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const visibleText = document.body ? document.body.innerText : "";

                // Collect mailto emails
                const mailLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
                    .map(a => a.href.replace(/^mailto:/i, "").split("?")[0].trim())
                    .filter(Boolean);

                // Collect phone numbers / tel: links
                const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
                    .map(a => a.href.replace(/^tel:/i, "").trim())
                    .filter(Boolean);

                let extra = [];
                if (mailLinks.length > 0) {
                    extra.push("Contact Emails: " + mailLinks.join(", "));
                }
                if (telLinks.length > 0) {
                    extra.push("Contact Phones: " + telLinks.join(", "));
                }

                if (extra.length > 0) {
                    return visibleText + "\n\n" + extra.join("\n");
                }
                return visibleText;
            }
        });

        if (results && results[0] && results[0].result) {
            return results[0].result;
        }
    } catch (err) {
        console.warn("Could not extract rendered DOM text from tab:", err);
    }
    return "";
}

async function handleAsk() {
    const question = questionInput.value.trim();

    if (!question) {
        status.textContent = "Please enter a question.";
        return;
    }

    askButton.disabled = true;
    status.textContent = "Reading webpage and generating answer...";
    answer.innerHTML = "";

    try {
        const tab = await getCurrentTab();

        if (!tab || !tab.url || !tab.url.startsWith("http")) {
            throw new Error("Please open a normal website (http/https) first.");
        }

        // Extract rendered page content directly from active browser tab
        const pageContent = await getPageText(tab.id);

        const response = await fetch(
            "http://127.0.0.1:8000/chat",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    question: question,
                    page_url: tab.url,
                    page_title: tab.title || "Webpage",
                    page_content: pageContent
                }),
                signal: AbortSignal.timeout(60000)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `Server error (${response.status})`);
        }

        status.textContent = "Answer:";
        answer.innerHTML = renderMarkdown(data.answer);

    } catch (error) {
        status.textContent = "Error:";
        if (error.message && (error.message.includes("Failed to fetch") || error.name === "TypeError")) {
            answer.innerHTML = "Cannot connect to backend server at <code>http://127.0.0.1:8000</code>.<br><br>Please ensure your server is running:<br><code>uvicorn main:app --reload --host 127.0.0.1 --port 8000</code>";
        } else {
            answer.textContent = error.message;
        }
    } finally {
        askButton.disabled = false;
    }
}

askButton.addEventListener("click", handleAsk);

questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        handleAsk();
    }
});

getCurrentTab();
