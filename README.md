# Markdown in Jira Extension

The `Markdown in Jira` extension renders Markdown code blocks as formatted HTML within Jira Cloud and self-hosted Jira instances. It uses the [marked](https://marked.js.org/) library to parse and render Markdown, and [highlight.js](https://highlightjs.org/) for syntax highlighting in fenced code blocks. This extension is in no way affiliated with or sponsored by [marked.js](https://marked.js.org/), or Atlassian.

# Development Setup

This project uses [TypeScript](https://www.typescriptlang.org/) and [Bun](https://bun.sh/) to bundle the extension.

### Prerequisites

- [Bun](https://bun.sh/)

### Install dependencies

```sh
bun install
```

### Build

```sh
bun run build
```

This produces a `build/` directory containing the extension ready to load:

- `manifest.json`
- `content-script.js` (single bundled file)
- `highlight-github.min.css`

### Type checking

```sh
bun run typecheck
```

### Load the extension

Load the **`build/`** directory as an unpacked extension by following the instructions found here: <https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked>.

# How it works

This extension uses [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) to interact with the DOM. It searches for `<pre>` and `<code>` blocks in the DOM, matching those containing a `markdown` code block (i.e. fenced with ` ```markdown ... ``` `). Matching `<pre>` or `<code>` elements are replaced with rendered HTML produced by the [marked](https://marked.js.org/) library, which is bundled at build time.

Changes to the DOM are monitored via a single [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver). Any time a new node is added to the `document.body`, the extension checks if any new `<pre>` or `<code>` blocks were added, and evaluates them as described above if there were.

Unfortunately, due to limitations to the [manifest.json `content_scripts.matches`](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) pattern rules, the extension matches ALL sites visited. However, there are additional glob patterns that are matched after the `content_script.matches` rules are evaluated which restrict the sites that the content scripts are actually injected into. You can find those additional rules in `content_scripts.include_globs`.
