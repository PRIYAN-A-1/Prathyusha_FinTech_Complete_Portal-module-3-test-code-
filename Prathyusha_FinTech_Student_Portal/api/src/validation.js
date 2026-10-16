import { z } from "zod";
export const id = z.string().uuid();
export const text = z.string().trim().min(1).max(5000);
export const url = z
  .string()
  .url()
  .max(2048)
  .refine(
    (v) => ["https:", "http:"].includes(new URL(v).protocol),
    "Use HTTP or HTTPS",
  );
export const date = z.string().date();
export const lists = z.array(z.string().trim().min(1).max(100)).max(40);
export const profile = z
  .object({
    display_name: z.string().trim().min(1).max(100),
    bio: z.string().max(2000),
    department: z.string().max(120),
    program: z.string().max(120),
    year_of_study: z.number().int().min(1).max(6).nullable(),
    academic_year: z.string().max(20),
    skills: lists,
    interests: lists,
    portfolio_links: z.array(url).max(8),
    public_consent: z.boolean(),
  })
  .strict();
export const project = z
  .object({
    title: z.string().trim().min(1).max(200),
    domain: z.string().min(1).max(100),
    abstract: text,
    problem_statement: text,
    objectives: text,
    expected_outcome: text,
    technologies: lists,
    repository_url: url.nullable(),
    demo_url: url.nullable(),
    start_date: date,
    target_date: date,
    risks: z.string().max(5000),
  })
  .strict()
  .refine(
    (x) => x.target_date >= x.start_date,
    "Target date precedes start date",
  );
export const task = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000),
    due_date: date,
    assignee_id: id,
    milestone_id: id.nullable().default(null),
  })
  .strict();
export const contribution = z
  .object({
    project_id: id,
    task_id: id.nullable().default(null),
    contribution_date: date,
    work_area: z.string().trim().min(1).max(100),
    description: text,
    outcome: text,
    evidence_links: z.array(url).max(10),
  })
  .strict()
  .refine(
    (x) => x.contribution_date <= new Date().toISOString().slice(0, 10),
    "Future contribution date",
  );
export const page = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const period = z
  .object({ from: date.default("2000-01-01"), to: date.default("2100-12-31") })
  .refine((x) => x.from <= x.to, "Invalid reporting period");
