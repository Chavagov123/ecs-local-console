import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("title-cases ECS SCREAMING_SNAKE statuses", () => {
    render(<StatusBadge status="PROVISIONING" />);
    expect(screen.getByText("Provisioning")).toBeInTheDocument();
  });

  it("applies the success tone for RUNNING tasks", () => {
    render(<StatusBadge status="RUNNING" kind="task" />);
    expect(screen.getByText("Running").className).toContain("text-success");
  });

  it("applies the danger tone for FAILED deployments", () => {
    render(<StatusBadge status="FAILED" kind="deployment" />);
    expect(screen.getByText("Failed").className).toContain("text-destructive");
  });

  it("falls back to muted + raw label for unknown values", () => {
    render(<StatusBadge status="WEIRD_STATE" kind="service" />);
    const el = screen.getByText("Weird State");
    expect(el.className).toContain("text-muted-foreground");
  });

  it("renders a pulse when asked", () => {
    render(<StatusBadge status="IN_PROGRESS" kind="deployment" pulse />);
    expect(screen.getByText("In Progress").className).toContain("animate-pulse");
  });
});
