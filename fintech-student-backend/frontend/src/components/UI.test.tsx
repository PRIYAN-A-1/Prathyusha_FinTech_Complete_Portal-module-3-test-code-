import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Field, LoadState, Badge, Stats } from "./UI";
import App from "../App";
import { setToken } from "../api";
afterEach(() => {
  vi.restoreAllMocks();
  setToken("");
});
describe("accessible UI and login feedback", () => {
  it("associates input labels with required fields", () => {
    render(<Field label="Display name" required />);
    expect(
      screen.getByRole("textbox", { name: /Display name/ }),
    ).toBeRequired();
  });
  it("renders exact backend counters including zero", () => {
    render(
      <Stats
        items={[
          { label: "Verified contributions", value: 0 },
          { label: "Active projects", value: 12 },
        ]}
      />,
    );
    expect(screen.getByText("00")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
  it("offers a retry action on an API error", () => {
    const retry = vi.fn();
    render(
      <LoadState loading={false} error="Service unavailable" retry={retry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");
  });
  it("shows verification statuses in readable language", () => {
    render(<Badge status="REVISION_REQUIRED" />);
    expect(screen.getByText("Revision required")).toBeInTheDocument();
  });
  it("surfaces login rejection without entering the workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Invalid credentials or unavailable account",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/College email/), {
      target: { value: "student@example.edu" },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: "wrong" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Sign in to student workspace/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials",
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
