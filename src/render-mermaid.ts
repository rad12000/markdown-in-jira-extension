const mermaidViewHTMLPromise = fetch(
  chrome.runtime.getURL("static/mermaid.html"),
).then((res) => res.text());

type RenderMermaidOpts = {
  mermaidCode: string;
  title?: string;
  elToReplace: HTMLElement;
};

export async function renderMermaid({
  mermaidCode,
  title,
  elToReplace,
}: RenderMermaidOpts) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const summaryText = document.createElement("p");
  const div = document.createElement("div");

  summaryText.innerText = `${
    !title ? "" : title + " - A "
  }Mermaid Diagram (Powered by the "Markdown in Jira" Chrome Extension)`;
  summaryText.style.textOverflow = "ellipsis";
  summaryText.style.overflow = "hidden";
  summaryText.style.whiteSpace = "nowrap";

  summary.append(summaryText);
  details.append(summary, div);
  details.open = true;
  details.onclick = (e) => {
    e.stopPropagation();
  };

  elToReplace.replaceWith(details);

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
    `;
  details.before(style);

  let lastOpenState = details.open;
  await drawMermaidDiagram(div, mermaidCode, {
    fullScreen: false,
    enterFullScreen,
    beforeRender: () => {
      lastOpenState = details.open;
      details.open = true;
      return new Promise((resolve) => {
        resolve();
      });
    },
    afterRender: () => {
      details.open = lastOpenState;
    },
  });
}

/**
 * @param {string} code
 */
async function enterFullScreen(code: string) {
  const dialog = document.createElement("dialog");
  dialog.style.width = "95dvw";
  dialog.style.height = "95dvh";
  dialog.style.boxSizing = "border-box";
  dialog.style.padding = "1em";
  dialog.style.overflow = "hidden";
  document.body.append(dialog);
  await drawMermaidDiagram(dialog, code, {
    fullScreen: true,
    exitFullScreen: () => dialog.remove(),
  });
  dialog.showModal();
}

const windowIdToHooks: Map<
  number,
  {
    afterRender?: () => void;
    beforeRender?: () => Promise<void> | void;
    target: HTMLIFrameElement;
  }
> = new Map();
let iframeId = 0;

window.addEventListener("message", (e) => {
  if (Array.isArray(e.data) || typeof e.data !== "object") return;

  const { type, windowId } = e.data ?? {};
  if (!type || !windowId) return;
  const hooks = windowIdToHooks.get(windowId);
  if (!hooks) return;

  switch (type) {
    case "AFTER_RENDER":
      if (!hooks.afterRender) return;
      hooks.afterRender();
      break;
    case "BEFORE_RENDER":
      Promise.resolve((hooks.beforeRender ?? (() => {}))()).then(() => {
        hooks.target.contentWindow!.postMessage({ type: "BEFORE_RENDER_ACK" });
      });
      break;
  }
});

type DrawMermaidDiagramOpts = {
  fullScreen: boolean;
  exitFullScreen?: () => void;
  enterFullScreen?: (code: string) => void;
  beforeRender?: () => Promise<void>;
  afterRender?: () => Promise<void> | void;
};

async function drawMermaidDiagram(
  parent: HTMLElement,
  code: string,
  {
    fullScreen,
    enterFullScreen,
    exitFullScreen,
    afterRender,
    beforeRender,
  }: DrawMermaidDiagramOpts,
) {
  iframeId++;
  const windowId = iframeId;

  const mermaidViewHTML = (await mermaidViewHTMLPromise)
    //@ts-ignore
    .replaceAll("[[MERMAID_CODE]]", JSON.stringify(JSON.stringify(code)))
    .replaceAll("[[FULL_SCREEN_CLASS]]", fullScreen ? "full-screen" : "");

  const iframe = document.createElement("iframe");
  windowIdToHooks.set(windowId, { afterRender, target: iframe, beforeRender });

  iframe.srcdoc = mermaidViewHTML;
  iframe.style.border = "none";
  iframe.style.width = "100%";
  iframe.style.height = "100%";

  parent.append(iframe);

  if (!fullScreen) {
    parent.style.aspectRatio = "2 / 1";
  }

  iframe.onload = () => {
    iframe.contentWindow!.postMessage({ type: "WINDOW_ID", value: windowId });
    const htmlEl = iframe.contentDocument!.querySelector("html")!;
    htmlEl.style.width = "100%";
    htmlEl.style.height = "100%";

    const fullscreenButton = iframe.contentDocument!.querySelector(
      "#fullscreen",
    )! as HTMLButtonElement;
    fullscreenButton.onclick = () => {
      if (enterFullScreen) {
        enterFullScreen(code);
      }

      if (exitFullScreen) {
        exitFullScreen();
      }
    };
  };
}
