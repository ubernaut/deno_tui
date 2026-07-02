import {
  type ComputedLayoutBox,
  htmlCssLayoutDemoBoxLabel,
  htmlCssLayoutDemoCss,
  htmlCssLayoutDemoMarkup,
  runMarkupLayoutInWorker,
  WorkerPool,
} from "../mod.ts";
import type { MarkupLayoutWorkerPayload, MarkupLayoutWorkerResult } from "../mod.ts";

const bounds = { column: 0, row: 0, width: 100, height: 30 };
const pool = new WorkerPool<MarkupLayoutWorkerPayload, MarkupLayoutWorkerResult>({
  workerUrl: new URL("./workers/markup_layout_worker.ts", import.meta.url),
  size: 1,
  name: "html-css-layout",
});

try {
  const result = await runMarkupLayoutInWorker(pool, {
    markup: htmlCssLayoutDemoMarkup,
    css: htmlCssLayoutDemoCss,
    bounds,
    cascade: {
      variables: {
        "--surface": "#101827",
        "--text": "#e5f3ff",
        "--accent": "#7dd3fc",
        "--warning": "#f59e0b",
      },
    },
  });

  console.log("# HTML/CSS Worker Layout Demo");
  console.log("");
  console.log(
    `worker-size=${pool.inspect().size} pending=${pool.inspect().pending} boxes=${result.layout.boxes.length}`,
  );
  console.log(`cache=documents:${result.cache?.documents ?? 0} stylesheets:${result.cache?.stylesheets ?? 0}`);
  console.log("");
  console.log(formatBox(result.layout.root));
} finally {
  pool.terminate();
}

function formatBox(box: ComputedLayoutBox, depth = 0): string {
  const indent = "  ".repeat(depth);
  const rect = `${box.rect.column},${box.rect.row} ${box.rect.width}x${box.rect.height}`;
  const content = `${box.contentRect.column},${box.contentRect.row} ${box.contentRect.width}x${box.contentRect.height}`;
  const lines = [
    `${indent}- ${box.tag}#${box.id} rect=${rect} content=${content} label="${htmlCssLayoutDemoBoxLabel(box)}"`,
  ];
  for (const child of box.children) {
    lines.push(formatBox(child, depth + 1));
  }
  return lines.join("\n");
}
