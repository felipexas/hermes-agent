// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getStatus = vi.fn();
const getSessions = vi.fn();
const getCronJobs = vi.fn();
const getProfiles = vi.fn();

vi.mock("@/lib/api", () => ({
  api: { getStatus, getSessions, getCronJobs, getProfiles },
}));

let container: HTMLDivElement;
let root: Root;

async function render(ui: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<MemoryRouter>{ui}</MemoryRouter>));
}

beforeEach(() => {
  getStatus.mockResolvedValue({
    active_sessions: 3,
    gateway_running: true,
    gateway_state: "running",
    gateway_platforms: {
      discord: { state: "connected", updated_at: "2026-08-29T15:00:00Z" },
      whatsapp: { state: "connected", updated_at: "2026-08-29T15:00:00Z" },
    },
    version: "0.22.0",
    memory: { pressure: "ok", gateway_rss_mb: 512 },
    disk: { pressure: "ok", used_percent: 41 },
  });
  getSessions.mockResolvedValue({
    sessions: [
      {
        id: "session/one?branch=a",
        title: "Build native Labophase dashboard",
        source: "tui",
        model: "gpt-5",
        started_at: 1,
        ended_at: null,
        last_active: 1_788_013_200,
        is_active: true,
        message_count: 18,
        tool_call_count: 9,
        input_tokens: 1200,
        output_tokens: 800,
        preview: "The native dashboard is being rebuilt.",
      },
    ],
    total: 24,
    limit: 6,
    offset: 0,
  });
  getCronJobs.mockResolvedValue([
    { id: "cron-1", name: "Marketplace watch", enabled: true, next_run_at: "2026-08-29T16:00:00Z" },
  ]);
  getProfiles.mockResolvedValue({
    profiles: [
      { name: "default", gateway_running: true },
      { name: "edison", gateway_running: false },
    ],
  });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
});

describe("CommandCenterPage", () => {
  it("renders live Hermes operations from native APIs", async () => {
    const { default: CommandCenterPage } = await import("./CommandCenterPage");
    await render(<CommandCenterPage />);
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain("Command Center");
    expect(container.textContent).toContain("Gateway online");
    expect(container.textContent).toContain("24 sessions");
    expect(container.textContent).toContain("Build native Labophase dashboard");
    expect(container.textContent).toContain("Marketplace watch");
    expect(container.textContent).toContain("2 profiles");
    expect(getStatus).toHaveBeenCalledOnce();
    expect(getSessions).toHaveBeenCalledWith(6, 0, "", "recent");
    expect(getCronJobs).toHaveBeenCalledWith("all");
    expect(getProfiles).toHaveBeenCalledOnce();
  });

  it("routes new and recent conversations through native chat sessions", async () => {
    const { default: CommandCenterPage } = await import("./CommandCenterPage");
    await render(<CommandCenterPage />);
    await act(async () => Promise.resolve());

    const links = Array.from(container.querySelectorAll("a"));
    const newChat = links.find((link) => link.textContent?.includes("Open live console"));
    const recentChat = links.find((link) =>
      link.textContent?.includes("Build native Labophase dashboard"),
    );
    const sessionsManagement = links.find(
      (link) => link.getAttribute("aria-label") === "Open Live workstream",
    );

    expect(newChat?.getAttribute("href")).toBe("/chat");
    expect(recentChat?.getAttribute("href")).toBe(
      "/chat?resume=session%2Fone%3Fbranch%3Da",
    );
    expect(sessionsManagement?.getAttribute("href")).toBe("/sessions");
  });

  it("is registered as a native Dashboard route without a custom chat transport", () => {
    const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    const commandCenterSource = readFileSync(
      join(process.cwd(), "src/pages/CommandCenterPage.tsx"),
      "utf8",
    );
    const commandCenterStyles = readFileSync(
      join(process.cwd(), "src/pages/command-center.css"),
      "utf8",
    );

    expect(appSource).toContain('lazy(() => import("@/pages/CommandCenterPage"))');
    expect(appSource).toContain('"/command-center": CommandCenterPage');
    expect(appSource).toMatch(/path:\s*"\/command-center"[\s\S]*label:\s*"Command Center"/);
    expect(commandCenterStyles).toContain(":focus-visible");
    expect(commandCenterStyles).toContain("prefers-reduced-motion: reduce");
    expect(commandCenterStyles).toMatch(/@media[^{}]*max-width:\s*760px/);

    for (const forbidden of [
      "EventSource",
      "child_process",
      "hermes chat",
      "/api/chat",
      "/api/agent-chat",
      "<iframe",
      "sessionToken",
    ]) {
      expect(commandCenterSource).not.toContain(forbidden);
    }
  });

  it("shows a truthful degraded state when native APIs fail", async () => {
    getStatus.mockRejectedValue(new Error("offline"));
    getSessions.mockRejectedValue(new Error("offline"));
    getCronJobs.mockRejectedValue(new Error("offline"));
    getProfiles.mockRejectedValue(new Error("offline"));

    const { default: CommandCenterPage } = await import("./CommandCenterPage");
    await render(<CommandCenterPage />);
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain("Live telemetry unavailable");
    expect(container.textContent).toContain("Open System");
  });
});
