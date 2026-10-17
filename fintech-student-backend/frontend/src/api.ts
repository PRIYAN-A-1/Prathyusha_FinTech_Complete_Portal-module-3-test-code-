let token = "";
export function setToken(value: string) {
  token = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const apiBase = import.meta.env.VITE_API_BASE ?? "/api";
const authBase = import.meta.env.VITE_AUTH_BASE ?? "/auth";
async function response(r: Response) {
  if (!r.ok) {
    let b;
    try {
      b = await r.json();
    } catch {}
    const raw = b?.error;
    const fields = raw?.details
      ?.map(
        (d: { path: string[]; message: string }) =>
          `${d.path.join(".")}: ${d.message}`,
      )
      .join("; ");
    if (r.status === 401 && token)
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      fields ??
        (typeof raw === "string" ? raw : raw?.message) ??
        `Request failed (${r.status})`,
      r.status,
    );
  }
  return r;
}
export async function login(email: string, password: string) {
  const r = await response(
    await fetch(`${authBase}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  return r.json() as Promise<{
    access_token: string;
    expires_at: string;
    user: { id: string; role: string };
  }>;
}
export async function logout() {
  try {
    await response(
      await fetch(`${authBase}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  } finally {
    setToken("");
  }
}
export async function api<T>(
  route: string,
  options: {
    method?: string;
    body?: unknown;
    version?: number;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const r = await response(
    await fetch(apiBase + route, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.version ? { "If-Match": String(options.version) } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    }),
  );
  const json = await r.json();
  return (json?.data !== undefined ? json.data : json) as T;
}
export async function all<T>(
  route: string,
  signal?: AbortSignal,
): Promise<T[]> {
  let result: T[] = [];
  for (let page = 1; page <= 1000; page++) {
    const rows = await api<T[]>(
      `${route}${route.includes("?") ? "&" : "?"}limit=100&page=${page}`,
      { signal },
    );
    result = [...result, ...rows];
    if (rows.length < 100) return result;
  }
  throw new Error("Too many records; narrow the reporting period");
}
export async function upload(route: string, file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Maximum file size is 5 MB");
  const b = new FormData();
  b.append("file", file);
  const r = await response(
    await fetch(apiBase + route, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: b,
    }),
  );
  const json = await r.json();
  return json?.data !== undefined ? json.data : json;
}
export async function fileBlob(route: string) {
  return (
    await response(
      await fetch(apiBase + route, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
  ).blob();
}
export async function download(route: string, name: string) {
  const url = URL.createObjectURL(await fileBlob(route));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
