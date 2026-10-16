import {
  useId,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
export function Heading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="eyebrow">FINTECH / STUDENT WORKSPACE</div>
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          {description && <p className="muted">{description}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </div>
    </>
  );
}
export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`badge ${["VERIFIED", "APPROVED", "COMPLETED"].includes(status) ? "good" : ["BLOCKED", "REVISION_REQUIRED", "REJECTED", "SUSPENDED"].includes(status) ? "warning" : ""}`}
    >
      {label(status)}
    </span>
  );
}
export function label(v: string) {
  return v
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
}
export function day(v: string) {
  return new Date(v).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
export function Stats({
  items,
}: {
  items: { label: string; value: number; hint?: string }[];
}) {
  return (
    <div
      className="stats"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}
    >
      {items.map((i) => (
        <div className="stat" key={i.label}>
          <span className="number">{String(i.value).padStart(2, "0")}</span>
          <span>{i.label}</span>
          {i.hint && <small>{i.hint}</small>}
        </div>
      ))}
    </div>
  );
}
export function Empty({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
    </>
  );
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (error)
    return (
      <div className="alert error" role="alert">
        {error}{" "}
        <button className="button secondary small" onClick={retry}>
          Retry
        </button>
      </div>
    );
  return loading ? (
    <div className="loading" role="status">
      Loading your workspace…
    </div>
  ) : null;
}
export function Field({
  label: caption,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {caption}
        {props.required ? " *" : ""}
      </span>
      <input id={id} {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select({
  label: caption,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {caption}
        {props.required ? " *" : ""}
      </span>
      <select id={id} {...props}>
        {children}
      </select>
    </label>
  );
}
export function Textarea({
  label: caption,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {caption}
        {props.required ? " *" : ""}
      </span>
      <textarea id={id} rows={4} {...props} />
    </label>
  );
}
export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const ProjectLink = ({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) => (
  <Link className="text-link" to={`/projects/${id}`}>
    {children}
  </Link>
);
export function Progress({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  return (
    <div className="progress">
      <div>
        <span>{label}</span>
        <b>
          {value}/{total}
        </b>
      </div>
      <progress value={value} max={total || 1} aria-label={label} />
    </div>
  );
}
