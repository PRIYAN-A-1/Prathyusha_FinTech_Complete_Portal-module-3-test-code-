import { useState, type FormEvent } from "react";
import {
  Link,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Plus, Download } from "lucide-react";
import { api, upload, download } from "../api";
import { useResource, useMutation, useSession } from "../state";
import type { Contribution, Project, Task, Summary } from "../types";
import {
  Heading,
  Card,
  Stats,
  Table,
  Empty,
  LoadState,
  Badge,
  Feedback,
  Field,
  Textarea,
  Select,
  day,
  label,
  ProjectLink,
} from "../components/UI";
export function Contributions() {
  const list = useResource<Contribution[]>("/me/contributions", { list: true }),
    counts = useResource<Summary>("/me/activity-summary"),
    [status, setStatus] = useState("ALL"),
    [search, setSearch] = useState("");
  const filtered =
    list.data?.filter(
      (c) =>
        (status === "ALL" || c.status === status) &&
        `${c.project_title} ${c.description} ${c.work_area}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) ?? [];
  return (
    <>
      <Heading
        title="My individual contributions"
        description="Your submitted descriptions stay separate from reviewer feedback and verification decisions."
        actions={
          <Link className="button" to="/contributions/new">
            <Plus size={15} />
            New contribution
          </Link>
        }
      />
      <LoadState
        loading={list.loading && !list.data}
        error={list.error || counts.error}
        retry={() => {
          list.reload();
          counts.reload();
        }}
      />
      <Stats
        items={[
          {
            label: "Reported entries",
            value: counts.data?.reported_contributions ?? 0,
          },
          {
            label: "Verified entries",
            value: counts.data?.verified_contributions ?? 0,
          },
          {
            label: "Awaiting review",
            value: counts.data?.awaiting_review ?? 0,
          },
        ]}
      />
      <div className="filters">
        <Field
          label="Search contributions"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Project, work or description"
        />
        <Select
          label="Review status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          {[
            "DRAFT",
            "SUBMITTED",
            "UNDER_REVIEW",
            "RECOMMENDED",
            "REVISION_REQUIRED",
            "VERIFIED",
          ].map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
      </div>
      <Card title="Contribution history">
        {filtered.length ? (
          <Table
            headers={[
              "Record / work",
              "Project",
              "Contribution date",
              "Review",
            ]}
          >
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link className="text-link" to={`/contributions/${c.id}`}>
                    {c.work_area}
                  </Link>
                  <small className="block">{c.description.slice(0, 100)}</small>
                </td>
                <td>
                  <ProjectLink id={c.project_id}>
                    {c.project_title ?? "Project"}
                  </ProjectLink>
                </td>
                <td>{day(c.contribution_date)}</td>
                <td>
                  <Badge status={c.status} />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            action={
              <Link className="button secondary" to="/contributions/new">
                Record your work
              </Link>
            }
          >
            No matching contributions yet.
          </Empty>
        )}
      </Card>
    </>
  );
}
export function ContributionForm() {
  const { id } = useParams(),
    [search] = useSearchParams(),
    navigate = useNavigate();
  const existing = useResource<Contribution>(
      id ? `/contributions/${id}` : "/me/access",
    ),
    projects = useResource<Project[]>("/projects", { list: true }),
    tasks = useResource<Task[]>("/me/tasks", { list: true }),
    m = useMutation();
  const [project, setProject] = useState(search.get("project") ?? ""),
    [file, setFile] = useState<File | null>(null),
    [savedId, setSavedId] = useState<string | null>(null);
  const c = id ? existing.data : null;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    await m.run(async () => {
      const target = id ?? savedId;
      let version = c?.version;
      if (savedId && !id)
        version = (await api<Contribution>(`/contributions/${savedId}`))
          .version;
      const body = {
        project_id: f.project_id,
        task_id: f.task_id || null,
        contribution_date: f.contribution_date,
        work_area: f.work_area,
        description: f.description,
        outcome: f.outcome,
        evidence_links: String(f.evidence_links)
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      };
      const record = await api<Contribution>(
        target ? `/contributions/${target}` : "/contributions",
        { method: target ? "PUT" : "POST", version, body },
      );
      setSavedId(record.id);
      if (file) await upload(`/contributions/${record.id}/files`, file);
      navigate(`/contributions/${record.id}`);
    }, "Draft saved");
  }
  return (
    <>
      <Link className="back-link" to="/contributions">
        <ArrowLeft size={15} />
        Contributions
      </Link>
      <Heading
        title={id ? "Revise your contribution" : "Record your contribution"}
        description="Describe your own work and attach evidence. Submission does not automatically verify a claim."
      />
      <LoadState
        loading={projects.loading || tasks.loading || existing.loading}
        error={projects.error || tasks.error || existing.error}
        retry={() => {
          projects.reload();
          tasks.reload();
          existing.reload();
        }}
      />
      <Feedback {...m} />
      {savedId && (
        <div className="alert">
          Your draft was saved.{" "}
          <Link to={`/contributions/${savedId}`}>Open saved draft</Link> to
          retry an evidence upload.
        </div>
      )}
      {!existing.loading &&
        !projects.loading &&
        !tasks.loading &&
        !existing.error && (
          <form onSubmit={save}>
            <fieldset disabled={m.busy}>
              <Card title="Contribution details">
                <div className="form-grid">
                  <Select
                    label="Project"
                    name="project_id"
                    required
                    defaultValue={c?.project_id ?? project}
                    onChange={(e) => setProject(e.target.value)}
                    disabled={!!id}
                  >
                    <option value="">Choose project</option>
                    {projects.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                  {id && (
                    <input
                      type="hidden"
                      name="project_id"
                      value={c?.project_id ?? ""}
                    />
                  )}
                  <Field
                    label="Work area"
                    name="work_area"
                    defaultValue={c?.work_area}
                    required
                    placeholder="Coding, testing, design…"
                    maxLength={100}
                  />
                  <Field
                    label="Contribution date"
                    name="contribution_date"
                    type="date"
                    defaultValue={
                      c?.contribution_date?.slice(0, 10) ??
                      new Date().toISOString().slice(0, 10)
                    }
                    max={new Date().toISOString().slice(0, 10)}
                    required
                  />
                  <Select
                    label="Related assigned task"
                    name="task_id"
                    defaultValue={c?.task_id ?? ""}
                  >
                    <option value="">No linked task</option>
                    {tasks.data
                      ?.filter(
                        (t) => t.project_id === (project || c?.project_id),
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </Select>
                </div>
                <Textarea
                  label="Work performed"
                  name="description"
                  defaultValue={c?.description}
                  required
                  maxLength={5000}
                />
                <Textarea
                  label="Outcome"
                  name="outcome"
                  defaultValue={c?.outcome}
                  required
                  maxLength={5000}
                />
              </Card>
              <Card title="Evidence">
                <p className="muted">
                  Repository commits, PRs, test output or screenshots. Files are
                  available only to authorized members and reviewers.
                </p>
                <Textarea
                  label="Evidence URLs (one per line)"
                  name="evidence_links"
                  defaultValue={c?.evidence_links.join("\n")}
                />
                <Field
                  label="Supporting file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  hint="PDF, PNG or JPEG · maximum 5 MB"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Card>
              <div className="actions">
                <button className="button" disabled={m.busy}>
                  {m.busy ? "Saving draft…" : "Save draft & open review"}
                </button>
                <Link className="button secondary" to="/contributions">
                  Cancel
                </Link>
              </div>
              <p className="fine-print">
                Check your saved draft and attached evidence before submitting
                for review.
              </p>
            </fieldset>
          </form>
        )}
    </>
  );
}
export function ContributionDetail() {
  const { id } = useParams(),
    { user } = useSession(),
    r = useResource<Contribution>(`/contributions/${id}`),
    m = useMutation();
  const c = r.data,
    owner = c?.user_id === user?.id,
    editable =
      owner && !!c && ["DRAFT", "REVISION_REQUIRED"].includes(c.status);
  const canReview =
    !!c &&
    c.user_id !== user?.id &&
    ["MENTOR", "ADMIN", "SUPER_ADMIN"].includes(user?.role ?? "") &&
    ["SUBMITTED", "UNDER_REVIEW", "RECOMMENDED"].includes(c.status);
  return (
    <>
      <Link className="back-link" to="/contributions">
        <ArrowLeft size={15} />
        Contributions
      </Link>
      <Heading
        title={c?.work_area ?? "Contribution record"}
        description={
          c
            ? `Recorded ${day(c.contribution_date)} · Evidence-supported individual work`
            : undefined
        }
      />
      <LoadState loading={r.loading && !c} error={r.error} retry={r.reload} />
      <Feedback {...m} />
      {c && (
        <>
          <div className="actions">
            <Badge status={c.status} />
            <ProjectLink id={c.project_id}>Open project</ProjectLink>
          </div>
          <Card title="Work performed">
            <p className="preserve-lines">{c.description}</p>
            <h3>Outcome</h3>
            <p className="preserve-lines">{c.outcome}</p>
          </Card>
          <Card title="Evidence">
            {!c.evidence_links.length && !c.files?.length && (
              <Empty>
                No evidence attached. Add a link or upload a supporting file
                before submitting.
              </Empty>
            )}
            <ul className="evidence-list">
              {c.evidence_links.map((url, i) => (
                <li key={i}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                </li>
              ))}
              {c.files?.map((f) => (
                <li key={f.id}>
                  <span>
                    {f.original_name}{" "}
                    <small>({Math.ceil(f.size_bytes / 1024)} KB)</small>
                  </span>
                  <button
                    className="button secondary small"
                    onClick={() =>
                      m.run(
                        async () => download(`/files/${f.id}`, f.original_name),
                        "File downloaded",
                      )
                    }
                    disabled={m.busy}
                  >
                    <Download size={14} />
                    Download
                  </button>
                </li>
              ))}
            </ul>
            {editable && (
              <Field
                label="Attach supporting file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                hint="PDF / JPEG / PNG · up to 5 MB"
                disabled={m.busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    m.run(async () => {
                      await upload(`/contributions/${id}/files`, f);
                      r.reload();
                    }, "Evidence attached");
                  e.target.value = "";
                }}
              />
            )}
          </Card>
          <Card title="Reviewer feedback">
            <p>{c.review_note || "No review recorded yet."}</p>
            {c.reviewed_at && <small>Reviewed {day(c.reviewed_at)}</small>}
            <p className="muted">
              Draft → Submitted → Mentor reviewed → Coordinator verified
            </p>
          </Card>
          {editable && (
            <div className="actions">
              <Link
                className="button secondary"
                to={`/contributions/${id}/edit`}
              >
                Edit draft
              </Link>
              <button
                className="button"
                disabled={m.busy}
                onClick={() =>
                  m.run(async () => {
                    await api(`/contributions/${id}/submit`, {
                      method: "POST",
                      version: c.version,
                    });
                    r.reload();
                  }, "Submitted for review")
                }
              >
                Submit for review
              </button>
            </div>
          )}
          {canReview && (
            <Card title="Review contribution">
              <Feedback {...m} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  m.run(async () => {
                    await api(`/contributions/${id}/review`, {
                      method: "POST",
                      version: c.version,
                      body,
                    });
                    r.reload();
                  }, "Review recorded");
                }}
              >
                <Select name="status" label="Decision">
                  <option value="REVISION_REQUIRED">Request revision</option>
                  {c.status !== "RECOMMENDED" && (
                    <option value="RECOMMENDED">Recommend verification</option>
                  )}
                  {["ADMIN", "SUPER_ADMIN"].includes(user?.role ?? "") && (
                    <option value="VERIFIED">Verify contribution</option>
                  )}
                </Select>
                <Textarea name="note" label="Review note" required />
                <button className="button" disabled={m.busy}>
                  Record review
                </button>
              </form>
            </Card>
          )}
        </>
      )}
    </>
  );
}
