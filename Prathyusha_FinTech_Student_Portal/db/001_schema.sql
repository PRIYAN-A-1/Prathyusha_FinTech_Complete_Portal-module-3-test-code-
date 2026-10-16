BEGIN;
CREATE TABLE users (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL CHECK(email=lower(email)), password_hash text NOT NULL,
 full_name text NOT NULL, register_number text UNIQUE NOT NULL,
 role text NOT NULL DEFAULT 'STUDENT' CHECK(role IN ('STUDENT','ADMIN','SUPER_ADMIN','MENTOR')),
 membership_status text NOT NULL DEFAULT 'PENDING' CHECK(membership_status IN ('PENDING','APPROVED','REJECTED','SUSPENDED','INACTIVE','CLARIFICATION_REQUIRED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE profiles (
 user_id uuid PRIMARY KEY REFERENCES users(id), display_name text NOT NULL, bio text NOT NULL DEFAULT '',
 department text NOT NULL DEFAULT '', program text NOT NULL DEFAULT '', year_of_study integer CHECK(year_of_study BETWEEN 1 AND 6), academic_year text NOT NULL DEFAULT '',
 skills jsonb NOT NULL DEFAULT '[]', interests jsonb NOT NULL DEFAULT '[]', portfolio_links jsonb NOT NULL DEFAULT '[]',
 photo_id uuid, public_consent boolean NOT NULL DEFAULT false, publication_status text NOT NULL DEFAULT 'PRIVATE' CHECK(publication_status IN ('PRIVATE','PENDING','APPROVED','REJECTED')),
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_user ON auth_sessions(user_id);
CREATE TABLE auth_attempts (email text PRIMARY KEY, failures integer NOT NULL, window_start timestamptz NOT NULL);
CREATE TABLE projects (
 id uuid PRIMARY KEY, title text NOT NULL, domain text NOT NULL, abstract text NOT NULL DEFAULT '', problem_statement text NOT NULL DEFAULT '', objectives text NOT NULL DEFAULT '', expected_outcome text NOT NULL DEFAULT '',
 technologies jsonb NOT NULL DEFAULT '[]', repository_url text, demo_url text, start_date date NOT NULL, target_date date NOT NULL CHECK(target_date>=start_date),
 status text NOT NULL DEFAULT 'PROPOSED' CHECK(status IN ('PROPOSED','APPROVED','ACTIVE','ON_HOLD','COMPLETED','ARCHIVED')),
 lead_id uuid NOT NULL REFERENCES users(id), mentor_id uuid REFERENCES users(id), risks text NOT NULL DEFAULT '', review_notes text NOT NULL DEFAULT '', public_approved boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE project_members (project_id uuid REFERENCES projects(id), user_id uuid REFERENCES users(id), assigned_role text NOT NULL, PRIMARY KEY(project_id,user_id));
CREATE INDEX members_user ON project_members(user_id);
CREATE TABLE milestones (id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES projects(id),title text NOT NULL,due_date date NOT NULL,status text NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','SUBMITTED','REVIEWED','COMPLETED')));
CREATE TABLE tasks (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES projects(id),milestone_id uuid REFERENCES milestones(id),assignee_id uuid NOT NULL REFERENCES users(id),
 title text NOT NULL,description text NOT NULL DEFAULT '',due_date date NOT NULL, status text NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','SUBMITTED','REVIEWED','COMPLETED')),
 blocker text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,assignee_id) REFERENCES project_members(project_id,user_id)
);
CREATE INDEX tasks_assignee ON tasks(assignee_id,due_date);
CREATE TABLE contributions (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES projects(id),user_id uuid NOT NULL REFERENCES users(id),task_id uuid REFERENCES tasks(id),
 contribution_date date NOT NULL,work_area text NOT NULL,description text NOT NULL,outcome text NOT NULL,evidence_links jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','RECOMMENDED','REVISION_REQUIRED','VERIFIED')),
 review_note text NOT NULL DEFAULT '',reviewer_id uuid REFERENCES users(id),reviewed_at timestamptz,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,user_id) REFERENCES project_members(project_id,user_id)
);
CREATE INDEX contributions_owner_date ON contributions(user_id,contribution_date);
CREATE TABLE files (id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id),contribution_id uuid REFERENCES contributions(id),kind text NOT NULL CHECK(kind IN ('PHOTO','EVIDENCE')),original_name text NOT NULL,storage_key text UNIQUE NOT NULL,mime_type text NOT NULL,size_bytes integer NOT NULL CHECK(size_bytes>0),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE profiles ADD CONSTRAINT profile_photo_fk FOREIGN KEY(photo_id) REFERENCES files(id);
CREATE TABLE corrections (id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),field text NOT NULL CHECK(field IN ('full_name','register_number','email')),requested_value text NOT NULL,reason text NOT NULL,status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),review_note text NOT NULL DEFAULT '',reviewer_id uuid REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX one_pending_correction ON corrections(user_id,field) WHERE status='PENDING';
CREATE TABLE notifications (id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),message text NOT NULL,target_type text,target_id uuid,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX notifications_owner ON notifications(user_id,created_at DESC);
CREATE TABLE audit_logs (id uuid PRIMARY KEY,actor_id uuid NOT NULL REFERENCES users(id),subject_id uuid NOT NULL REFERENCES users(id),action text NOT NULL,target_type text NOT NULL,target_id uuid NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX activity_owner ON audit_logs(subject_id,created_at DESC);
-- Read models populated by other module owners through the restricted integration endpoint.
CREATE TABLE activity_records (source text NOT NULL,external_id text NOT NULL,user_id uuid NOT NULL REFERENCES users(id),project_id uuid REFERENCES projects(id),kind text NOT NULL CHECK(kind IN ('WEEKLY_UPDATE','HACKATHON','ACHIEVEMENT')),status text NOT NULL CHECK(status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','REVISION_REQUIRED','VERIFIED','PARTICIPATED')),title text NOT NULL,plan text NOT NULL DEFAULT '',feedback text NOT NULL DEFAULT '',occurred_on date NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source,external_id));
CREATE INDEX activity_record_owner ON activity_records(user_id,occurred_on);
COMMIT;
