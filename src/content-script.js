/**
 * @param {HTMLElement} parent
 * @returns {{elToReplace: HTMLElement, markdownText: string}[]}
 */
function findMarkdownCodeBlocks(parent) {
  if (!parent) return [];

  const potentialBlocks = parent.querySelectorAll("code, pre");
  if (!potentialBlocks) return [];

  /** @type {{elToReplace: HTMLElement, markdownText: string}[]} */
  const blocks = [];

  for (const block of potentialBlocks) {
    const siblingErrorDiv = block.parentElement.querySelector(".error");
    if (!siblingErrorDiv) continue;
    const markdownPrefix =
      "Unable to find source-code formatter for language: markdown.";
    if (!siblingErrorDiv.textContent.trim().startsWith(markdownPrefix))
      continue;

    let code = block.textContent;
    if (!code) continue;
    code = code.trim();

    if (block.parentElement.childElementCount === 1) {
      block.parentElement.style.padding = "1em";
      block.parentElement.style.display = "block";
    }

    siblingErrorDiv.remove();
    blocks.push({ elToReplace: block, markdownText: code });
  }

  return blocks;
}

/**
 * Render all discovered markdown code blocks within a parent element.
 * @param {HTMLElement} parent
 */
function renderMarkdown(parent = document.body) {
  const codeBlocks = findMarkdownCodeBlocks(parent);
  if (!codeBlocks || codeBlocks.length === 0) return;

  for (const block of codeBlocks) {
    let potentialContentBlock = block.elToReplace;
    let shouldCancel = false;
    while (potentialContentBlock) {
      if (potentialContentBlock.id !== "description-val") {
        potentialContentBlock = potentialContentBlock.parentElement;
        continue;
      }

      shouldCancel = potentialContentBlock.classList.contains("active");
      break;
    }

    if (shouldCancel) {
      console.debug("looks like we're in active mode, canceling");
      continue;
    }

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const summaryText = document.createElement("p");
    const container = document.createElement("div");

    summaryText.innerText =
      'Rendered Markdown (Powered by the "Markdown in Jira" Chrome Extension)';
    summaryText.style.textOverflow = "ellipsis";
    summaryText.style.overflow = "hidden";
    summaryText.style.whiteSpace = "nowrap";

    summary.append(summaryText);
    details.append(summary, container);
    details.open = true;
    details.onclick = (e) => {
      e.stopPropagation();
    };

    block.elToReplace.replaceWith(details);

    const style = document.createElement("style");
    style.innerText = `
      details:open > summary {
        padding-bottom: 1em;
        position: relative;
      }

      details > summary {
        display: flex;
        align-items: center;
      }

      details > summary:hover {
        cursor: grab;
      }

      details > summary::before {
        display: inline-block;
        content: '\\279C';
        margin-right: 1em;
        font-size: 2em;
        transition: transform 100ms;
      }

      details:open > summary::before {
        transform: rotate(90deg);
      }

      .markdown-rendered {
        padding: 1em;
        line-height: 1.6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      }

      .markdown-rendered h1,
      .markdown-rendered h2,
      .markdown-rendered h3,
      .markdown-rendered h4,
      .markdown-rendered h5,
      .markdown-rendered h6 {
        margin-top: 1em;
        margin-bottom: 0.5em;
      }

      .markdown-rendered p {
        margin-bottom: 0.75em;
      }

      .markdown-rendered pre {
        background-color: #f4f5f7;
        padding: 1em;
        border-radius: 4px;
        overflow-x: auto;
      }

      .markdown-rendered code {
        background-color: #f4f5f7;
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-size: 0.9em;
      }

      .markdown-rendered pre code {
        background-color: transparent;
        padding: 0;
      }

      .markdown-rendered blockquote {
        border-left: 4px solid #dfe1e6;
        padding-left: 1em;
        margin-left: 0;
        color: #6b778c;
      }

      .markdown-rendered table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 1em;
      }

      .markdown-rendered th,
      .markdown-rendered td {
        border: 1px solid #dfe1e6;
        padding: 0.5em;
        text-align: left;
      }

      .markdown-rendered th {
        background-color: #f4f5f7;
      }

      .markdown-rendered ul,
      .markdown-rendered ol {
        padding-left: 2em;
        margin-bottom: 0.75em;
      }

      .markdown-rendered img {
        max-width: 100%;
      }

      .markdown-rendered a {
        color: #0052cc;
        text-decoration: none;
      }

      .markdown-rendered a:hover {
        text-decoration: underline;
      }

      .markdown-rendered hr {
        border: none;
        border-top: 1px solid #dfe1e6;
        margin: 1em 0;
      }
    `;
    details.before(style);

    container.classList.add("markdown-rendered");
    container.innerHTML = marked.parse(block.markdownText);
  }
}

/**
 * Observe the DOM for dynamically added content and render markdown.
 * @param {HTMLElement} parent
 */
function observeIssueContent(parent) {
  const observer = new MutationObserver(async (changes) => {
    const promises = [];
    for (const change of changes) {
      change.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;

        if (node.nodeName !== "PRE" && node.nodeName !== "CODE") {
          promises.push(renderMarkdown(node));
          return;
        }

        promises.push(renderMarkdown(node.parentElement));
      });
    }

    await Promise.all(promises);
  });
  observer.observe(parent, { childList: true, subtree: true });
}

observeIssueContent(document.body);
renderMarkdown(document.body);
