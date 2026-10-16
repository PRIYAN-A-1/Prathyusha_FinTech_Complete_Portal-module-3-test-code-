/** Drop into the existing React + TypeScript frontend. Keep session token in memory. */
export class PortalClient {
  constructor(
    private apiBase = "http://localhost:4000/api/v1",
    private authBase = "http://localhost:8080",
    private token = "",
  ) {}
  async login(email: string, password: string) {
    const r = await fetch(`${this.authBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error);
    this.token = body.access_token;
    return body;
  }
  async call<T = unknown>(
    route: string,
    options: { method?: string; body?: unknown; version?: number } = {},
  ): Promise<T> {
    const r = await fetch(this.apiBase + route, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.version ? { "If-Match": String(options.version) } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const b = await r.json();
    if (!r.ok)
      throw Object.assign(new Error(b.error?.message ?? "Request failed"), {
        status: r.status,
        details: b.error?.details,
      });
    return b.data;
  }
  dashboard() {
    return this.call("/me/dashboard");
  }
  profile() {
    return this.call("/me/profile");
  }
  saveProfile(body: unknown, version: number) {
    return this.call("/me/profile", { method: "PUT", body, version });
  }
  projects() {
    return this.call("/projects");
  }
  project(id: string) {
    return this.call(`/projects/${encodeURIComponent(id)}`);
  }
  summary(from: string, to: string) {
    return this.call(
      `/me/activity-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
  }
  async upload(route: string, file: File) {
    const b = new FormData();
    b.append("file", file);
    const r = await fetch(this.apiBase + route, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: b,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error.message);
    return data.data;
  }
  async download(id: string) {
    const r = await fetch(`${this.apiBase}/files/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!r.ok) throw new Error("File unavailable");
    return r.blob();
  }
  async logout() {
    await fetch(`${this.authBase}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    this.token = "";
  }
}
