import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { spawn } from "node:child_process";
import App from "./App";
import { setToken } from "./api";
const nativeFetch = globalThis.fetch;
let fixture: ReturnType<typeof spawn>,
  apiOrigin = "",
  authOrigin = "",
  accessToken = "";
beforeAll(async () => {
  fixture = spawn(process.execPath, [process.cwd() + "/test-server.mjs"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const data = await new Promise<{ apiOrigin: string; authOrigin: string }>(
    (resolve, reject) => {
      let log = "";
      fixture.stdout!.on("data", (b) => {
        log += b;
        const match = log.match(/READY_JSON:(.*)\n/);
        if (match) resolve(JSON.parse(match[1]));
      });
      fixture.stderr!.on("data", (b) => (log += b));
      fixture.on("exit", (c) =>
        reject(new Error("Fixture exited " + c + ": " + log)),
      );
    },
  );
  apiOrigin = data.apiOrigin;
  authOrigin = data.authOrigin;
  // PGlite has one transaction context; serialize fixture HTTP traffic only.
  // Production keeps normal parallel browser requests against native PostgreSQL.
  let queue: Promise<unknown> = Promise.resolve();
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const task = queue.then(async () => {
      let url = String(input);
      if (url.startsWith("/auth/")) url = authOrigin + url;
      else if (url.startsWith("/api/")) url = apiOrigin + url;
      // jsdom's AbortSignal is a different realm from Node's native fetch.
      const result = await nativeFetch(url, { ...init, signal: undefined });
      await result.clone().arrayBuffer();
      if (url.endsWith("/auth/login") && result.ok)
        accessToken = (await result.clone().json()).access_token;
      return result;
    });
    queue = task.then(
      () => {},
      () => {},
    );
    return task;
  });
}, 60000);
afterAll(async () => {
  vi.unstubAllGlobals();
  setToken("");
  if (fixture && fixture.exitCode === null) {
    fixture.kill("SIGTERM");
    await new Promise((r) => fixture.once("exit", r));
  }
}, 20000);
async function backend(route: string) {
  return (
    await nativeFetch(apiOrigin + "/api/v1" + route, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  ).json();
}
it("completes login → dashboard → profile save → project → contribution → summary → logout against real services", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  await user.type(
    screen.getByLabelText(/College email/),
    "student@example.edu",
  );
  await user.type(screen.getByLabelText(/Password/), "Test-password-123!");
  await user.click(
    screen.getByRole("button", { name: /Sign in to student workspace/ }),
  );
  expect(
    await screen.findByRole(
      "heading",
      { name: /Make this week count, Test/ },
      { timeout: 15000 },
    ),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "My profile" }));
  const name = await screen.findByRole("textbox", { name: /Display name/ });
  await user.clear(name);
  await user.type(name, "Priyan Test");
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Profile saved"),
  );
  expect((await backend("/me/profile")).data.display_name).toBe("Priyan Test");
  await user.click(screen.getByRole("link", { name: "Projects & tasks" }));
  await user.click(
    await screen.findByRole("link", { name: "Propose project" }),
  );
  await user.type(
    await screen.findByLabelText(/Project title/),
    "Student Finance Tool",
  );
  await user.type(screen.getByLabelText(/Focus area/), "Financial AI");
  fireEvent.change(screen.getByLabelText(/Start date/), {
    target: { value: "2026-01-01" },
  });
  fireEvent.change(screen.getByLabelText(/Target completion/), {
    target: { value: "2027-01-01" },
  });
  for (const caption of [
    "Abstract",
    "Problem statement",
    "Objectives",
    "Expected outcome",
  ])
    await user.type(
      screen.getByLabelText(new RegExp(caption)),
      "A verified project requirement",
    );
  await user.click(screen.getByRole("button", { name: "Submit proposal" }));
  expect(
    await screen.findByRole("heading", { name: "Student Finance Tool" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Add contribution" }));
  await user.type(await screen.findByLabelText(/Work area/), "Coding");
  await user.type(
    screen.getByLabelText(/Work performed/),
    "Implemented input validation",
  );
  await user.type(
    screen.getByLabelText(/Outcome/),
    "Invalid records are rejected",
  );
  await user.type(
    screen.getByLabelText(/Evidence URLs/),
    "https://github.com/example/project/commit/abc",
  );
  await user.click(
    screen.getByRole("button", { name: "Save draft & open review" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Coding" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Submit for review" }));
  await waitFor(() =>
    expect(screen.getByText("Submitted")).toBeInTheDocument(),
  );
  expect((await backend("/me/contributions")).data[0].status).toBe("SUBMITTED");
  await user.click(screen.getByRole("link", { name: "Activity summary" }));
  expect(await screen.findByText("Total contributions")).toBeInTheDocument();
  expect(screen.getByText("Verified achievements")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect(
    await screen.findByRole("heading", { name: "Welcome to FinTech" }),
  ).toBeInTheDocument();
  expect(
    (
      await nativeFetch(apiOrigin + "/api/v1/me/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    ).status,
  ).toBe(401);
}, 45000);
