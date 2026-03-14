import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import RoadmapWaveVisual from '@/components/roadmap/RoadmapWaveVisual';

import {
  CRITICAL_PATH,
  ROADMAP_PHASES,
  ROADMAP_PROJECT_URL,
  ROADMAP_REPO_URL,
  issueUrl,
  type RoadmapExecution,
  type RoadmapIssue,
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

const EXECUTION_COPY: Record<RoadmapExecution, string> = {
  'agent-ready': 'Can run unattended once dependencies are in place.',
  'human-blocked': 'Needs product, creative, or asset decisions first.',
  'validate-first': 'Needs a tighter repro or trace before code churn.',
};

const PHASE_THEME_CLASS = [
  'roadmap-phase--ember',
  'roadmap-phase--lagoon',
  'roadmap-phase--cobalt',
  'roadmap-phase--rose',
  'roadmap-phase--jade',
  'roadmap-phase--gold',
] as const;

type RoadmapWindow = 'now' | 'next' | 'later';

const WINDOW_LABELS: Record<RoadmapWindow, string> = {
  now: 'Right now',
  next: 'Up next',
  later: 'Later waves',
};

const issueLookup = new Map(
  ROADMAP_PHASES.flatMap((phase) => phase.issues.map((issue) => [issue.number, issue] as const)),
);

const dependentLookup = new Map<number, RoadmapIssue[]>();
for (const phase of ROADMAP_PHASES) {
  for (const issue of phase.issues) {
    for (const dependency of issue.blockedBy ?? []) {
      const dependents = dependentLookup.get(dependency) ?? [];
      dependents.push(issue);
      dependentLookup.set(dependency, dependents);
    }
  }
}

const criticalPathSet = new Set(CRITICAL_PATH);
const criticalPathIssues = CRITICAL_PATH.map((issueNumber) => issueLookup.get(issueNumber)).filter(
  (issue): issue is RoadmapIssue => Boolean(issue),
);

const executionCounts = ROADMAP_PHASES.flatMap((phase) => phase.issues).reduce(
  (counts, issue) => {
    counts[issue.execution] += 1;
    return counts;
  },
  {
    'agent-ready': 0,
    'human-blocked': 0,
    'validate-first': 0,
  } as Record<RoadmapExecution, number>,
);

const totalIssues = ROADMAP_PHASES.reduce((count, phase) => count + phase.issues.length, 0);

const FOCUS_WINDOWS = [
  {
    key: 'now',
    stage: '01',
    detailTarget: 'phase-0',
    eyebrow: 'Unlock first',
    title: 'Remote-first foundations',
    summary: 'Make QA, assets, and proof portable enough for unattended remote work.',
    benefits: ['Portable QA', 'Published assets', 'Reviewable proof'],
    issueNumbers: [66, 65, 29, 35, 36, 46],
  },
  {
    key: 'next',
    stage: '02',
    detailTarget: 'phase-2',
    eyebrow: 'Unlock second',
    title: 'Resume + checkpoints',
    summary: 'Let players return anytime and let QA jump straight to seeded states.',
    benefits: ['Return to map', 'Resume state', 'Checkpoint seeds'],
    issueNumbers: [37, 38, 47, 48, 49, 51],
  },
  {
    key: 'later',
    stage: '03',
    detailTarget: 'phase-3',
    eyebrow: 'Then accelerate',
    title: 'Polish + expansion',
    summary: 'Only after the foundation holds should Tong widen into UX polish, KG, and starter packs.',
    benefits: ['Playtest polish', 'KG rollout', 'Starter packs'],
    issueNumbers: [31, 17, 19, 53, 60, 69],
  },
] as const;

function trimTitle(title: string, maxLength: number) {
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength - 1).trimEnd()}...`;
}

function getPhaseWindow(index: number): RoadmapWindow {
  if (index <= 1) return 'now';
  if (index === 2) return 'next';
  return 'later';
}

function IssueReferenceChip({
  issue,
  compact = false,
}: {
  issue: RoadmapIssue;
  compact?: boolean;
}) {
  return (
    <a
      href={issueUrl(issue.number)}
      target="_blank"
      rel="noopener noreferrer"
      className={`roadmap-issue-chip${compact ? ' roadmap-issue-chip--compact' : ''}`}
    >
      <strong>#{issue.number}</strong>
      <span>{trimTitle(issue.title, compact ? 32 : 52)}</span>
    </a>
  );
}

function RoadmapIssueCard({ issue }: { issue: RoadmapIssue }) {
  const dependencies = (issue.blockedBy ?? [])
    .map((issueNumber) => issueLookup.get(issueNumber))
    .filter((value): value is RoadmapIssue => Boolean(value));
  const dependents = dependentLookup.get(issue.number) ?? [];
  const isCritical = criticalPathSet.has(issue.number);

  return (
    <article className={`roadmap-issue-card${isCritical ? ' roadmap-issue-card--critical' : ''}`}>
      <div className="roadmap-issue-head">
        <div className="roadmap-issue-identity">
          <span className="roadmap-issue-number">#{issue.number}</span>
          {isCritical ? <span className="roadmap-issue-flag">Critical path</span> : null}
        </div>
        <span className="pill">{issue.priority}</span>
      </div>

      <h3>
        <a href={issueUrl(issue.number)} target="_blank" rel="noopener noreferrer" className="roadmap-card-link">
          {issue.title}
        </a>
      </h3>

      <div className="roadmap-issue-meta">
        <span className="pill">{issue.lane}</span>
        <span className={EXECUTION_CLASS[issue.execution]}>{EXECUTION_LABELS[issue.execution]}</span>
      </div>

      <p className="roadmap-issue-copy">{issue.note ?? EXECUTION_COPY[issue.execution]}</p>

      <details className="roadmap-issue-details">
        <summary className="roadmap-issue-details-toggle">
          <span>More detail</span>
          <span>
            {dependencies.length
              ? `${dependencies.length} blocker${dependencies.length > 1 ? 's' : ''}`
              : dependents.length
                ? `${dependents.length} unlock${dependents.length > 1 ? 's' : ''}`
                : 'scope + links'}
          </span>
        </summary>

        <div className="roadmap-issue-details-body">
          <p className="roadmap-issue-detail-copy">
            {isCritical
              ? 'This issue sits directly on the current critical path.'
              : 'This issue matters inside the wider wave rather than the shortest unblocker chain.'}
          </p>

          {dependencies.length ? (
            <div className="roadmap-link-cluster">
              <span className="roadmap-link-label">Blocked by</span>
              <div className="roadmap-chip-row">
                {dependencies.map((dependency) => (
                  <IssueReferenceChip key={dependency.number} issue={dependency} compact />
                ))}
              </div>
            </div>
          ) : null}

          {dependents.length ? (
            <div className="roadmap-link-cluster">
              <span className="roadmap-link-label">Unlocks</span>
              <div className="roadmap-chip-row">
                {dependents.map((dependent) => (
                  <IssueReferenceChip key={dependent.number} issue={dependent} compact />
                ))}
              </div>
            </div>
          ) : null}

          <div className="roadmap-issue-footer">
            <a href={issueUrl(issue.number)} target="_blank" rel="noopener noreferrer" className="roadmap-open-link">
              Open issue
            </a>
          </div>
        </div>
      </details>
    </article>
  );
}

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
          <a href={ROADMAP_REPO_URL} target="_blank" rel="noopener noreferrer" className="nav-link">
            GitHub Repo
          </a>
          <a href={ROADMAP_PROJECT_URL} target="_blank" rel="noopener noreferrer" className="nav-link">
            GitHub Project
          </a>
        </div>
      </nav>

      <section className="roadmap-hero">
        <div className="roadmap-hero-copy">
          <div className="roadmap-hero-grid">
            <div className="roadmap-hero-copy-column">
              <span className="kicker">Roadmap</span>
              <h1 className="roadmap-title">Tong, in three waves.</h1>
              <p className="roadmap-subhead">
                Remote-first foundations first. Resume and deterministic checkpoints second. Polish, KG, and starter
                content after that.
              </p>
              <div className="roadmap-actions">
                <a href={ROADMAP_PROJECT_URL} target="_blank" rel="noopener noreferrer" className="button">
                  Open GitHub Project
                </a>
                <a href="#roadmap-critical-path" className="button secondary">
                  Jump To Critical Path
                </a>
              </div>
            </div>

            <RoadmapWaveVisual />
          </div>

          <div className="roadmap-signal-row">
            <div className="roadmap-signal-pill">
              <span>Critical path</span>
              <strong>{CRITICAL_PATH.length}</strong>
            </div>
            <div className="roadmap-signal-pill">
              <span>Agent-ready</span>
              <strong>{executionCounts['agent-ready']}</strong>
            </div>
            <div className="roadmap-signal-pill">
              <span>Total scope</span>
              <strong>{totalIssues}</strong>
            </div>
            <div className="roadmap-signal-pill roadmap-signal-pill--muted">
              <span>Human-blocked</span>
              <strong>{executionCounts['human-blocked']}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="roadmap-waves">
        <div className="roadmap-section-head roadmap-section-head--tight">
          <div>
            <span className="kicker">Now / Next / Later</span>
            <h2>One sequence, three waves</h2>
          </div>
          <p>Each wave only exists to unlock the next one.</p>
        </div>

        <div className="roadmap-focus-grid">
          {FOCUS_WINDOWS.map((window) => (
            <article key={window.key} className={`roadmap-focus-card roadmap-focus-card--${window.key}`}>
              <div className="roadmap-focus-card-head">
                <span className="roadmap-focus-stage">{window.stage}</span>
                <span className="roadmap-focus-eyebrow">{window.eyebrow}</span>
              </div>
              <h2>{window.title}</h2>
              <p>{window.summary}</p>
              <div className="roadmap-chip-row">
                {window.benefits.map((benefit) => (
                  <span key={benefit} className="roadmap-mini-chip">
                    {benefit}
                  </span>
                ))}
              </div>
              <div className="roadmap-focus-footer">
                <span className="pill">{window.issueNumbers.length} issues</span>
                <a href={`#${window.detailTarget}`} className="roadmap-open-link">
                  See details
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="roadmap-critical-path" className="roadmap-critical-section card">
        <div className="roadmap-section-head">
          <div>
            <span className="kicker">Critical Path</span>
            <h2>The shortest route to reliable remote execution</h2>
          </div>
          <p>
            This is the dependency spine. If these do not land in order, the rest of the backlog stays slower,
            noisier, and harder for agents or reviewers to trust.
          </p>
        </div>

        <div className="roadmap-critical-strip">
          {criticalPathIssues.map((issue, index) => (
            <article key={issue.number} className="roadmap-critical-card">
              <div className="roadmap-critical-step">Step {index + 1}</div>
              <a href={issueUrl(issue.number)} target="_blank" rel="noopener noreferrer" className="roadmap-card-link">
                #{issue.number} {issue.title}
              </a>
              <div className="roadmap-critical-meta">
                <span className="pill">{issue.priority}</span>
                <span className="pill">{issue.lane}</span>
              </div>
              {issue.blockedBy?.length ? (
                <p className="roadmap-critical-note">
                  Needs{' '}
                  {issue.blockedBy.map((dependency, dependencyIndex) => (
                    <span key={dependency}>
                      {dependencyIndex > 0 ? ', ' : null}
                      <a href={issueUrl(dependency)} target="_blank" rel="noopener noreferrer">
                        #{dependency}
                      </a>
                    </span>
                  ))}
                </p>
              ) : (
                <p className="roadmap-critical-note">No upstream blocker inside the roadmap.</p>
              )}
            </article>
          ))}
        </div>

        <div className="roadmap-legend">
          {(['agent-ready', 'validate-first', 'human-blocked'] as RoadmapExecution[]).map((mode) => (
            <div key={mode} className="roadmap-legend-row">
              <span className={EXECUTION_CLASS[mode]}>{EXECUTION_LABELS[mode]}</span>
              <p>{EXECUTION_COPY[mode]}</p>
            </div>
          ))}
        </div>
      </section>

      <details className="roadmap-queue-details">
        <summary className="roadmap-queue-toggle">
          <span>Issue map</span>
          <span>{totalIssues} issues with dependencies and drill-down</span>
        </summary>

        <div className="roadmap-queue-body">
          <section className="roadmap-phase-stack">
            {ROADMAP_PHASES.map((phase, index) => {
              const agentReadyCount = phase.issues.filter((issue) => issue.execution === 'agent-ready').length;
              const humanBlockedCount = phase.issues.filter((issue) => issue.execution === 'human-blocked').length;
              const phaseWindow = getPhaseWindow(index);

              return (
                <article
                  id={phase.id}
                  key={phase.id}
                  className={`roadmap-phase ${PHASE_THEME_CLASS[index % PHASE_THEME_CLASS.length]}`}
                >
                  <div className="roadmap-phase-rail">
                    <span className="roadmap-phase-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="roadmap-phase-tag">{phase.label}</span>
                    <span className={`roadmap-window-tag roadmap-window-tag--${phaseWindow}`}>
                      {WINDOW_LABELS[phaseWindow]}
                    </span>
                    <p className="roadmap-phase-outcome">{phase.outcome}</p>
                    <div className="roadmap-phase-stats">
                      <div>
                        <span>Issues</span>
                        <strong>{phase.issues.length}</strong>
                      </div>
                      <div>
                        <span>Agent-ready</span>
                        <strong>{agentReadyCount}</strong>
                      </div>
                      <div>
                        <span>Human gates</span>
                        <strong>{humanBlockedCount}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="roadmap-phase-body">
                    <div className="roadmap-phase-head">
                      <div>
                        <h2>{phase.title}</h2>
                        <p className="roadmap-phase-summary">{phase.summary}</p>
                      </div>
                      {index < ROADMAP_PHASES.length - 1 ? (
                        <div className="roadmap-phase-next">
                          <span className="roadmap-link-label">This wave unlocks</span>
                          <strong>{ROADMAP_PHASES[index + 1].title}</strong>
                        </div>
                      ) : null}
                    </div>

                    <details className="roadmap-phase-details" open={index === 0}>
                      <summary className="roadmap-phase-details-toggle">
                        <span>View issues</span>
                        <span>
                          {phase.issues.length} issues · {agentReadyCount} agent-ready · {humanBlockedCount} human-gated
                        </span>
                      </summary>

                      <div className="roadmap-phase-details-body">
                        <div className="roadmap-issue-grid">
                          {phase.issues.map((issue) => (
                            <RoadmapIssueCard key={issue.number} issue={issue} />
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </details>
    </div>
  );
}
