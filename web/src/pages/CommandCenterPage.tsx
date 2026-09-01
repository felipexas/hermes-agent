import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  Database,
  Gauge,
  MessageSquareText,
  Radio,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  UsersRound,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  CronJob,
  ProfileInfo,
  SessionInfo,
  StatusResponse,
} from "@/lib/api";
import "./command-center.css";

interface CommandCenterState {
  status: StatusResponse;
  sessions: SessionInfo[];
  sessionTotal: number;
  cronJobs: CronJob[];
  profiles: ProfileInfo[];
}

function formatTime(epochSeconds: number): string {
  if (!epochSeconds) return "No activity";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(epochSeconds * 1000));
}

function platformTone(state: string): "good" | "warn" | "quiet" {
  const value = state.toLowerCase();
  if (["connected", "running", "ready", "healthy", "online"].includes(value)) {
    return "good";
  }
  if (["error", "failed", "disconnected", "degraded"].includes(value)) {
    return "warn";
  }
  return "quiet";
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Activity;
}) {
  return (
    <div className="cc-metric">
      <div className="cc-metric-icon" aria-hidden="true">
        <Icon />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

function SectionHeading({
  index,
  title,
  eyebrow,
  href,
}: {
  index: string;
  title: string;
  eyebrow: string;
  href: string;
}) {
  return (
    <header className="cc-section-heading">
      <div className="cc-section-index">{index}</div>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <Link to={href} aria-label={`Open ${title}`}>
        Open <ArrowUpRight aria-hidden="true" />
      </Link>
    </header>
  );
}

export default function CommandCenterPage() {
  const [data, setData] = useState<CommandCenterState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [status, sessions, cronJobs, profiles] = await Promise.all([
        api.getStatus(),
        api.getSessions(6, 0, "", "recent"),
        api.getCronJobs("all"),
        api.getProfiles(),
      ]);
      setData({
        status,
        sessions: sessions.sessions,
        sessionTotal: sessions.total,
        cronJobs,
        profiles: profiles.profiles,
      });
      setRefreshedAt(new Date());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Native Hermes APIs did not respond");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const platformEntries = useMemo(
    () => Object.entries(data?.status.gateway_platforms ?? {}),
    [data?.status.gateway_platforms],
  );
  const enabledJobs = data?.cronJobs.filter((job) => job.enabled) ?? [];
  const runningProfiles = data?.profiles.filter((profile) => profile.gateway_running) ?? [];
  const gatewayOnline = data?.status.gateway_running === true;

  if (loading && !data) {
    return (
      <main className="cc-shell cc-loading" aria-busy="true">
        <div className="cc-loader-mark">L</div>
        <p>Synchronizing native Hermes telemetry…</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="cc-shell cc-failure">
        <CircleAlert aria-hidden="true" />
        <p className="cc-kicker">Native telemetry boundary</p>
        <h1>Live telemetry unavailable</h1>
        <p>{error}</p>
        <div>
          <button type="button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> Retry connection
          </button>
          <Link to="/system">Open System</Link>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const memoryPressure = data.status.memory?.pressure ?? "unknown";
  const diskPercent = data.status.disk?.used_percent;

  return (
    <main className="cc-shell">
      <section className="cc-hero" aria-labelledby="command-center-title">
        <div className="cc-hero-copy">
          <div className="cc-kicker-row">
            <span className="cc-kicker">Labophase / native Hermes control plane</span>
            <span className={`cc-live ${gatewayOnline ? "is-live" : "is-down"}`}>
              <span aria-hidden="true" />
              {gatewayOnline ? "Gateway online" : "Gateway offline"}
            </span>
          </div>
          <h1 id="command-center-title">
            Command <em>Center</em>
          </h1>
          <p>
            One operational surface for conversations, automations, channels, and the
            agent fleet—read directly from this Hermes instance.
          </p>
        </div>

        <div className="cc-hero-actions">
          <Link className="cc-primary-action" to="/chat">
            <TerminalSquare aria-hidden="true" /> Open live console
          </Link>
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "cc-spin" : ""} aria-hidden="true" />
            Refresh
          </button>
          <small>
            {refreshedAt ? `Synced ${refreshedAt.toLocaleTimeString()}` : "Not yet synced"}
          </small>
        </div>

        <div className="cc-telemetry-rail" aria-label="Hermes telemetry summary">
          <Metric
            label="Sessions"
            value={`${data.sessionTotal} sessions`}
            note={`${data.status.active_sessions} active now`}
            icon={MessageSquareText}
          />
          <Metric
            label="Agent fleet"
            value={`${data.profiles.length} profiles`}
            note={`${runningProfiles.length} gateways reporting`}
            icon={UsersRound}
          />
          <Metric
            label="Automations"
            value={`${enabledJobs.length} enabled`}
            note={`${data.cronJobs.length} configured jobs`}
            icon={CalendarClock}
          />
          <Metric
            label="System"
            value={memoryPressure === "ok" ? "Nominal" : memoryPressure}
            note={diskPercent == null ? `Hermes ${data.status.version}` : `${diskPercent}% disk used`}
            icon={Gauge}
          />
        </div>
      </section>

      <div className="cc-grid">
        <section className="cc-panel cc-workstream">
          <SectionHeading index="01" eyebrow="Recent operational trail" title="Live workstream" href="/sessions" />
          <div className="cc-session-list">
            {data.sessions.length === 0 ? (
              <div className="cc-empty">No sessions have reported activity yet.</div>
            ) : (
              data.sessions.map((session, index) => (
                <Link className="cc-session" to={`/sessions/${session.id}`} key={session.id}>
                  <div className="cc-session-order">{String(index + 1).padStart(2, "0")}</div>
                  <div className="cc-session-main">
                    <div>
                      <strong>{session.title || "Untitled Hermes session"}</strong>
                      <span className={session.is_active ? "is-active" : ""}>
                        {session.is_active ? "Working" : session.source || "session"}
                      </span>
                    </div>
                    <p>{session.preview || "No session preview was recorded."}</p>
                    <footer>
                      <span>{formatTime(session.last_active)}</span>
                      <span>{session.message_count} messages</span>
                      <span>{session.tool_call_count} tool calls</span>
                    </footer>
                  </div>
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              ))
            )}
          </div>
        </section>

        <aside className="cc-panel cc-gateway-panel">
          <SectionHeading index="02" eyebrow="Gateway transport matrix" title="Signal grid" href="/channels" />
          <div className="cc-gateway-core">
            <div className={`cc-orbit ${gatewayOnline ? "is-live" : "is-down"}`}>
              <div><Bot aria-hidden="true" /></div>
              <span>Hermes</span>
              <strong>{data.status.gateway_state || (gatewayOnline ? "running" : "offline")}</strong>
            </div>
            <div className="cc-platform-list">
              {platformEntries.length === 0 ? (
                <p>No messaging platforms are configured.</p>
              ) : (
                platformEntries.slice(0, 6).map(([name, platform]) => (
                  <div className="cc-platform" key={name}>
                    <span className={`cc-state-dot is-${platformTone(platform.state)}`} aria-hidden="true" />
                    <strong>{name.replaceAll("_", " ")}</strong>
                    <small>{platform.state}</small>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="cc-security-line">
            <ShieldCheck aria-hidden="true" />
            <span>Native authenticated API</span>
            <strong>{data.status.auth_required ? "Gated" : "Local session"}</strong>
          </div>
        </aside>

        <section className="cc-panel cc-automation-panel">
          <SectionHeading index="03" eyebrow="Scheduled intelligence" title="Automation queue" href="/cron" />
          <div className="cc-automation-list">
            {data.cronJobs.slice(0, 4).map((job) => (
              <Link to="/cron" className="cc-automation" key={job.id}>
                <div className={job.enabled ? "is-enabled" : ""} aria-hidden="true">
                  <Clock3 />
                </div>
                <div>
                  <strong>{job.name || "Unnamed automation"}</strong>
                  <span>{job.schedule_display || job.schedule?.display || "Schedule unavailable"}</span>
                </div>
                <small>{job.enabled ? job.last_status || "armed" : "paused"}</small>
              </Link>
            ))}
            {data.cronJobs.length === 0 && <div className="cc-empty">No automations configured.</div>}
          </div>
        </section>

        <section className="cc-panel cc-fleet-panel">
          <SectionHeading index="04" eyebrow="Profile topology" title="Agent fleet" href="/profiles" />
          <div className="cc-fleet-list">
            {data.profiles.slice(0, 6).map((profile) => (
              <Link to={`/profiles?profile=${encodeURIComponent(profile.name)}`} key={profile.name}>
                <div className="cc-avatar">{profile.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{profile.display_name || profile.name}</strong>
                  <span>{profile.model || profile.provider || "Uses inherited model"}</span>
                </div>
                <span className={profile.gateway_running ? "is-online" : ""}>
                  {profile.gateway_running ? "online" : "standby"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <footer className="cc-footer">
        <span><Sparkles aria-hidden="true" /> Labophase native surface</span>
        <span><Database aria-hidden="true" /> Canonical Hermes APIs</span>
        <span><Cpu aria-hidden="true" /> v{data.status.version}</span>
        <Link to="/system"><ServerCog aria-hidden="true" /> System control <ArrowUpRight aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}
