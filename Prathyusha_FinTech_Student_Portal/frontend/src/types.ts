export type User = { id: string; role: string; membership_status?: string };
export type Profile = {
  user_id: string;
  display_name: string;
  bio: string;
  department: string;
  program: string;
  year_of_study: number | null;
  academic_year: string;
  skills: string[];
  interests: string[];
  portfolio_links: string[];
  photo_id: string | null;
  public_consent: boolean;
  publication_status: string;
  version: number;
  email: string;
  full_name: string;
  register_number: string;
  membership_status: string;
  assignments: {
    id: string;
    title: string;
    assigned_role: string;
    mentor: string | null;
  }[];
};
export type Project = {
  id: string;
  title: string;
  domain: string;
  abstract: string;
  problem_statement: string;
  objectives: string;
  expected_outcome: string;
  technologies: string[];
  repository_url: string | null;
  demo_url: string | null;
  start_date: string;
  target_date: string;
  status: string;
  lead_id: string;
  mentor_id: string | null;
  mentor_name?: string;
  assigned_role?: string;
  risks: string;
  review_notes: string;
  version: number;
  members?: { user_id: string; assigned_role: string; display_name: string }[];
  milestones?: {
    id: string;
    title: string;
    due_date: string;
    status: string;
  }[];
};
export type Task = {
  id: string;
  project_id: string;
  project_title?: string;
  title: string;
  description: string;
  status: string;
  blocker: string;
  due_date: string;
  assignee_id: string;
  version: number;
};
export type Contribution = {
  id: string;
  project_id: string;
  project_title?: string;
  user_id: string;
  task_id: string | null;
  contribution_date: string;
  work_area: string;
  description: string;
  outcome: string;
  evidence_links: string[];
  status: string;
  review_note: string;
  reviewed_at: string | null;
  version: number;
  files?: {
    id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
  }[];
};
export type Summary = {
  active_projects: number;
  assigned_projects: number;
  total_contributions: number;
  reported_contributions: number;
  submitted_contributions: number;
  awaiting_review: number;
  verified_contributions: number;
  contributions_needing_revision: number;
  submitted_weekly_updates: number;
  updates_needing_revision: number;
  hackathon_participations: number;
  verified_achievements: number;
  open_tasks: number;
  blocked_tasks: number;
  overdue_tasks: number;
  by_work_area: { work_area: string; total: number; verified: number }[];
  monthly: { month: string; total: number; verified: number }[];
  source_sync: { source: string; last_received_at: string }[];
};
export type Activity = {
  id?: string;
  action: string;
  target_type: string;
  target_id: string;
  created_at: string;
  details: Record<string, unknown>;
};
export type Notification = {
  id: string;
  message: string;
  read_at: string | null;
  created_at: string;
  target_type: string | null;
  target_id: string | null;
};
export type Dashboard = {
  profile: Pick<
    Profile,
    | "display_name"
    | "department"
    | "academic_year"
    | "year_of_study"
    | "photo_id"
  >;
  counts: Summary;
  active_work: {
    id: string;
    title: string;
    status: string;
    next_milestone: string | null;
  }[];
  priority: { title: string; plan: string; feedback: string } | null;
  recent_activity: Activity[];
  notifications: Notification[];
  unread_notifications: number;
};
export type Correction = {
  id: string;
  user_id: string;
  field: string;
  requested_value: string;
  reason: string;
  status: string;
  review_note: string;
};
