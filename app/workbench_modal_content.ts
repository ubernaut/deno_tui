// Copyright 2023 Im-Beast. MIT license.
import type { ModalContent } from "../src/components/modal.ts";
import { workbenchHelpRows, type WorkbenchHelpRowsOptions } from "../src/app/workbench_help.ts";

/** Builds the generic workbench modal demo content shared by terminal and browser adapters. */
export function workbenchDemoModalContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: "Confirm Action",
    tone: "confirm",
    body: web
      ? [
        "Modal windows sit above the browser workbench and use the same renderer-neutral controller as terminal modals.",
        "Keyboard focus is trapped while the modal is open. Use Tab, arrows, Enter, Escape, or click an action.",
      ]
      : [
        "Modal windows sit above the workspace and can contain text, menus, warnings, errors, and buttons.",
        "Keyboard focus is trapped while the modal is open. Use Tab, arrows, Enter, Escape, or click an action.",
      ],
    actions: [
      { id: "cancel", label: "Cancel" },
      { id: "details", label: "Details" },
      { id: "confirm", label: "Confirm", default: true },
    ],
  };
}

/** Builds workbench navigation help modal content shared by terminal and browser adapters. */
export function workbenchHelpModalContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: web ? "Web Workbench Help" : "Workbench Help",
    tone: "info",
    body: workbenchHelpRows(options),
    actions: [
      { id: "dismiss", label: "Dismiss", default: true },
      { id: "controls", label: "Focus Controls" },
    ],
  };
}

/** Builds quit/close confirmation modal content shared by terminal and browser adapters. */
export function workbenchQuitModalContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: web ? "Close Web Workbench?" : "Quit Workbench?",
    tone: "warning",
    body: web
      ? [
        "Hide the API workbench browser demo?",
        "This only removes the demo host from the page; reload the page to mount it again.",
      ]
      : [
        "Close the API workbench and return to the terminal?",
        "Use Enter to confirm, Escape to cancel, or Tab to choose an action.",
      ],
    actions: [
      { id: "cancel", label: "Cancel" },
      { id: "quit", label: web ? "Close" : "Quit", destructive: true, default: true },
    ],
  };
}

/** Builds the modal-details drilldown content shared by terminal and browser adapters. */
export function workbenchModalDetailsContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: "Modal Details",
    tone: "info",
    body: web
      ? [
        "ModalController owns open state, body rows, action focus, and keyboard behavior.",
        "The browser renderer adds a centered overlay, backdrop click blocking, and theme-aware action buttons.",
      ]
      : [
        "The ModalController is renderer-neutral and exposes open state, tone, content, action focus, and callbacks.",
        "Workbench rendering adds a theme-aware pop-over, blocks background clicks, and routes action hit targets back to the controller.",
      ],
    actions: [
      { id: "back", label: "Back" },
      { id: "confirm", label: "Confirm", default: true },
      { id: "dismiss", label: "Dismiss" },
    ],
  };
}

/** Builds the success content shown after confirming the generic workbench modal. */
export function workbenchModalConfirmedContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: "Action Confirmed",
    tone: "success",
    body: web
      ? "The web modal action completed."
      : "The modal action completed. This same surface can be used for confirmations, alerts, menus, and error dialogs.",
    actions: [{ id: "dismiss", label: "Dismiss", default: true }],
  };
}
