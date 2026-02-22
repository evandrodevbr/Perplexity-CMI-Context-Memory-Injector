// ==UserScript==
// @name         Perplexity Context Memory Injector
// @namespace    http://evandro.dev.br/
// @version      1.6.0
// @description  Gerenciador de memórias com interface nativa da Perplexity (Lexical Append + Safe Declarative Context).
// @author       Senior Frontend Lead
// @match        https://www.perplexity.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // --- Logging ---
  const DEBUG = true;
  const log = (action, data = "") => {
    if (DEBUG)
      console.log(
        `%c[PPLX-Memory::${action}]`,
        "color: #22d3ee; font-weight: bold;",
        data,
      );
  };

  log(
    "Boot",
    "Script 1.6.0 initialized. Native UI/UX + English translation applied.",
  );

  // --- Global State ---
  let memories = GM_getValue("pplx_memories", []);
  let isPanelOpen = false;
  let isSubmitting = false;

  // --- Panel Setup (Shadow DOM) ---
  const container = document.createElement("div");
  container.id = "pplx-memory-panel-container";
  container.style.position = "fixed";
  container.style.bottom = "24px";
  container.style.left = "84px";
  container.style.zIndex = "999999";
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: "open" });

  // Perplexity-inspired design system colors and styles
  const styles = `
    *, *::before, *::after { box-sizing: border-box; }
    :host {
      --pplx-bg-primary: #1f1f1f; /* Main background */
      --pplx-bg-secondary: #282828; /* Input fields, hover states */
      --pplx-fg-primary: #e8e8e8; /* Main text */
      --pplx-fg-secondary: #a0a0a0; /* Hints, placeholders, icons */
      --pplx-border: #3a3a3a; /* Subtle borders */
      --pplx-accent: #22d3ee; /* Cyan accent for focus/active states */
      --pplx-danger: #ef4444; /* Red for delete actions */
      --pplx-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --pplx-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-family: var(--pplx-font-sans);
      font-size: 14px;
      color: var(--pplx-fg-primary);
    }

    /* Light mode override - though prints are dark, good practice to have */
    @media (prefers-color-scheme: light) {
      :host {
        --pplx-bg-primary: #ffffff;
        --pplx-bg-secondary: #f5f5f5;
        --pplx-fg-primary: #111111;
        --pplx-fg-secondary: #666666;
        --pplx-border: #e0e0e0;
      }
    }

    .panel {
      display: flex;
      flex-direction: column;
      width: 450px;
      max-height: 650px;
      background: var(--pplx-bg-primary);
      border: 1px solid var(--pplx-border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
      transform-origin: bottom left;
    }
    .panel.hidden {
      opacity: 0;
      transform: scale(0.98) translateY(10px);
      pointer-events: none;
      visibility: hidden;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--pplx-border);
    }
    header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--pplx-fg-primary);
    }
    header .count {
      margin-left: 8px;
      font-size: 13px;
      color: var(--pplx-fg-secondary);
      font-weight: normal;
    }

    .memory-list {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .memory-item {
      display: flex;
      gap: 16px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--pplx-border);
      align-items: flex-start;
      transition: background 0.15s ease;
    }
    .memory-item:hover {
      background: var(--pplx-bg-secondary);
    }
    .memory-content {
      flex: 1;
      font-family: var(--pplx-font-mono);
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--pplx-fg-primary);
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
      padding-top: 2px;
    }

    .input-group {
      padding: 20px;
      border-top: 1px solid var(--pplx-border);
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--pplx-bg-primary);
    }

    textarea {
      width: 100%;
      height: 140px;
      resize: vertical;
      background: var(--pplx-bg-secondary);
      border: 1px solid transparent;
      color: var(--pplx-fg-primary);
      padding: 12px;
      border-radius: 8px;
      font-family: var(--pplx-font-mono);
      font-size: 13px;
      line-height: 1.5;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    textarea:focus-visible {
      outline: none;
      border-color: var(--pplx-accent);
      box-shadow: 0 0 0 1px var(--pplx-accent);
    }
    textarea::placeholder {
      color: var(--pplx-fg-secondary);
      opacity: 0.7;
    }

    .hint {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--pplx-fg-secondary);
      line-height: 1.4;
    }
    .hint svg {
      flex-shrink: 0;
      color: var(--pplx-accent);
    }

    button {
      background: transparent;
      border: none;
      color: var(--pplx-fg-secondary);
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    button:hover {
      background: var(--pplx-bg-secondary);
      color: var(--pplx-fg-primary);
    }
    button.icon-close {
      padding: 6px;
      margin-right: -6px;
    }
    button.icon-delete:hover {
      color: var(--pplx-danger);
      background: rgba(239, 68, 68, 0.1);
    }
    button.primary {
      background: var(--pplx-accent);
      color: #000; /* Black text on cyan accent for contrast */
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
      width: 100%;
      justify-content: center;
    }
    button.primary:hover {
      opacity: 0.9;
      background: var(--pplx-accent);
      color: #000;
    }
    button.primary:active {
      transform: translateY(1px);
    }

    /* Custom Checkbox styling */
    .checkbox-wrapper {
      position: relative;
      width: 18px;
      height: 18px;
    }
    input[type="checkbox"] {
      opacity: 0;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      margin: 0;
      cursor: pointer;
      z-index: 1;
    }
    .checkbox-styled {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--pplx-bg-secondary);
      border: 1px solid var(--pplx-border);
      border-radius: 4px;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    input[type="checkbox"]:checked + .checkbox-styled {
      background: var(--pplx-accent);
      border-color: var(--pplx-accent);
    }
    input[type="checkbox"]:focus-visible + .checkbox-styled {
      box-shadow: 0 0 0 2px var(--pplx-bg-primary), 0 0 0 4px var(--pplx-accent);
    }
    .checkbox-styled svg {
      color: #000;
      opacity: 0;
      transform: scale(0.8);
      transition: all 0.15s ease;
    }
    input[type="checkbox"]:checked + .checkbox-styled svg {
      opacity: 1;
      transform: scale(1);
    }

    /* Scrollbar styling */
    .memory-list::-webkit-scrollbar {
      width: 8px;
    }
    .memory-list::-webkit-scrollbar-track {
      background: transparent;
    }
    .memory-list::-webkit-scrollbar-thumb {
      background: var(--pplx-border);
      border-radius: 4px;
      border: 2px solid var(--pplx-bg-primary);
    }
    .memory-list::-webkit-scrollbar-thumb:hover {
      background: var(--pplx-fg-secondary);
    }
  `;

  const renderPanel = () => {
    shadow.innerHTML = `<style>${styles}</style>`;

    const panel = document.createElement("section");
    panel.className = `panel ${isPanelOpen ? "" : "hidden"}`;
    // Use standard HTML hidden attribute for better accessibility/state
    panel.hidden = !isPanelOpen;

    // --- Header ---
    const header = document.createElement("header");
    const activeCount = memories.filter((m) => m.active).length;
    header.innerHTML = `
      <h2>Secure Memory Context<span class="count">(${activeCount} active)</span></h2>
    `;

    const closeBtn = document.createElement("button");
    closeBtn.className = "icon-close";
    // Use an SVG for the close icon for sharper rendering
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    closeBtn.onclick = () => {
      isPanelOpen = false;
      renderPanel();
    };
    header.appendChild(closeBtn);

    // --- Memory List ---
    const ul = document.createElement("ul");
    ul.className = "memory-list";

    if (memories.length === 0) {
      const emptyState = document.createElement("li");
      emptyState.style.padding = "32px 20px";
      emptyState.style.textAlign = "center";
      emptyState.style.color = "var(--pplx-fg-secondary)";
      emptyState.style.fontStyle = "italic";
      emptyState.textContent = "No memories added yet.";
      ul.appendChild(emptyState);
    } else {
      const fragment = document.createDocumentFragment();
      memories.forEach((mem, index) => {
        const li = document.createElement("li");
        li.className = "memory-item";

        // Custom checkbox structure
        const checkboxWrapper = document.createElement("div");
        checkboxWrapper.className = "checkbox-wrapper";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `mem-check-${index}`;
        checkbox.checked = mem.active;
        checkbox.onchange = (e) => {
          memories[index].active = e.target.checked;
          GM_setValue("pplx_memories", memories);
          renderPanel();
        };

        const checkboxStyled = document.createElement("label");
        checkboxStyled.className = "checkbox-styled";
        checkboxStyled.setAttribute("for", `mem-check-${index}`);
        checkboxStyled.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(checkboxStyled);

        const content = document.createElement("div");
        content.className = "memory-content";
        content.textContent = mem.text;

        const controls = document.createElement("div");
        controls.className = "controls";

        const delBtn = document.createElement("button");
        delBtn.className = "icon-delete";
        delBtn.title = "Delete memory";
        delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        delBtn.onclick = () => {
          if (confirm("Are you sure you want to delete this memory block?")) {
            memories.splice(index, 1);
            GM_setValue("pplx_memories", memories);
            renderPanel();
          }
        };

        controls.appendChild(checkboxWrapper);
        controls.appendChild(delBtn);
        li.appendChild(checkboxWrapper);
        li.appendChild(content);
        li.appendChild(controls);
        fragment.appendChild(li);
      });
      ul.appendChild(fragment);
    }

    // --- Input Group (Footer) ---
    const inputGroup = document.createElement("div");
    inputGroup.className = "input-group";

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
      <span>Use safe, declarative structures like <code>[SYSTEM]</code> blocks. Avoid ambiguous separators (e.g., <code>---</code>) or imperative "ignore" commands to prevent injection detection.</span>
    `;

    const textarea = document.createElement("textarea");
    // Updated placeholder with the consolidated safe prompt structure in English
    textarea.placeholder = `[SYSTEM]
You will act as a Precision Technical Assistant, Senior Software Engineer, and Technical Writer proficient in Markdown.
API Temperature: 0.2 (code & facts) / 0.3 (conceptual analysis).

[ABSOLUTE CONSTRAINTS]
- Never invent data or references; state "no official documentation confirmed" when applicable.
- Never use acronyms without defining them on first occurrence.
- Never deliver responses without inline source citations: [Source: Name/DOI/URL].
- Never use entertainment news sources as a technical basis.
- Never generate code without first describing the existing code context provided.
- Never produce destructive operations without issuing an explicit warning block first.
...`;

    const addBtn = document.createElement("button");
    addBtn.className = "primary";
    addBtn.textContent = "Add Safe Memory Block";
    addBtn.onclick = () => {
      const text = textarea.value.trim();
      if (text) {
        memories.push({ id: Date.now(), text, active: true });
        GM_setValue("pplx_memories", memories);
        textarea.value = "";
        renderPanel();
        // Scroll to bottom of list to show new item
        setTimeout(() => {
          const list = shadow.querySelector(".memory-list");
          if (list) list.scrollTop = list.scrollHeight;
        }, 0);
      }
    };

    inputGroup.appendChild(hint);
    inputGroup.appendChild(textarea);
    inputGroup.appendChild(addBtn);

    panel.appendChild(header);
    panel.appendChild(ul);
    panel.appendChild(inputGroup);

    shadow.appendChild(panel);
  };

  // --- Native Sidebar Button Injection ---
  const injectSidebarButton = () => {
    if (document.getElementById("pplx-memory-toggle-btn")) return;

    const userProfileContainer = document.querySelector(
      ".gap-md.py-sm.mt-auto",
    );
    if (!userProfileContainer) return;

    const btn = document.createElement("a");
    btn.id = "pplx-memory-toggle-btn";
    // Updated classes to match current Perplexity sidebar button styles more closely
    btn.className =
      "reset interactable-alt p-sm gap-two group flex w-full flex-col items-center justify-center rounded-lg cursor-pointer";

    btn.innerHTML = `
      <div class="grid size-8 place-items-center border-subtlest ring-subtlest divide-subtlest bg-transparent">
        <div class="duration-normal size-full rounded-md ease-out [grid-area:1/-1] opacity-0 group-hover:opacity-100 border-subtlest ring-subtlest divide-subtlest bg-subtle"></div>
        <div class="relative [grid-area:1/-1] inline-flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="inline-flex fill-current shrink-0 tabler-icon shrink-0 duration-normal ease text-quiet group-hover:text-text" width="22" height="22" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />
            <path d="M10 10l-2 2" />
            <path d="M14 10l2 2" />
            <path d="M12 13v3" />
          </svg>
        </div>
      </div>
      <div class="w-full text-ellipsis leading-[1.1] font-sans text-2xs font-normal text-quiet font-medium text-xs select-none text-center selection:bg-super/50 selection:text-foreground dark:selection:bg-super/10 dark:selection:text-super line-clamp-2 bg-transparent block group-hover:text-text">Memory</div>
    `;

    btn.onclick = (e) => {
      e.preventDefault();
      isPanelOpen = !isPanelOpen;
      renderPanel();
    };

    userProfileContainer.parentNode.insertBefore(btn, userProfileContainer);
  };

  // Keep trying to inject the button in case of dynamic updates
  setInterval(injectSidebarButton, 1000);

  // --- Secondary Prevention (Ghost Events) ---
  const blockGhostEvents = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const editor = e.target.closest("#ask-input");
      if (editor && memories.filter((m) => m.active).length > 0) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  };

  document.addEventListener("keypress", blockGhostEvents, { capture: true });
  document.addEventListener("keyup", blockGhostEvents, { capture: true });

  // --- Injection Engine (Lexical Append + Safe Declarative Context) ---
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.__pplxInjected) return;

      if (e.key === "Enter" && !e.shiftKey) {
        const editor = e.target.closest("#ask-input");
        if (!editor) return;

        const activeMemories = memories.filter((m) => m.active);
        if (activeMemories.length === 0) return;

        const originalText = editor.innerText.trim();
        if (!originalText) return;

        if (isSubmitting) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        isSubmitting = true;

        const memoriesText = activeMemories.map((m) => m.text).join("\n\n");
        // Escape HTML characters in the memory text to prevent rendering issues in the HTML payload
        const escapedMemoriesHtml = memoriesText
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
          .replace(/\n/g, "<br>");

        // Translated safe semantic framing tag.
        const safeTag = "Additional User Context:";

        // Plain Text Payload: Double CRLF + Safe Tag + No special trailing separators
        const plainPayload = `\r\n\r\n\r\n**[${safeTag}]**\r\n${memoriesText}\r\n\r\n`;

        // HTML Payload: Preserved structural padding, clean ending. Used escaped HTML for content.
        const htmlPayload = `<p>&nbsp;</p><p>&nbsp;</p><p><strong>[${safeTag}]</strong></p><p>${escapedMemoriesHtml}</p><p>&nbsp;</p>`;

        editor.focus();

        // Ensure cursor is at the absolute end
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.collapse(false);
        }

        // Create Multi-MIME DataTransfer
        const dt = new DataTransfer();
        dt.setData("text/plain", plainPayload);
        dt.setData("text/html", htmlPayload);

        // Dispatch Paste Event
        const pasteEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        });

        editor.dispatchEvent(pasteEvent);
        log(
          "Inject",
          "Memory block appended with safe semantic framing (English).",
        );

        // Trigger native submit
        setTimeout(() => {
          const submitBtn = document.querySelector(
            'button[aria-label="Submit"]',
          );

          if (submitBtn && !submitBtn.disabled) {
            submitBtn.click();
            log("Submit", "Native Submit button triggered.");
          } else {
            log("Error", "Submit button not found or disabled.");
          }

          // Release lock
          setTimeout(() => {
            isSubmitting = false;
          }, 1000);
        }, 100);
      }
    },
    { capture: true },
  );

  // Initial Boot
  renderPanel();
})();
