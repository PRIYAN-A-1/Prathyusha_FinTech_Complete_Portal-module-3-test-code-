import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw, Check } from "lucide-react";
import { api, download } from "../api";
import { useResource, useMutation, useSession } from "../state";
import type {
  Summary as SummaryData,
  Activity as ActivityData,
  Notification,
  Correction,
  Profile,
  Contribution,
  User,
} from "../types";
import {
  Heading,
  Card,
  Stats,
  Table,
  Empty,
  LoadState,
  Feedback,
  Field,
  Progress,
  Badge,
  day,
  label,
} from "../components/UI";
export function Summary() {
  const [range, setRange] = useState({
      from: `${new Date().getFullYear()}-01-01`,
      to: new Date().toISOString().slice(0, 10),
    }),
    [applied, setApplied] = useState(range);
  const query = `from=${applied.from}&to=${applied.to}`,
    r = useResource<SummaryData>(`/me/activity-summary?${query}`),
    m = useMutation();
  return (
    <>
      <Heading
        title="Your work. Clearly recognized."
        description="Keep submitted work, mentor recommendations and verified contributions distinct."
        actions={
          <button
            className="button secondary"
            disabled={m.busy}
            onClick={() =>
              m.run(
                () =>
                  download(
                    `/me/activity-summary/export?${query}`,
                    "activity-summary.csv",
                  ),
                "Summary downloaded",
              )
            }
          >
            <Download size={15} />
            Export CSV
          </button>
        }
      />
      <Feedback {...m} />
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (range.from <= range.to) setApplied(range);
          else m.setError("Start date must be before end date");
        }}
      >
        <Field
          label="From"
          type="date"
          required
          value={range.from}
          onChange={(e) => setRange((v) => ({ ...v, from: e.target.value }))}
        />
        <Field
          label="To"
          type="date"
          required
          value={range.to}
          min={range.from}
          onChange={(e) => setRange((v) => ({ ...v, to: e.target.value }))}
        />
        <button className="button secondary">Apply period</button>
      </form>
      <LoadState
        loading={r.loading && !r.data}
        error={r.error}
        retry={r.reload}
      />
      {r.data && (
        <>
          <Stats
            items={[
              {
                label: "Total contributions",
                value: r.data.total_contributions,
              },
              { label: "Verified", value: r.data.verified_contributions },
              { label: "Awaiting review", value: r.data.awaiting_review },
              {
                label: "Needs revision",
                value: r.data.contributions_needing_revision,
              },
            ]}
          />
          <div className="two-col">
            <Card title="Verification by work area">
              {r.data.by_work_area.length ? (
                r.data.by_work_area.map((a) => (
                  <Progress
                    key={a.work_area}
                    label={a.work_area}
                    value={a.verified}
                    total={a.total}
                  />
                ))
              ) : (
                <Empty>No contributions in this period.</Empty>
              )}
            </Card>
            <Card title="Monthly contributions">
              {r.data.monthly.length ? (
                <div className="monthly-chart">
                  {r.data.monthly.map((a) => (
                    <div className="chart-row" key={a.month}>
                      <span>{a.month}</span>
                      <div className="chart-bars">
                        <div
                          className="chart-total"
                          style={{
                            width: `${(a.total / Math.max(...r.data!.monthly.map((v) => v.total))) * 100}%`,
                          }}
                        >
                          <span>{a.total} total</span>
                        </div>
                        <div
                          className="chart-verified"
                          style={{
                            width: `${(a.verified / Math.max(...r.data!.monthly.map((v) => v.total))) * 100}%`,
                          }}
                        >
                          {a.verified > 0 && <span>{a.verified} verified</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>Monthly activity will appear here.</Empty>
              )}
            </Card>
          </div>
          <Stats
            items={[
              {
                label: "Submitted weekly updates",
                value: r.data.submitted_weekly_updates,
              },
              {
                label: "Hackathon participations",
                value: r.data.hackathon_participations,
              },
              {
                label: "Verified achievements",
                value: r.data.verified_achievements,
              },
            ]}
          />
          <Card title="Current work">
            <Stats
              items={[
                { label: "Active projects", value: r.data.active_projects },
                { label: "Open tasks", value: r.data.open_tasks },
                { label: "Blocked tasks", value: r.data.blocked_tasks },
                { label: "Overdue tasks", value: r.data.overdue_tasks },
              ]}
            />
            <p className="muted">
              Project and task counts describe current assignments. Contribution
              and external activity counts use the selected date period. These
              are activity summaries, not a student quality score.
            </p>
          </Card>
          <Card title="Connected team modules">
            {r.data.source_sync.length ? (
              <Table headers={["Source", "Last received"]}>
                {r.data.source_sync.map((s) => (
                  <tr key={s.source}>
                    <td>{s.source}</td>
                    <td>
                      {new Date(s.last_received_at).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>
                No external module records received yet. Weekly updates,
                hackathons and achievements populate after your team connects
                them.
              </Empty>
            )}
          </Card>
        </>
      )}
    </>
  );
}
export function Activity() {
  const r = useResource<ActivityData[]>("/me/activity", { list: true });
  return (
    <>
      <Heading
        title="Your activity history"
        description="A traceable record of your profile, project and contribution changes."
      />
      <LoadState
        loading={r.loading && !r.data}
        error={r.error}
        retry={r.reload}
      />
      <Card title="Activity timeline">
        {r.data?.length ? (
          <ul className="timeline">
            {r.data.map((a, i) => (
              <li key={a.id ?? i}>
                <span className="timeline-dot" />
                <div>
                  <strong>{label(a.action)}</strong>
                  <p className="muted">
                    {label(a.target_type)} · {a.target_id.slice(0, 8)}
                  </p>
                  <small>
                    {new Date(a.created_at).toLocaleString("en-IN")}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !r.loading && <Empty>No activity recorded yet.</Empty>
        )}
      </Card>
    </>
  );
}
function destination(n: Notification) {
  if (n.target_type === "PROJECT") return `/projects/${n.target_id}`;
  if (n.target_type === "CONTRIBUTION") return `/contributions/${n.target_id}`;
  if (n.target_type === "PROFILE" || n.target_type === "CORRECTION")
    return "/profile";
  return null;
}
export function Notifications() {
  const r = useResource<Notification[]>("/me/notifications", {
      list: true,
      poll: 30000,
    }),
    m = useMutation();
  return (
    <>
      <Heading
        title="Notifications"
        description="Review feedback, assignments and important updates."
        actions={
          <button className="button secondary" onClick={r.reload}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />
      <Feedback {...m} />
      <LoadState
        loading={r.loading && !r.data}
        error={r.error}
        retry={r.reload}
      />
      <Card title="Your inbox">
        {r.data?.length ? (
          <ul className="notifications">
            {r.data.map((n) => (
              <li key={n.id} className={n.read_at ? "read" : ""}>
                <div>
                  <p>{n.message}</p>
                  <small>
                    {new Date(n.created_at).toLocaleString("en-IN")}
                  </small>
                  {destination(n) && (
                    <Link className="text-link block" to={destination(n)!}>
                      Open record
                    </Link>
                  )}
                </div>
                {!n.read_at ? (
                  <button
                    className="button secondary small"
                    disabled={m.busy}
                    onClick={() =>
                      m.run(async () => {
                        await api(`/me/notifications/${n.id}/read`, {
                          method: "PATCH",
                        });
                        r.reload();
                      }, "Marked as read")
                    }
                  >
                    <Check size={14} />
                    Mark read
                  </button>
                ) : (
                  <span className="badge good">Read</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          !r.loading && <Empty>You’re all caught up.</Empty>
        )}
      </Card>
    </>
  );
}
type AccessData = Pick<User, "role" | "membership_status"> & {
  can_review: boolean;
  can_verify: boolean;
  projects: {
    id: string;
    lead_id: string;
    mentor_id: string;
    assigned_role: string;
  }[];
};
export function Access() {
  const { user } = useSession(),
    r = useResource<AccessData>("/me/access");
  return (
    <>
      <Heading
        title="My access"
        description="Your workspace permissions and project responsibilities."
      />
      <LoadState
        loading={r.loading && !r.data}
        error={r.error}
        retry={r.reload}
      />
      {r.data && (
        <>
          <Card title="Membership & identity">
            <p>
              Role: <Badge status={r.data.role} />
            </p>
            <p>
              Membership:{" "}
              <Badge status={r.data.membership_status ?? "APPROVED"} />
            </p>
            <Field
              label="User ID"
              value={user?.id ?? ""}
              readOnly
              hint="Share this ID with your team lead for project assignments."
            />
            <p>Can review assigned work: {r.data.can_review ? "Yes" : "No"}</p>
            <p>Can verify contributions: {r.data.can_verify ? "Yes" : "No"}</p>
          </Card>
          <Card title="Project access">
            {r.data.projects.length ? (
              <Table headers={["Project ID", "Role"]}>
                {r.data.projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="text-link" to={`/projects/${p.id}`}>
                        {p.id}
                      </Link>
                    </td>
                    <td>{p.assigned_role ?? "Assigned reviewer"}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>No project assignments.</Empty>
            )}
          </Card>
        </>
      )}
    </>
  );
}
export function Reviews() {
  const { user } = useSession(),
    isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user?.role ?? ""),
    [tab, setTab] = useState("Contributions");
  if (user?.role === "STUDENT")
    return (
      <Card>
        <p>Review access is restricted to assigned mentors and coordinators.</p>
      </Card>
    );
  return (
    <>
      <Heading
        title="Review workspace"
        description="Review evidence, protect student data and keep verification traceable."
      />
      <div className="tabs">
        {[
          "Contributions",
          ...(isAdmin ? ["Profile publication", "Corrections"] : []),
        ].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Contributions" && <ContributionQueue />}
      {tab === "Profile publication" && <ProfileQueue />}
      {tab === "Corrections" && <CorrectionQueue />}
    </>
  );
}
function ContributionQueue() {
  const r = useResource<Contribution[]>("/reviews/contributions", {
    list: true,
  });
  return (
    <>
      <LoadState
        loading={r.loading && !r.data}
        error={r.error}
        retry={r.reload}
      />
      <Card title="Awaiting contribution review">
        {r.data?.length ? (
          <Table headers={["Work", "Student", "Date", "Review status"]}>
            {r.data.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link className="text-link" to={`/contributions/${c.id}`}>
                    {c.work_area} · {c.description.slice(0, 70)}
                  </Link>
                </td>
                <td>{c.user_id.slice(0, 8)}</td>
                <td>{day(c.contribution_date)}</td>
                <td>
                  <Badge status={c.status} />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          !r.loading && (
            <Empty>No assigned contributions awaiting review.</Empty>
          )
        )}
      </Card>
      <Link className="button secondary" to="/projects">
        Review project proposals
      </Link>
    </>
  );
}
function ProfileQueue() {
  const r = useResource<Profile[]>("/admin/profiles", { list: true }),
    [id, setId] = useState<string | null>(null);
  return (
    <>
      <LoadState
        loading={r.loading && !r.data}
        error={r.error}
        retry={r.reload}
      />
      <Card title="Pending publication requests">
        {r.data?.length ? (
          <Table headers={["Student", "Status", "Action"]}>
            {r.data.map((p) => (
              <tr key={p.user_id}>
                <td>{p.display_name}</td>
                <td>
                  <Badge status={p.publication_status} />
                </td>
                <td>
                  <button
                    className="button secondary small"
                    onClick={() => setId(p.user_id)}
                  >
                    Review profile
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          !r.loading && <Empty>No pending publication requests.</Empty>
        )}
      </Card>
      {id && (
        <ProfileReview
          key={id}
          id={id}
          onDone={() => {
            setId(null);
            r.reload();
          }}
        />
      )}
    </>
  );
}
function ProfileReview({ id, onDone }: { id: string; onDone: () => void }) {
  const r = useResource<Profile>(`/admin/profiles/${id}`),
    m = useMutation();
  return (
    <Card title="Review public profile fields">
      <LoadState loading={r.loading} error={r.error} retry={r.reload} />
      <Feedback {...m} />
      {r.data && (
        <>
          <h3>{r.data.display_name}</h3>
          <p>{r.data.bio}</p>
          <p>
            {r.data.department} · {r.data.program} · Year{" "}
            {r.data.year_of_study ?? "—"}
          </p>
          <p>Skills: {r.data.skills.join(", ")}</p>
          <p>Interests: {r.data.interests.join(", ")}</p>
          <ul>
            {r.data.portfolio_links.map((l) => (
              <li key={l}>
                <a href={l} target="_blank" rel="noreferrer">
                  {l}
                </a>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              m.run(async () => {
                await api(`/admin/profiles/${id}/publication`, {
                  method: "POST",
                  body: {
                    approve: f.get("decision") === "approve",
                    version: r.data!.version,
                    note: f.get("note"),
                  },
                });
                onDone();
              });
            }}
          >
            <div className="form-grid">
              <Field label="Review note" name="note" required />
              <label className="field">
                <span>Decision</span>
                <select name="decision">
                  <option value="approve">Approve publication</option>
                  <option value="reject">Reject publication</option>
                </select>
              </label>
            </div>
            <button className="button" disabled={m.busy}>
              Record decision
            </button>
          </form>
        </>
      )}
    </Card>
  );
}
function CorrectionQueue() {
  const r = useResource<Correction[]>("/admin/corrections", { list: true }),
    m = useMutation();
  return (
    <>
      <LoadState
        loading={r.loading && !r.data}
        error={r.error}
        retry={r.reload}
      />
      <Feedback {...m} />
      {r.data?.length
        ? r.data.map((c) => (
            <Card key={c.id} title={`Correction: ${label(c.field)}`}>
              <p>Requested: {c.requested_value}</p>
              <p>Reason: {c.reason}</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  m.run(async () => {
                    await api(`/admin/corrections/${c.id}/review`, {
                      method: "POST",
                      body: {
                        approve: f.get("decision") === "approve",
                        note: f.get("note"),
                      },
                    });
                    r.reload();
                  });
                }}
              >
                <div className="form-grid">
                  <Field label="Review note" name="note" required />
                  <label className="field">
                    <span>Decision</span>
                    <select name="decision">
                      <option value="approve">Approve correction</option>
                      <option value="reject">Reject correction</option>
                    </select>
                  </label>
                </div>
                <button className="button" disabled={m.busy}>
                  Record decision
                </button>
              </form>
            </Card>
          ))
        : !r.loading && (
            <Card>
              <Empty>No pending corrections.</Empty>
            </Card>
          )}
    </>
  );
}
