import { useState, useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, upload, fileBlob } from "../api";
import { useResource, useMutation } from "../state";
import type { Profile as ProfileData, Correction } from "../types";
import {
  Heading,
  Card,
  Field,
  Textarea,
  Select,
  Badge,
  Feedback,
  LoadState,
  Table,
  Empty,
} from "../components/UI";
export default function Profile() {
  const resource = useResource<ProfileData>("/me/profile"),
    corrections = useResource<Correction[]>("/me/corrections");
  const [form, setForm] = useState<ProfileData | null>(null),
    [photo, setPhoto] = useState<string>(),
    [tab, setTab] = useState("Profile"),
    [correction, setCorrection] = useState(false);
  const mutation = useMutation();
  useEffect(() => {
    if (resource.data) setForm(resource.data);
  }, [resource.data]);
  useEffect(() => {
    if (!resource.data?.photo_id) {
      setPhoto(undefined);
      return;
    }
    let active = true,
      url: string | undefined;
    fileBlob(`/files/${resource.data.photo_id}`)
      .then((b) => {
        url = URL.createObjectURL(b);
        if (active) setPhoto(url);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [resource.data?.photo_id]);
  function change<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    await mutation.run(async () => {
      const {
        display_name,
        bio,
        department,
        program,
        year_of_study,
        academic_year,
        skills,
        interests,
        portfolio_links,
        public_consent,
      } = form;
      await api("/me/profile", {
        method: "PUT",
        version: form.version,
        body: {
          display_name,
          bio,
          department,
          program,
          year_of_study,
          academic_year,
          skills: skills.map((s) => s.trim()).filter(Boolean),
          interests: interests.map((s) => s.trim()).filter(Boolean),
          portfolio_links: portfolio_links.map((s) => s.trim()).filter(Boolean),
          public_consent,
        },
      });
      resource.reload();
    }, "Profile saved. Consented public changes require coordinator review.");
  }
  return (
    <>
      <Heading
        title="My profile & privacy"
        description="Keep your academic profile current and choose what may appear on the public showcase."
      />
      <div className="tabs">
        {["Profile", "Visibility", "Activity history"].map((t) =>
          t === "Activity history" ? (
            <Link key={t} to="/activity">
              {t}
            </Link>
          ) : (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <LoadState
        loading={resource.loading && !form}
        error={resource.error}
        retry={resource.reload}
      />
      <Feedback {...mutation} />
      {form && (
        <form onSubmit={save}>
          <fieldset disabled={mutation.busy}>
            {tab === "Profile" && (
              <Card title="Profile details">
                <div className="profile-photo">
                  {photo ? (
                    <img src={photo} alt="Your profile" />
                  ) : (
                    <div className="avatar">
                      {form.display_name.slice(0, 1)}
                    </div>
                  )}
                  <label className="file-control">
                    Change profile photo
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          mutation.run(async () => {
                            await upload("/me/profile/photo", file);
                            resource.reload();
                          }, "Profile photo updated");
                        e.target.value = "";
                      }}
                    />
                    <small>JPEG or PNG · up to 5 MB</small>
                  </label>
                </div>
                <div className="form-grid">
                  <Field
                    label="Display name"
                    value={form.display_name}
                    maxLength={100}
                    required
                    onChange={(e) => change("display_name", e.target.value)}
                  />
                  <Field
                    label="Department"
                    value={form.department}
                    onChange={(e) => change("department", e.target.value)}
                  />
                  <Field
                    label="Programme"
                    value={form.program}
                    onChange={(e) => change("program", e.target.value)}
                  />
                  <Select
                    label="Year of study"
                    value={form.year_of_study ?? ""}
                    onChange={(e) =>
                      change(
                        "year_of_study",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">Select year</option>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        Year {n}
                      </option>
                    ))}
                  </Select>
                  <Field
                    label="Academic year"
                    value={form.academic_year}
                    placeholder="2026–27"
                    onChange={(e) => change("academic_year", e.target.value)}
                  />
                  <Field
                    label="Skills"
                    value={form.skills.join(",")}
                    hint="Comma separated"
                    onChange={(e) =>
                      change("skills", e.target.value.split(","))
                    }
                  />
                  <Field
                    label="Fintech interests"
                    value={form.interests.join(",")}
                    hint="Comma separated"
                    onChange={(e) =>
                      change("interests", e.target.value.split(","))
                    }
                  />
                  <Field
                    label="Portfolio links"
                    value={form.portfolio_links.join(",")}
                    hint="Full URLs, comma separated"
                    onChange={(e) =>
                      change("portfolio_links", e.target.value.split(","))
                    }
                  />
                </div>
                <Textarea
                  label="Bio"
                  value={form.bio}
                  maxLength={2000}
                  onChange={(e) => change("bio", e.target.value)}
                />
              </Card>
            )}
            {tab === "Visibility" && (
              <Card title="Public profile controls">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.public_consent}
                    onChange={(e) => change("public_consent", e.target.checked)}
                  />
                  Request publication of my profile
                </label>
                <p>
                  Publishing requires your consent and coordinator approval. New
                  changes return to review.
                </p>
                <Badge status={form.publication_status} />
                <h3>Public preview</h3>
                <p>
                  {form.display_name} · {form.program} / Year{" "}
                  {form.year_of_study ?? "—"}
                </p>
                <p>{form.bio}</p>
                <div className="tags">
                  {form.skills.filter(Boolean).map((s, i) => (
                    <span className="badge" key={i}>
                      {s}
                    </span>
                  ))}
                </div>
                <p className="muted">
                  Always private: register number, email, contact details,
                  feedback and evidence.
                </p>
              </Card>
            )}
            <Card title="Protected information">
              <div className="form-grid">
                <Field label="Official name" value={form.full_name} readOnly />
                <Field
                  label="Register number"
                  value={form.register_number}
                  readOnly
                />
                <Field label="Email" value={form.email} readOnly />
                <div>
                  <p>Membership status</p>
                  <Badge status={form.membership_status} />
                </div>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={() => setCorrection(!correction)}
              >
                Request correction
              </button>
            </Card>
            <div className="actions">
              <button className="button" disabled={mutation.busy}>
                {mutation.busy ? "Saving…" : "Save profile"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {correction && (
        <CorrectionForm
          onSaved={() => {
            setCorrection(false);
            corrections.reload();
          }}
        />
      )}
      {form && (
        <Card title="Assigned projects & mentor">
          {form.assignments.length ? (
            <Table headers={["Project", "Assigned role", "Mentor"]}>
              {form.assignments.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link className="text-link" to={`/projects/${a.id}`}>
                      {a.title}
                    </Link>
                  </td>
                  <td>{a.assigned_role}</td>
                  <td>{a.mentor ?? "Not assigned"}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No assignments yet.</Empty>
          )}
        </Card>
      )}
      {!!corrections.data?.length && (
        <Card title="Correction requests">
          <ul className="activity-list">
            {corrections.data.map((c) => (
              <li key={c.id}>
                <div>
                  {c.field}: {c.requested_value}
                  <p className="muted">{c.review_note || c.reason}</p>
                </div>
                <Badge status={c.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
function CorrectionForm({ onSaved }: { onSaved: () => void }) {
  const m = useMutation();
  return (
    <Card title="Request a protected-field correction">
      <Feedback {...m} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          m.run(async () => {
            await api("/me/corrections", {
              method: "POST",
              body: Object.fromEntries(f),
            });
            onSaved();
          });
        }}
      >
        <Select label="Field" name="field">
          <option value="register_number">Register number</option>
          <option value="full_name">Official name</option>
          <option value="email">Email</option>
        </Select>
        <Field
          label="Correct value"
          name="requested_value"
          required
          maxLength={200}
        />
        <Textarea label="Reason" name="reason" required />
        <button className="button" disabled={m.busy}>
          Send request
        </button>
      </form>
    </Card>
  );
}
