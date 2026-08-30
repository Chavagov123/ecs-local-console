import { screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("opens a menu with Light / Dark / System", async () => {
    const { user } = renderWithProviders(
      <ThemeProvider attribute="class" defaultTheme="dark" storageKey="theme">
        <ThemeToggle />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(await screen.findByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();

    await user.click(screen.getByText("Light"));
    // next-themes writes the choice to localStorage under the configured key
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
