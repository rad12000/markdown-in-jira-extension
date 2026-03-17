import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

/**
 * Configure marked with syntax highlighting via highlight.js
 */
marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

interface MarkdownBlock {
  elToReplace: HTMLElement;
  markdownText: string;
}

function findMarkdownCodeBlocks(parent: HTMLElement): MarkdownBlock[] {
  if (!parent) return [];

  const potentialBlocks = parent.querySelectorAll("code, pre");
  if (!potentialBlocks) return [];

  const blocks: MarkdownBlock[] = [];

  for (const block of potentialBlocks) {
    const parentEl = block.parentElement;
    if (!parentEl) continue;

    let code = block.textContent;
    if (!code) continue;
    code = code.trim();
    const frontMatter = parseFrontMatter(code);
    if (!frontMatter) continue;
    if (frontMatter.matter["language"] !== "markdown") continue;
    code = code.substring(frontMatter.endMatterIndex);

    if (parentEl.childElementCount === 1) {
      (parentEl as HTMLElement).style.padding = "1em";
      (parentEl as HTMLElement).style.display = "block";
    }

    blocks.push({ elToReplace: block as HTMLElement, markdownText: code });
  }

  return blocks;
}

const MARKDOWN_STYLES = `
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

function parseFrontMatter(content: string): {
  matter: Record<string, string>;
  endMatterIndex: number;
} | null {
  if (!content.startsWith("---\n")) {
    return null;
  }

  const endIndex = content.indexOf("\n---", 4);
  if (endIndex === -1) {
    return null;
  }

  const keyValuePairs = content
    .substring(4, endIndex)
    .split("\n")
    .map((line) => line.split(":", 2))
    .filter((item) => item.length === 2)
    .reduce(
      (prev, cur) => {
        prev[cur[0].trim()] = cur[1].trim();
        return prev;
      },
      {} as Record<string, string>,
    );

  return {
    matter: keyValuePairs,
    endMatterIndex: endIndex + 4,
  };
}

/**
 * Render all discovered markdown code blocks within a parent element.
 */
function renderMarkdown(parent: HTMLElement = document.body): void {
  const codeBlocks = findMarkdownCodeBlocks(parent);
  if (!codeBlocks || codeBlocks.length === 0) return;

  for (const block of codeBlocks) {
    let potentialContentBlock: HTMLElement | null = block.elToReplace;
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

    const container = document.createElement("div");
    block.elToReplace.replaceWith(container);

    const style = document.createElement("style");
    style.innerText = MARKDOWN_STYLES;
    container.before(style);

    container.classList.add("markdown-rendered");
    container.innerHTML = marked.parse(block.markdownText) as string;
  }
}

/**
 * Observe the DOM for dynamically added content and render markdown.
 */
function observeIssueContent(parent: HTMLElement): void {
  const observer = new MutationObserver(async (changes) => {
    const promises: void[] = [];
    for (const change of changes) {
      change.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;

        const el = node as HTMLElement;
        if (el.nodeName !== "PRE" && el.nodeName !== "CODE") {
          promises.push(renderMarkdown(el));
          return;
        }

        if (el.parentElement) {
          promises.push(renderMarkdown(el.parentElement));
        }
      });
    }

    await Promise.all(promises);
  });
  observer.observe(parent, { childList: true, subtree: true });
}

observeIssueContent(document.body);
renderMarkdown(document.body);
