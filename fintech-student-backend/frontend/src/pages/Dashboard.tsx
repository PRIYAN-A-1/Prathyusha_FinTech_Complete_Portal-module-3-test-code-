import { Link } from "react-router-dom";
import { RefreshCw, Plus } from "lucide-react";
import { useResource } from "../state";
import type { Dashboard as DashboardData } from "../types";
import {
  Heading,
  Stats,
  Card,
  Table,
  Empty,
  LoadState,
  Badge,
  day,
  label,
  ProjectLink,
} from "../components/UI";
export default function Dashboard() {
  const { data, error, loading, reload } = useResource<DashboardData>(
    "/me/dashboard",
    { poll: 30000 },
  );
  return (
    <>
      <Heading
        title={
          data
            ? `Make this week count, ${data.profile.display_name.split(" ")[0]}.`
            : "Your FinTech workspace."
        }
        description="Your projects, individual contributions and review activity in one place."
        actions={
          <button
            className="button secondary small"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} retry={reload} />
      {data && (
        <>
          <Stats
            items={[
              { label: "Active projects", value: data.counts.active_projects },
              {
                label: "Submitted contributions",
                value: data.counts.submitted_contributions,
              },
              {
                label: "Verified contributions",
                value: data.counts.verified_contributions,
              },
              {
                label: "Update needs revision",
                value: data.counts.updates_needing_revision,
              },
            ]}
          />
          <Card title="This week’s priority" className="priority">
            {data.priority ? (
              <>
                <p className="gold">{data.priority.title}</p>
                <p>{data.priority.plan}</p>
                {data.priority.feedback && (
                  <p>Mentor feedback: {data.priority.feedback}</p>
                )}
              </>
            ) : (
              <p>
                No weekly plan has been received for this week. Your
                weekly-update module will provide it here.
              </p>
            )}
            <Link to="/summary" className="button">
              View activity summary
            </Link>
          </Card>
          <Card title="My active work">
            {data.active_work.length ? (
              <Table headers={["Project", "Next milestone", "Status"]}>
                {data.active_work.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <ProjectLink id={p.id}>{p.title}</ProjectLink>
                    </td>
                    <td>{p.next_milestone ?? "No incomplete milestone"}</td>
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
                No active projects yet.
              </Empty>
            )}
          </Card>
          <Card title="Recent activity">
            {data.recent_activity.length ? (
              <ul className="activity-list">
                {data.recent_activity.map((a, i) => (
                  <li key={i}>
                    <span>{label(a.action)}</span>
                    <small>{day(a.created_at)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Your activity will appear as you start working.</Empty>
            )}
          </Card>
          <div className="actions">
            <Link className="button" to="/contributions/new">
              <Plus size={16} />
              Add contribution
            </Link>
            <Link className="button secondary" to="/activity">
              Activity history
            </Link>
          </div>
          <p className="fine-print">
            Refreshes every 30 seconds · {data.unread_notifications} unread
            notifications
          </p>
        </>
      )}
    </>
  );
}
