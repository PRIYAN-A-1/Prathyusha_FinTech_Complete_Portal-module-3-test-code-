import { useState, type FormEvent } from "react";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  UserRound,
  FolderKanban,
  FileCheck2,
  ChartNoAxesCombined,
  Bell,
  LogOut,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { SessionProvider, useSession } from "./state";
import { Feedback, Field } from "./components/UI";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import { Projects, ProjectDetail, ProjectForm } from "./pages/Projects";
import {
  Contributions,
  ContributionForm,
  ContributionDetail,
} from "./pages/Contributions";
import {
  Summary,
  Activity,
  Notifications,
  Access,
  Reviews,
} from "./pages/Activity";
const logo = "/assets/prathyusha-logo.png";
export default function App() {
  return (
    <SessionProvider>
      <Portal />
    </SessionProvider>
  );
}
function Login() {
  const { signIn, notice } = useSession();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [help, setHelp] = useState(false),
    [role, setRole] = useState("Student");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <aside className="login-brand">
        <div className="logo-box">
          <img
            src={logo}
            alt="Prathyusha Engineering College"
            width="406"
            height="69"
          />
          <small>PRATHYUSHA / FINTECH INNOVATION TEAM</small>
        </div>
        <h1>
          Finance.
          <br />
          Technology.
          <br />
          Innovation.
        </h1>
        <p>
          A student innovation community at Prathyusha Engineering College.
          Build projects, document progress and share verified achievements.
        </p>
        <small>
          LEARN TOGETHER.
          <br />
          BUILD WITH PURPOSE.
        </small>
      </aside>
      <main className="login-main">
        <div className="login-form">
          <span className="badge">FINTECH DOMAIN ACCESS</span>
          <h1>Welcome to FinTech</h1>
          <p className="muted">Sign in to your college FinTech workspace.</p>
          <div className="role-toggle" aria-label="Workspace role">
            {["Student", "Faculty"].map((r) => (
              <button
                type="button"
                key={r}
                aria-pressed={role === r}
                className={role === r ? "selected" : ""}
                onClick={() => setRole(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <Feedback error={error} message={notice} />
          <form onSubmit={submit}>
            <Field
              label="College email"
              type="email"
              autoComplete="username"
              placeholder="name@prathyusha.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={200}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={72}
            />
            <div className="login-options">
              <span>Secure member access</span>
              <button
                className="link-button"
                type="button"
                onClick={() => setHelp(!help)}
              >
                Need access?
              </button>
            </div>
            {help && (
              <div className="alert">
                Contact your faculty coordinator for membership approval or
                password recovery. Your account determines access permissions.
              </div>
            )}
            <button className="button full" disabled={busy}>
              {busy
                ? "Signing in…"
                : `Sign in to ${role.toLowerCase()} workspace`}{" "}
              <ArrowRight size={16} />
            </button>
          </form>
          <p className="fine-print">
            Only approved members can access the workspace. Sessions expire
            after eight hours.
          </p>
        </div>
      </main>
    </div>
  );
}
function Portal() {
  const { user, signOut } = useSession(),
    location = useLocation();
  const [mobile, setMobile] = useState(false),
    [error, setError] = useState("");
  if (!user) return <Login />;
  const links = [
    ["/", "Overview", LayoutDashboard],
    ["/profile", "My profile", UserRound],
    ["/projects", "Projects & tasks", FolderKanban],
    ["/contributions", "Contributions", FileCheck2],
    ["/summary", "Activity summary", ChartNoAxesCombined],
    ["/activity", "Activity history", FileCheck2],
    ["/notifications", "Notifications", Bell],
    ["/access", "My access", ShieldCheck],
  ] as const;
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <button
          className="icon-button mobile-menu"
          aria-label="Open menu"
          onClick={() => setMobile(true)}
        >
          <Menu />
        </button>
        <Link to="/" className="college-logo">
          <img
            src={logo}
            alt="Prathyusha Engineering College"
            width="340"
            height="58"
          />
        </Link>
        <div className="portal-identity">
          <strong>FINTECH INNOVATION TEAM</strong>
          <small>PRATHYUSHA ENGINEERING COLLEGE</small>
        </div>
        <span className="badge header-role">
          {user.role === "STUDENT"
            ? "Student"
            : user.role === "MENTOR"
              ? "Mentor"
              : "Coordinator"}
        </span>
        <Link
          className="button secondary header-notifications"
          to="/notifications"
        >
          <Bell size={16} />
          <span>Notifications</span>
        </Link>
      </header>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-title">
          WORKSPACE
          <button
            className="icon-button close-menu"
            aria-label="Close menu"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {links.map(([to, name, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobile(false)}
            >
              <Icon size={16} />
              {name}
            </NavLink>
          ))}
          {user.role !== "STUDENT" && (
            <NavLink to="/reviews" onClick={() => setMobile(false)}>
              <ShieldCheck size={16} />
              Review workspace
            </NavLink>
          )}
        </nav>
        <div className="other-modules">
          <small>OTHER TEAM MODULES</small>
          {["Weekly updates", "Hackathons", "Magazine"].map((n) => (
            <span key={n} title="Owned by another team module">
              {n}
              <small>Team integration</small>
            </span>
          ))}
        </div>
        <div className="sidebar-bottom">
          <span>FINTECH INNOVATION TEAM</span>
          <button
            className="logout"
            onClick={() => {
              signOut().catch((e) => setError(e.message));
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
      <main id="main" className="main" key={location.pathname}>
        <Feedback error={error} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/new" element={<ProjectForm />} />
          <Route path="/projects/:id/edit" element={<ProjectForm />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/contributions" element={<Contributions />} />
          <Route path="/contributions/new" element={<ContributionForm />} />
          <Route
            path="/contributions/:id/edit"
            element={<ContributionForm />}
          />
          <Route path="/contributions/:id" element={<ContributionDetail />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/access" element={<Access />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <footer>
          PRATHYUSHA ENGINEERING COLLEGE <span>·</span> FINTECH INNOVATION TEAM
        </footer>
      </main>
    </div>
  );
}
