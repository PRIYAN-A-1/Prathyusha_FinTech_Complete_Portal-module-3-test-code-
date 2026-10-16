import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, ArrowLeft, ExternalLink } from "lucide-react";
import { api } from "../api";
import { useResource, useMutation, useSession } from "../state";
import type { Project, Task } from "../types";
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
  Select,
  Textarea,
  day,
  ProjectLink,
  label,
} from "../components/UI";
export function Projects() {
  const projects = useResource<Project[]>("/projects", { list: true }),
    tasks = useResource<Task[]>("/me/tasks", { list: true }),
    [status, setStatus] = useState("ALL");
  const list =
    projects.data?.filter((p) => status === "ALL" || p.status === status) ?? [];
  return (
    <>
      <Heading
        title="Projects & tasks"
        description="See assigned responsibilities, milestones and blockers. Team membership does not imply equal contribution."
        actions={
          <Link className="button" to="/projects/new">
            <Plus size={15} />
            Propose project
          </Link>
        }
      />
      <LoadState
        loading={projects.loading && !projects.data}
        error={projects.error || tasks.error}
        retry={() => {
          projects.reload();
          tasks.reload();
        }}
      />
      <Stats
        items={[
          { label: "Assigned projects", value: projects.data?.length ?? 0 },
          {
            label: "Open tasks",
            value:
              tasks.data?.filter((t) => t.status !== "COMPLETED").length ?? 0,
          },
          {
            label: "Blocked tasks",
            value:
              tasks.data?.filter((t) => t.status === "BLOCKED").length ?? 0,
          },
        ]}
      />
      <div className="filters">
        <Select
          label="Project status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          {[
            "PROPOSED",
            "APPROVED",
            "ACTIVE",
            "ON_HOLD",
            "COMPLETED",
            "ARCHIVED",
          ].map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
      </div>
      <Card title="Project portfolio">
        {list.length ? (
          <Table headers={["Project", "My role", "Mentor", "Status"]}>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <ProjectLink id={p.id}>{p.title}</ProjectLink>
                  <small className="block">{p.domain}</small>
                </td>
                <td>{p.assigned_role ?? "Reviewer"}</td>
                <td>{p.mentor_name ?? "Not assigned"}</td>
                <td>
                  <Badge status={p.status} />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            action={
              <Link className="button secondary" to="/projects/new">
                Propose a project
              </Link>
            }
          >
            No projects match this view.
          </Empty>
        )}
      </Card>
      <Card title="My task board">
        {tasks.data?.length ? (
          <div className="task-board">
            {[
              "NOT_STARTED",
              "IN_PROGRESS",
              "BLOCKED",
              "SUBMITTED",
              "REVIEWED",
              "COMPLETED",
            ].map((s) => (
              <section className="task-column" key={s}>
                <h3>
                  {label(s)}{" "}
                  <small>
                    {tasks.data?.filter((t) => t.status === s).length}
                  </small>
                </h3>
                {tasks.data
                  ?.filter((t) => t.status === s)
                  .map((t) => (
                    <Link
                      className="task-card"
                      key={t.id}
                      to={`/projects/${t.project_id}`}
                    >
                      <strong>{t.title}</strong>
                      <small>{t.project_title}</small>
                      <small>Due {day(t.due_date)}</small>
                      {t.blocker && (
                        <span className="warning-text">{t.blocker}</span>
                      )}
                    </Link>
                  ))}
              </section>
            ))}
          </div>
        ) : (
          <Empty>Your assigned tasks will appear here.</Empty>
        )}
      </Card>
    </>
  );
}
export function ProjectForm() {
  const { id } = useParams(),
    navigate = useNavigate(),
    resource = useResource<Project>(id ? `/projects/${id}` : "/me/access"),
    m = useMutation();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)),
      body = {
        ...f,
        technologies: String(f.technologies)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        repository_url: f.repository_url || null,
        demo_url: f.demo_url || null,
      };
    await m.run(async () => {
      const p = await api<Project>(id ? `/projects/${id}` : "/projects", {
        method: id ? "PUT" : "POST",
        version: id ? resource.data?.version : undefined,
        body,
      });
      navigate(`/projects/${p.id}`);
    });
  }
  const p = id ? resource.data : null;
  return (
    <>
      <Link className="back-link" to={id ? `/projects/${id}` : "/projects"}>
        <ArrowLeft size={15} />
        Projects
      </Link>
      <Heading
        title={id ? "Edit project" : "Propose a project"}
        description="Describe the problem, define your outcome and send it for coordinator review."
      />
      <LoadState
        loading={resource.loading}
        error={resource.error}
        retry={resource.reload}
      />
      <Feedback {...m} />
      {!resource.loading && !resource.error && (
        <form onSubmit={submit}>
          <fieldset disabled={m.busy}>
            <Card title="Project details">
              <div className="form-grid">
                <Field
                  label="Project title"
                  name="title"
                  defaultValue={p?.title}
                  required
                  maxLength={200}
                />
                <Field
                  label="Focus area / domain"
                  name="domain"
                  defaultValue={p?.domain}
                  required
                  maxLength={100}
                />
                <Field
                  label="Start date"
                  type="date"
                  name="start_date"
                  defaultValue={p?.start_date?.slice(0, 10)}
                  required
                />
                <Field
                  label="Target completion"
                  type="date"
                  name="target_date"
                  defaultValue={p?.target_date?.slice(0, 10)}
                  required
                />
              </div>
              <Textarea
                label="Abstract"
                name="abstract"
                defaultValue={p?.abstract}
                required
              />
              <Textarea
                label="Problem statement"
                name="problem_statement"
                defaultValue={p?.problem_statement}
                required
              />
              <Textarea
                label="Objectives"
                name="objectives"
                defaultValue={p?.objectives}
                required
              />
              <Textarea
                label="Expected outcome"
                name="expected_outcome"
                defaultValue={p?.expected_outcome}
                required
              />
            </Card>
            <Card title="Technology, links & risks">
              <Field
                label="Technology stack"
                name="technologies"
                defaultValue={p?.technologies?.join(", ")}
                hint="Comma separated"
              />
              <div className="form-grid">
                <Field
                  label="Repository URL"
                  name="repository_url"
                  type="url"
                  defaultValue={p?.repository_url ?? ""}
                />
                <Field
                  label="Demo URL"
                  name="demo_url"
                  type="url"
                  defaultValue={p?.demo_url ?? ""}
                />
              </div>
              <Textarea
                label="Risks and support needed"
                name="risks"
                defaultValue={p?.risks}
              />
            </Card>
            <div className="actions">
              <button className="button" disabled={m.busy}>
                {m.busy ? "Saving…" : id ? "Save changes" : "Submit proposal"}
              </button>
              <Link className="button secondary" to="/projects">
                Cancel
              </Link>
            </div>
          </fieldset>
        </form>
      )}
    </>
  );
}
export function ProjectDetail() {
  const { id } = useParams(),
    { user } = useSession(),
    p = useResource<Project>(`/projects/${id}`),
    tasks = useResource<Task[]>(`/projects/${id}/tasks`, { list: true }),
    [tab, setTab] = useState("Overview");
  const m = useMutation(),
    manager =
      !!p.data &&
      (p.data.lead_id === user?.id ||
        ["ADMIN", "SUPER_ADMIN"].includes(user?.role ?? ""));
  function refresh() {
    p.reload();
    tasks.reload();
  }
  return (
    <>
      <Link className="back-link" to="/projects">
        <ArrowLeft size={15} />
        Projects
      </Link>
      <Heading
        title={p.data?.title ?? "Project workspace"}
        description={
          p.data
            ? `${p.data.domain} · ${day(p.data.start_date)} – ${day(p.data.target_date)}`
            : undefined
        }
        actions={
          manager && (
            <Link className="button secondary" to={`/projects/${id}/edit`}>
              Edit project
            </Link>
          )
        }
      />
      <LoadState
        loading={p.loading && !p.data}
        error={p.error || tasks.error}
        retry={refresh}
      />
      <Feedback {...m} />
      {p.data && (
        <>
          <div className="actions">
            <Badge status={p.data.status} />
            {p.data.assigned_role && (
              <span className="badge">{p.data.assigned_role}</span>
            )}
          </div>
          <div className="tabs">
            {["Overview", "Team & milestones", "Tasks"].map((t) => (
              <button
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Overview" && (
            <>
              <Card title="Problem, solution and expected outcome">
                <p>{p.data.abstract}</p>
                <h3>Problem</h3>
                <p>{p.data.problem_statement}</p>
                <h3>Objective</h3>
                <p>{p.data.objectives}</p>
                <h3>Expected outcome</h3>
                <p>{p.data.expected_outcome}</p>
                <div className="tags">
                  {p.data.technologies.map((t) => (
                    <span className="badge" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="actions">
                  {p.data.repository_url && (
                    <a
                      href={p.data.repository_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link"
                    >
                      Repository <ExternalLink size={13} />
                    </a>
                  )}
                  {p.data.demo_url && (
                    <a
                      href={p.data.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link"
                    >
                      Live demo <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </Card>
              <Card title="Risks and review">
                <p>{p.data.risks || "No risks recorded."}</p>
                <p className="muted">
                  Coordinator feedback:{" "}
                  {p.data.review_notes || "Awaiting review."}
                </p>
              </Card>
            </>
          )}
          {tab === "Team & milestones" && (
            <>
              <Card title="Team responsibilities">
                {p.data.members?.length ? (
                  <Table headers={["Member", "Assigned role"]}>
                    {p.data.members.map((a) => (
                      <tr key={a.user_id}>
                        <td>{a.display_name}</td>
                        <td>{a.assigned_role}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty>No team members yet.</Empty>
                )}
                {manager && (
                  <details>
                    <summary>Add or update a member</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        m.run(async () => {
                          await api(
                            `/projects/${id}/members/${f.get("user_id")}`,
                            {
                              method: "PUT",
                              body: { assigned_role: f.get("assigned_role") },
                            },
                          );
                          refresh();
                        });
                      }}
                    >
                      <div className="form-grid">
                        <Field
                          label="Approved student user ID"
                          name="user_id"
                          required
                          hint="Use the ID shown in the student's My access page"
                        />
                        <Field
                          label="Assigned role"
                          name="assigned_role"
                          required
                          maxLength={100}
                        />
                      </div>
                      <button className="button secondary" disabled={m.busy}>
                        Assign member
                      </button>
                    </form>
                  </details>
                )}
              </Card>
              <Card title="Milestones">
                {p.data.milestones?.length ? (
                  <Table headers={["Deliverable", "Due date", "Status"]}>
                    {p.data.milestones.map((a) => (
                      <tr key={a.id}>
                        <td>{a.title}</td>
                        <td>{day(a.due_date)}</td>
                        <td>
                          {manager ? (
                            <select
                              aria-label={`Status for ${a.title}`}
                              value={a.status}
                              disabled={m.busy}
                              onChange={(e) =>
                                m.run(async () => {
                                  await api(
                                    `/projects/${id}/milestones/${a.id}`,
                                    {
                                      method: "PATCH",
                                      body: { status: e.target.value },
                                    },
                                  );
                                  refresh();
                                })
                              }
                            >
                              {[
                                "NOT_STARTED",
                                "IN_PROGRESS",
                                "BLOCKED",
                                "SUBMITTED",
                                "REVIEWED",
                                "COMPLETED",
                              ].map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <Badge status={a.status} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty>No milestones planned.</Empty>
                )}
                {manager && (
                  <details>
                    <summary>Add milestone</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const body = Object.fromEntries(
                          new FormData(e.currentTarget),
                        );
                        m.run(async () => {
                          await api(`/projects/${id}/milestones`, {
                            method: "POST",
                            body,
                          });
                          refresh();
                        });
                      }}
                    >
                      <div className="form-grid">
                        <Field label="Milestone title" name="title" required />
                        <Field
                          label="Due date"
                          name="due_date"
                          type="date"
                          required
                        />
                      </div>
                      <button className="button secondary" disabled={m.busy}>
                        Add milestone
                      </button>
                    </form>
                  </details>
                )}
              </Card>
            </>
          )}
          {tab === "Tasks" && (
            <>
              <Card title="Project tasks">
                {tasks.data?.length ? (
                  <div className="task-list">
                    {tasks.data.map((t) => (
                      <TaskItem
                        key={t.id}
                        task={t}
                        canEdit={manager || t.assignee_id === user?.id}
                        canReview={manager}
                        reload={refresh}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty>No tasks have been assigned.</Empty>
                )}
              </Card>
              {manager && (
                <Card title="Assign a task">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      m.run(async () => {
                        await api(`/projects/${id}/tasks`, {
                          method: "POST",
                          body: { ...f, milestone_id: f.milestone_id || null },
                        });
                        refresh();
                      });
                    }}
                  >
                    <div className="form-grid">
                      <Field
                        label="Task title"
                        name="title"
                        required
                        maxLength={200}
                      />
                      <Field
                        label="Due date"
                        name="due_date"
                        type="date"
                        required
                      />
                      <Select label="Assign to" name="assignee_id" required>
                        {p.data.members?.map((a) => (
                          <option value={a.user_id} key={a.user_id}>
                            {a.display_name} · {a.assigned_role}
                          </option>
                        ))}
                      </Select>
                      <Select label="Milestone" name="milestone_id">
                        <option value="">No milestone</option>
                        {p.data.milestones?.map((a) => (
                          <option value={a.id} key={a.id}>
                            {a.title}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Textarea label="Task description" name="description" />
                    <button className="button" disabled={m.busy}>
                      Assign task
                    </button>
                  </form>
                </Card>
              )}
            </>
          )}
          <div className="actions">
            <Link className="button" to={`/contributions/new?project=${id}`}>
              Add contribution
            </Link>
            <Link className="button secondary" to="/contributions">
              Contribution history
            </Link>
          </div>
          {["ADMIN", "SUPER_ADMIN"].includes(user?.role ?? "") && (
            <ProjectReview project={p.data} reload={refresh} />
          )}
        </>
      )}
    </>
  );
}
export const transitions: Record<string, string[]> = {
  NOT_STARTED: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["BLOCKED", "SUBMITTED"],
  BLOCKED: ["IN_PROGRESS"],
  SUBMITTED: ["IN_PROGRESS", "REVIEWED"],
  REVIEWED: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: [],
};
function TaskItem({
  task,
  canEdit,
  canReview,
  reload,
}: {
  task: Task;
  canEdit: boolean;
  canReview: boolean;
  reload: () => void;
}) {
  const m = useMutation(),
    [next, setNext] = useState(""),
    [blocker, setBlocker] = useState("");
  const options =
    transitions[task.status]?.filter(
      (s) => canReview || !["REVIEWED", "COMPLETED"].includes(s),
    ) ?? [];
  return (
    <article className="task-item">
      <div>
        <h3>{task.title}</h3>
        <p>{task.description}</p>
        <small>Due {day(task.due_date)}</small>
      </div>
      <Badge status={task.status} />
      {task.blocker && <p className="warning-text">{task.blocker}</p>}
      {canEdit && options.length > 0 && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            m.run(async () => {
              await api(`/tasks/${task.id}/status`, {
                method: "PATCH",
                version: task.version,
                body: { status: next, blocker },
              });
              setNext("");
              reload();
            });
          }}
        >
          <Select
            label="Move task to"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          >
            <option value="">Choose status</option>
            {options.map((s) => (
              <option value={s} key={s}>
                {label(s)}
              </option>
            ))}
          </Select>
          {next === "BLOCKED" && (
            <Field
              label="Blocker reason"
              required
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
            />
          )}
          <button className="button secondary small" disabled={m.busy}>
            Update
          </button>
        </form>
      )}
      <Feedback {...m} />
    </article>
  );
}
function ProjectReview({
  project,
  reload,
}: {
  project: Project;
  reload: () => void;
}) {
  const m = useMutation();
  const options: Record<string, string[]> = {
    PROPOSED: ["APPROVED", "ARCHIVED"],
    APPROVED: ["ACTIVE", "ARCHIVED"],
    ACTIVE: ["ON_HOLD", "COMPLETED", "ARCHIVED"],
    ON_HOLD: ["ACTIVE", "ARCHIVED"],
    COMPLETED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  if (!options[project.status]?.length) return null;
  return (
    <Card title="Coordinator project review">
      <Feedback {...m} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          m.run(async () => {
            await api(`/admin/projects/${project.id}/review`, {
              method: "POST",
              version: project.version,
              body: {
                status: f.status,
                mentor_id: f.mentor_id || null,
                note: f.note,
                public_approved: false,
              },
            });
            reload();
          });
        }}
      >
        <div className="form-grid">
          <Select label="Next status" name="status">
            {options[project.status].map((s) => (
              <option value={s} key={s}>
                {label(s)}
              </option>
            ))}
          </Select>
          <Field
            label="Approved mentor user ID"
            name="mentor_id"
            defaultValue={project.mentor_id ?? ""}
          />
        </div>
        <Textarea label="Review note" name="note" required />
        <button className="button" disabled={m.busy}>
          Record decision
        </button>
      </form>
    </Card>
  );
}
