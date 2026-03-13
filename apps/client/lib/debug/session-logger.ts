/**
 * Session Logger — records every AI request, response, tool call, exercise,
 * and user action for full replay / debugging.
 *
 * Data is stored in localStorage and can be exported from the browser console:
 *   sessionLogger.export()         → copies JSON to clipboard
 *   sessionLogger.getAll()         → returns array of all sessions
 *   sessionLogger.getCurrent()     → returns current session log
 */

export interface LogEntry {
  ts: number;
  kind:
    | 'session_start'
    | 'qa_trace'
    | 'ai_request'
    | 'ai_response'
    | 'tool_call'
    | 'tool_result'
    | 'exercise_shown'
    | 'exercise_result'
    | 'choice_shown'
    | 'choice_selected'
    | 'user_tap'
    | 'phase_change'
    | 'scene_summary'
    | 'error';
  data: Record<string, unknown>;
}

export interface SessionLog {
  id: string;
  mode: 'hangout' | 'learn';
  cityId: string;
  locationId: string;
  surface?: string;
  qaRunId?: string;
  npcId?: string;
  playerLevel?: number;
  startedAt: number;
  endedAt?: number;
  entries: LogEntry[];
}

const STORAGE_KEY = 'tong-debug-logs';
const MAX_SESSIONS = 20;

let currentSession: SessionLog | null = null;

function loadSessions(): SessionLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SessionLog[];
  } catch { /* ignore */ }
  return [];
}

function persistSessions(sessions: SessionLog[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch { /* ignore — quota exceeded, etc. */ }
}

function pushEntry(entry: Omit<LogEntry, 'ts'>): void {
  if (!currentSession) return;
  currentSession.entries.push({ ...entry, ts: Date.now() });
  // Also log to console in dev for immediate visibility
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SessionLog] ${entry.kind}`, entry.data);
  }
}

/* ── Public API ───────────────────────────────────────────── */

export const sessionLogger = {
  start(opts: {
    mode: 'hangout' | 'learn';
    cityId: string;
    locationId: string;
    surface?: string;
    qaRunId?: string;
    npcId?: string;
    playerLevel?: number;
  }): void {
    // Save previous session if still open
    if (currentSession) {
      this.end();
    }
    currentSession = {
      id: `${opts.mode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode: opts.mode,
      cityId: opts.cityId,
      locationId: opts.locationId,
      surface: opts.surface,
      qaRunId: opts.qaRunId,
      npcId: opts.npcId,
      playerLevel: opts.playerLevel,
      startedAt: Date.now(),
      entries: [],
    };
    pushEntry({ kind: 'session_start', data: { ...opts } });
  },

  end(): void {
    if (!currentSession) return;
    currentSession.endedAt = Date.now();
    const sessions = loadSessions();
    sessions.unshift(currentSession);
    persistSessions(sessions.slice(0, MAX_SESSIONS));
    currentSession = null;
  },

  logAIRequest(content: string): void {
    pushEntry({ kind: 'ai_request', data: { content } });
  },

  logTrace(event: string, data: Record<string, unknown> = {}): void {
    pushEntry({ kind: 'qa_trace', data: { event, ...data } });
  },

  logAIResponse(role: string, toolCount: number): void {
    pushEntry({ kind: 'ai_response', data: { role, toolCount } });
  },

  logToolCall(toolName: string, toolCallId: string, args: Record<string, unknown>): void {
    pushEntry({ kind: 'tool_call', data: { toolName, toolCallId, args } });
  },

  logToolResult(toolName: string, toolCallId: string, result: unknown): void {
    pushEntry({ kind: 'tool_result', data: { toolName, toolCallId, result } });
  },

  logExerciseShown(exerciseType: string, exerciseId: string, data: Record<string, unknown>): void {
    pushEntry({ kind: 'exercise_shown', data: { exerciseType, exerciseId, ...data } });
  },

  logExerciseResult(exerciseId: string, correct: boolean): void {
    pushEntry({ kind: 'exercise_result', data: { exerciseId, correct } });
  },

  logChoiceShown(prompt: string, choices: { id: string; text: string }[]): void {
    pushEntry({ kind: 'choice_shown', data: { prompt, choices } });
  },

  logChoiceSelected(choiceId: string): void {
    pushEntry({ kind: 'choice_selected', data: { choiceId } });
  },

  logUserTap(action: string): void {
    pushEntry({ kind: 'user_tap', data: { action } });
  },

  logPhaseChange(from: string, to: string): void {
    pushEntry({ kind: 'phase_change', data: { from, to } });
  },

  logSceneSummary(summary: Record<string, unknown>): void {
    pushEntry({ kind: 'scene_summary', data: summary });
  },

  logError(message: string, detail?: unknown): void {
    pushEntry({ kind: 'error', data: { message, detail: String(detail) } });
  },

  /* ── Console helpers ──────────────────────────────────── */

  getCurrent(): SessionLog | null {
    return currentSession;
  },

  getAll(): SessionLog[] {
    return loadSessions();
  },

  /** Copy all session logs to clipboard as JSON. */
  async export(): Promise<void> {
    const all = currentSession ? [currentSession, ...loadSessions()] : loadSessions();
    const json = JSON.stringify(all, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
      console.log(`[SessionLog] Exported ${all.length} sessions to clipboard (${(json.length / 1024).toFixed(1)} KB)`);
    } else {
      console.log(json);
    }
  },

  /** Clear all stored logs. */
  clear(): void {
    persistSessions([]);
    console.log('[SessionLog] All logs cleared');
  },
};

// Expose on window for console access
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).sessionLogger = sessionLogger;
}
