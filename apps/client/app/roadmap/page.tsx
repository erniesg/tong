import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import {
  CRITICAL_PATH,
  ROADMAP_PHASES,
  ROADMAP_PROJECT_URL,
  issueUrl,
  type RoadmapExecution,
} from '@/lib/content/roadmap';

export const metadata: Metadata = {
  title: 'Tong Roadmap',
  description:
    'The execution roadmap for Tong: unlock order, dependencies, human blockers, and agent-ready work.',
};

const EXECUTION_LABELS: Record<RoadmapExecution, string> = {
  'agent-ready': 'Agent-ready',
  'human-blocked': 'Human decision',
  'validate-first': 'Validate first',
};

const EXECUTION_CLASS: Record<RoadmapExecution, string> = {
  'agent-ready': 'roadmap-badge roadmap-badge--agent',
  'human-blocked': 'roadmap-badge roadmap-badge--human',
  'validate-first': 'roadmap-badge roadmap-badge--trace',
};

const issueLookup = new Map(
  ROADMAP_PHASES.flatMap((phase) => phase.issues.map((issue) => [issue.number, issue] as const)),
);

export default function RoadmapPage() {
  return (
    <div className="roadmap-shell">
      <nav className="landing-nav roadmap-nav">
        <Link href="/" className="landing-nav-brand">
          <Image
            src="/assets/app/logo_trimmed.png"
            alt="Tong"
            width={30}
            height={30}
            className="landing-nav-logo"
          />
          <div className="landing-brand-cycle">
            <span>tōng</span>
            <span>통</span>
            <span>つう</span>
          </div>
        </Link>
        <div className="landing-nav-links">
          <Link href="/" className="nav-link">
            Home
          </Link>
          <a href={ROADMAP_PROJECT_URL} target="_blank" rel="noopener noreferrer" className="nav-link">
            GitHub Project
          </a>
        </div>
      </nav>

      <section className="roadmap-hero">
        <div className="roadmap-hero-copy">
          <span className="kicker">Roadmap</span>
          <h1 className="roadmap-title">What unlocks Tong next.</h1>
          <p className="roadmap-subhead">
            This page is the readable version of the GitHub project control plane: the actual unlock order,
            the hard dependencies, and the line between agent-ready work and human-blocked creative/product work.
          </p>
          <div className="roadmap-actions">
            <a href={ROADMAP_PROJECT_URL} target="_blank" rel="noopener noreferrer" className="button">
              Open GitHub Project
            </a>
            <a href={issueUrl(29)} target="_blank" rel="noopener noreferrer" className="button secondary">
              Start At Phase 1
            </a>
          </div>
        </div>
        <div className="roadmap-hero-panel">
          <div className="roadmap-hero-metric">
            <span className="roadmap-hero-label">Immediate focus</span>
            <strong>Remote-first foundation</strong>
            <p>Assets, proof, and validation need to work remotely before the rest of the queue gets easier.</p>
          </div>
          <div className="roadmap-hero-metric">
            <span className="roadmap-hero-label">Main tension</span>
            <strong>Agentic work vs human blockers</strong>
            <p>Starter content, visual direction, and some polish issues still need explicit human judgment.</p>
          </div>
        </div>
      </section>

      <section className="roadmap-summary-grid">
        <article className="card roadmap-summary-card">
          <span className="kicker">Critical Path</span>
          <ol className="roadmap-critical-path">
            {CRITICAL_PATH.map((issueNumber) => {
              const issue = issueLookup.get(issueNumber);
              if (!issue) return null;
              return (
                <li key={issueNumber}>
                  <a href={issueUrl(issueNumber)} target="_blank" rel="noopener noreferrer">
                    #{issueNumber}
                  </a>
                  <span>{issue.title}</span>
                </li>
              );
            })}
          </ol>
        </article>

        <article className="card roadmap-summary-card">
          <span className="kicker">Execution Legend</span>
          <div className="roadmap-legend">
            {(['agent-ready', 'validate-first', 'human-blocked'] as RoadmapExecution[]).map((mode) => (
              <div key={mode} className="roadmap-legend-row">
                <span className={EXECUTION_CLASS[mode]}>{EXECUTION_LABELS[mode]}</span>
                <p>
                  {mode === 'agent-ready' && 'Safe to route to unattended implementation once prerequisites are satisfied.'}
                  {mode === 'validate-first' && 'Needs direct reproduction, traces, or technical narrowing before code should move.'}
                  {mode === 'human-blocked' && 'Needs product, creative, or asset direction before pretending this is fully automatable.'}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="card roadmap-summary-card">
          <span className="kicker">Why This Order</span>
          <div className="stack">
            <p>
              Without remote-first assets and reviewer-proof capture, agents can still make diffs but humans cannot
              validate them cleanly.
            </p>
            <p>
              Without checkpoints and resume, QA keeps replaying long flows and players cannot leave and come back
              gracefully.
            </p>
            <p>
              Without an explicit starter-cast asset issue, the city packs falsely look agent-ready when they are still
              blocked on human-generated media.
            </p>
          </div>
        </article>
      </section>

      <section className="roadmap-phases">
        {ROADMAP_PHASES.map((phase) => (
          <article key={phase.id} className="roadmap-phase card">
            <div className="roadmap-phase-head">
              <div>
                <span className="roadmap-phase-tag">{phase.label}</span>
                <h2>{phase.title}</h2>
              </div>
              <p className="roadmap-phase-outcome">{phase.outcome}</p>
            </div>
            <p className="roadmap-phase-summary">{phase.summary}</p>
            <div className="roadmap-issue-grid">
              {phase.issues.map((issue) => (
                <div key={issue.number} className="roadmap-issue-card">
                  <div className="roadmap-issue-head">
                    <a href={issueUrl(issue.number)} target="_blank" rel="noopener noreferrer" className="roadmap-issue-link">
                      #{issue.number}
                    </a>
                    <span className="pill">{issue.priority}</span>
                  </div>
                  <h3>{issue.title}</h3>
                  <div className="roadmap-issue-meta">
                    <span className="pill">{issue.lane}</span>
                    <span className={EXECUTION_CLASS[issue.execution]}>{EXECUTION_LABELS[issue.execution]}</span>
                  </div>
                  {issue.note ? <p>{issue.note}</p> : null}
                  {issue.blockedBy?.length ? (
                    <p className="roadmap-deps">
                      Depends on{' '}
                      {issue.blockedBy.map((dependency, index) => (
                        <span key={dependency}>
                          {index > 0 ? ', ' : null}
                          <a href={issueUrl(dependency)} target="_blank" rel="noopener noreferrer">
                            #{dependency}
                          </a>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
