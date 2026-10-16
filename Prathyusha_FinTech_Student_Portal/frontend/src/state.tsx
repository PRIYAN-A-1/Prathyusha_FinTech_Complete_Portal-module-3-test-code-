import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import * as network from "./api";
import type { User } from "./types";
const Session = createContext<{
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  notice: string;
}>({ user: null, signIn: async () => {}, signOut: async () => {}, notice: "" });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const expire = () => {
      network.setToken("");
      setUser(null);
      setNotice("Your session ended. Please sign in again.");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  return (
    <Session.Provider
      value={{
        user,
        notice,
        signIn: async (email, password) => {
          const data = await network.login(email, password);
          network.setToken(data.access_token);
          setUser(data.user);
          setNotice("");
        },
        signOut: async () => {
          try {
            await network.logout();
          } finally {
            setUser(null);
          }
        },
      }}
    >
      {children}
    </Session.Provider>
  );
}
export const useSession = () => useContext(Session);
export function useResource<T>(
  route: string,
  options: { list?: boolean; poll?: number } = {},
) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!options.poll) return;
    const timer = setInterval(reload, options.poll);
    return () => clearInterval(timer);
  }, [options.poll, reload]);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    const task = options.list
      ? network.all(route, c.signal)
      : network.api<T>(route, { signal: c.signal });
    task
      .then((d) => {
        if (!c.signal.aborted) setData(d as T);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [route, tick, options.list]);
  return { data, error, loading, reload };
}
export function useMutation() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run(fn: () => Promise<void>, success = "Saved successfully") {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, message, run, setError };
}
