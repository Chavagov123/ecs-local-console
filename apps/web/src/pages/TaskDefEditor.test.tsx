import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { TaskDefEditor } from "./TaskDefEditor";

// Monaco is heavy + needs a real editor host; stub it as a textarea.
vi.mock("@/components/MonacoJsonEditor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="json editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

function setup(route = "/task-definitions/new") {
  return renderWithProviders(
    <Routes>
      <Route path="/task-definitions/new" element={<TaskDefEditor />} />
      <Route path="/task-definitions/:family/:revision/edit" element={<TaskDefEditor />} />
    </Routes>,
    { route },
  );
}

describe("TaskDefEditor", () => {
  it("renders the form with a default container", async () => {
    setup();
    expect(await screen.findByLabelText("Family")).toBeInTheDocument();
    expect(screen.getByText("Container 1")).toBeInTheDocument();
  });

  it("round-trips Form → JSON → Form", async () => {
    const { user } = setup();
    await user.type(await screen.findByLabelText("Family"), "web");

    await user.click(screen.getByRole("radio", { name: "JSON" }));
    const json = (await screen.findByLabelText("json editor")) as HTMLTextAreaElement;
    expect(JSON.parse(json.value).family).toBe("web");

    // edit JSON then switch back
    fireEvent.change(json, {
      target: {
        value: JSON.stringify({
          family: "api",
          containerDefinitions: [{ name: "app", image: "nginx", memory: 128 }],
        }),
      },
    });
    await user.click(screen.getByRole("radio", { name: "Form" }));
    await waitFor(() =>
      expect((screen.getByLabelText("Family") as HTMLInputElement).value).toBe("api"),
    );
  });
});
