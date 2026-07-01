// Copyright 2023 Im-Beast. MIT license.

import type { ComputedLayoutBox, LayoutSolver } from "../src/layout/mod.ts";
import { createMarkupLayout } from "../src/markup/mod.ts";
import type { Rectangle } from "../src/types.ts";

export const HTML_CSS_LAYOUT_WINDOW_ID = "htmlLayout";
export const HTML_CSS_LAYOUT_OPTION_ID = "html-css-layout";

export const htmlCssLayoutDemoMarkup = `
  <window id="layout-demo" class="shell">
    <menu-bar id="layout-toolbar">File View Theme Help</menu-bar>
    <div id="layout-stage" class="stage">
      <panel id="metric-cpu" class="metric primary">CPU flex item</panel>
      <panel id="metric-gpu" class="metric">GPU flex item</panel>
      <panel id="metric-net" class="metric">NET flex item</panel>
      <panel id="metric-disk" class="metric">DISK flex item</panel>
      <panel id="layout-badge" class="badge">absolute inset</panel>
    </div>
    <statusbar id="layout-footer">resize the window: cards wrap, badge stays top-right</statusbar>
  </window>
`;

export const htmlCssLayoutDemoCss = `
  window {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: 1;
    padding: 1;
    background: var(--surface);
    color: var(--text);
  }

  menu-bar,
  statusbar {
    height: 1;
  }

  #layout-stage {
    display: flex;
    flex-flow: row wrap;
    align-items: start;
    flex: 1;
    gap: 1;
    padding: 1;
    position: relative;
    overflow: auto;
  }

  .metric {
    width: 18;
    height: 5;
    padding: 1;
    border: 1 single var(--accent);
  }

  .primary {
    width: 22;
  }

  .badge {
    position: absolute;
    top: 1;
    right: 2;
    width: 20;
    height: 3;
    padding: 1;
    border: 1 single var(--warning);
  }

  @media (max-width: 58) {
    window {
      gap: 0;
      padding: 0;
    }

    #layout-stage {
      gap: 1;
      padding: 1;
    }

    .metric {
      width: 14;
      height: 4;
    }

    .primary {
      width: 16;
    }

    .badge {
      right: 1;
      width: 16;
    }
  }
`;

export interface HtmlCssLayoutDemoOptions {
  solver?: LayoutSolver;
}

export function createHtmlCssLayoutDemo(bounds: Rectangle, options: HtmlCssLayoutDemoOptions = {}) {
  return createMarkupLayout({
    markup: htmlCssLayoutDemoMarkup,
    css: htmlCssLayoutDemoCss,
    bounds,
    solver: options.solver,
    cascade: {
      variables: {
        "--surface": "#101827",
        "--text": "#e5f3ff",
        "--accent": "#7dd3fc",
        "--warning": "#f59e0b",
      },
    },
    widgets: false,
  });
}

export function htmlCssLayoutDemoBoxLabel(box: ComputedLayoutBox): string {
  switch (box.id) {
    case "layout-demo":
      return "window display:flex column";
    case "layout-toolbar":
      return "menu-bar height:1";
    case "layout-stage":
      return "display:flex; flex-flow:row wrap";
    case "metric-cpu":
      return box.rect.width <= 16 ? "primary @media width:16" : "primary width:22";
    case "metric-gpu":
      return box.rect.width <= 14 ? "card @media width:14" : "card width:18";
    case "metric-net":
      return box.rect.width <= 14 ? "card @media width:14" : "card width:18";
    case "metric-disk":
      return box.rect.width <= 14 ? "card @media width:14" : "card width:18";
    case "layout-badge":
      return "position:absolute; top:1; right:2";
    case "layout-footer":
      return "statusbar";
    default:
      return `${box.tag}#${box.id}`;
  }
}
