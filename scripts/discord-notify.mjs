#!/usr/bin/env node
/**
 * Send a compact remote-agent/pipeline summary to Discord.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function truncate(text, max = 950) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length <= max ? value : `${value.slice(0, max - 1).trim()}…`;
}

function readJson(path) {
  if (!path) return null;
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function issueLines(issueResult) {
  const issues = issueResult?.issues || [];
  if (issues.length === 0) return 'No GitHub issues were created or matched.';
  return issues
    .slice(0, 12)
    .map((issue) => {
      const status = issue.action === 'existing' ? 'existing' : issue.action;
      const link = issue.url ? `[#${issue.number || '?'}](${issue.url})` : `#${issue.number || '?'}`;
      return `- ${link} ${status}: ${truncate(issue.title, 120)}`;
    })
    .join('\n');
}

function queueLines(queuePlan) {
  const issues = queuePlan?.issues || [];
  if (issues.length === 0) return 'No queue plan issues were generated.';
  return issues
    .slice(0, 12)
    .map((issue) => {
      const provider = issue.provider?.id || 'codex';
      const action = issue.queue_action || 'n/a';
      const ref = issue.issue_ref || issue.title;
      const lane = issue.recommended_worktree?.id || 'n/a';
      return `- \`${ref}\` via \`${provider}\` in \`${lane}\`: ${action}`;
    })
    .join('\n');
}

function dispatchLines(dispatchResult) {
  const dispatches = dispatchResult?.dispatches || [];
  if (dispatches.length === 0) return '';
  return dispatches
    .slice(0, 12)
    .map((item) => {
      const ref = item.issueRef || 'n/a';
      return `- \`${ref}\` ${item.action} via \`${item.provider}\`${item.branch ? ` on \`${item.branch}\`` : ''}`;
    })
    .join('\n');
}

function buildPayload(args) {
  const issueResult = readJson(args.issues);
  const queuePlan = readJson(args.queue);
  const dispatchResult = readJson(args.dispatch);
  const title = args.title || 'Tong remote-agent pipeline';
  const sessionId = args['session-id'] || issueResult?.sessionId || 'n/a';
  const url = args.url || '';

  const description = [
    args.message ? truncate(args.message, 1500) : '',
    `Session: \`${sessionId}\``,
    url ? `[Open playtest](${url})` : '',
  ].filter(Boolean).join('\n');

  const fields = [
    {
      name: 'Issues',
      value: truncate(issueLines(issueResult), 1024),
    },
    {
      name: 'Remote Queue',
      value: truncate(queueLines(queuePlan), 1024),
    },
  ];
  const dispatchSummary = dispatchLines(dispatchResult);
  if (dispatchSummary) {
    fields.push({
      name: 'Dispatch',
      value: truncate(dispatchSummary, 1024),
    });
  }

  return {
    username: args.username || 'Tong Agent Runner',
    content: args.content || '',
    embeds: [
      {
        title,
        description,
        color: Number.parseInt(args.color || '5865F2', 16),
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function printHelp() {
  console.log(`Usage: node scripts/discord-notify.mjs --webhook-url <url> [options]

Options:
  --webhook-url <url>  Discord webhook URL (default: DISCORD_WEBHOOK_URL)
  --issues <path>      JSON from playtest-analysis-to-issues.mjs
  --queue <path>       remote-plan.json or cloud-plan.json
  --dispatch <path>    JSON from dispatch-remote-agent-queue.mjs
  --session-id <id>    Playtest session id
  --url <url>          Playtest or run URL
  --title <text>       Embed title
  --message <text>     Extra message
  --content <text>     Plain Discord message content
  --dry-run            Print payload without sending
  --output <path>      Write payload JSON
  --help               Show this help`);
}

const { values: args } = parseArgs({
  options: {
    'webhook-url': { type: 'string', default: process.env.DISCORD_WEBHOOK_URL || '' },
    issues: { type: 'string' },
    queue: { type: 'string' },
    dispatch: { type: 'string' },
    'session-id': { type: 'string' },
    url: { type: 'string' },
    title: { type: 'string' },
    message: { type: 'string' },
    content: { type: 'string' },
    username: { type: 'string' },
    color: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    output: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
  strict: false,
});

if (args.help) {
  printHelp();
  process.exit(0);
}

const dryRun = parseBoolean(args['dry-run'], false);
const payload = buildPayload(args);
const rendered = JSON.stringify(payload, null, 2);

if (args.output) {
  writeFileSync(resolve(args.output), `${rendered}\n`);
}

if (dryRun) {
  console.log(rendered);
  process.exit(0);
}

if (!args['webhook-url']) {
  console.error('Missing --webhook-url or DISCORD_WEBHOOK_URL.');
  process.exit(1);
}

const res = await fetch(args['webhook-url'], {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  console.error(`Discord webhook returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, status: res.status }, null, 2));
