import type { ChangeEvent } from "@ecs-local-console/shared";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { DesiredVsRunningGauge } from "./DesiredVsRunningGauge";
import { EventTimeline } from "./EventTimeline";

describe("DesiredVsRunningGauge", () => {
  it("splits the bar into running / pending / missing by count", () => {
    renderWithProviders(<DesiredVsRunningGauge desired={4} running={2} pending={1} />);
    // total = max(4, 3) = 4  →  running 2/4=50%, pending 1/4=25%, missing 1/4=25%
    expect(screen.getByTestId("seg-running").dataset.width).toBe("50%");
    expect(screen.getByTestId("seg-pending").dataset.width).toBe("25%");
    expect(screen.getByTestId("seg-missing").dataset.width).toBe("25%");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("/ 4 running")).toBeInTheDocument();
  });

  it("shows a surplus segment during a blue/green overshoot", () => {
    renderWithProviders(<DesiredVsRunningGauge desired={2} running={3} pending={0} />);
    // total = max(2,3) = 3 → running clamped to desired 2/3, surplus 1/3
    expect(screen.getByTestId("seg-running").dataset.width).toBe("66.66666666666666%");
    expect(screen.getByTestId("seg-surplus").dataset.width).toBe("33.33333333333333%");
  });
});

describe("EventTimeline", () => {
  const base = { cluster: "demo", ts: new Date().toISOString() };
  const events: ChangeEvent[] = [
    { ...base, id: 3, type: "service.deployment.completed", resource: "web", detail: "web:2 completed" },
    { ...base, id: 2, type: "task.stopped", resource: "abcdef123456", severity: "error", detail: "OOM · exit 137" },
    { ...base, id: 1, type: "task.started", resource: "abcdef123456", service: "web" },
  ];

  it("renders one row per event with readable labels", () => {
    renderWithProviders(<EventTimeline events={events} live />);
    expect(screen.getByText(/Deployment web:2 completed/)).toBeInTheDocument();
    expect(screen.getByText(/Task abcdef123456 stopped — OOM/)).toBeInTheDocument();
    expect(screen.getByText("Task abcdef123456 started")).toBeInTheDocument();
  });

  it("shows an empty state that depends on whether the stream is live", () => {
    const { rerender } = renderWithProviders(<EventTimeline events={[]} live />);
    expect(screen.getByText(/No changes yet/)).toBeInTheDocument();
    rerender(<EventTimeline events={[]} live={false} />);
    expect(screen.getByText(/Live events unavailable/)).toBeInTheDocument();
  });
});
