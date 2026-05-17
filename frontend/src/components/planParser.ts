import type { PlanSession } from './Calendar';

export interface PhaseRange {
  name: 'Base' | 'Build' | 'Race Week' | 'Vacation';
  label: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface ParsedPlan {
  sessions: PlanSession[];
  phases: PhaseRange[];
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const DAY_OFFSET: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

function inferType(label: string): PlanSession['type'] {
  const l = label.toLowerCase();
  if (l.includes('race') || l.includes('🏆')) return 'Race';
  if (l.includes('erg') || l.includes('🚣')) return 'Erg';
  if (l.includes('hyrox') || l.includes('🏋')) return 'Hyrox';
  if (l.includes('gym') || l.includes('💪') || l.includes('weight')) return 'Gym';
  return 'Run';
}

function toDateStr(year: number, monthIdx: number, day: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMondayOfWeek(year: number, monthIdx: number, day: number): Date {
  const d = new Date(year, monthIdx, day);
  const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysBack = dow === 0 ? 6 : dow - 1;
  return new Date(year, monthIdx, day - daysBack);
}

const EMOJI_RE = /🏆|🏋️|💪|🚣|🏃|🏖️|😴|⚠️/g;

function cleanLabel(raw: string): string {
  return raw.replace(/\*{1,2}/g, '').replace(EMOJI_RE, '').trim();
}

/** Parse a "Month DD – [Month] DD" date range from a phase header line. */
function parsePhaseRange(line: string, year: number): { start: string; end: string } | null {
  const m = line.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)\s*[–-]\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+)?(\d+)/
  );
  if (!m) return null;
  const startMonth = MONTH_MAP[m[1]];
  const startDay = parseInt(m[2]);
  const endMonth = m[3] ? MONTH_MAP[m[3]] : startMonth;
  const endDay = parseInt(m[4]);
  if (isNaN(startDay) || isNaN(endDay)) return null;
  return { start: toDateStr(year, startMonth, startDay), end: toDateStr(year, endMonth, endDay) };
}

export function parsePlan(markdown: string, year = 2026): ParsedPlan {
  const sessions: PlanSession[] = [];
  const phases: PhaseRange[] = [];
  const lines = markdown.split('\n');
  let currentPhase: PlanSession['phase'] = undefined;
  let weekMonday: Date | null = null;

  for (const line of lines) {
    // --- Phase header detection (## headings only) ---
    if (/^##\s/.test(line)) {
      if (/PHASE\s+1/i.test(line)) {
        currentPhase = 'Base';
        const r = parsePhaseRange(line, year);
        if (r) phases.push({ name: 'Base', label: 'Phase 1 — Base', ...r });
        continue;
      }
      if (/PHASE\s+2/i.test(line)) {
        currentPhase = 'Build';
        const r = parsePhaseRange(line, year);
        if (r) phases.push({ name: 'Build', label: 'Phase 2 — Build', ...r });
        continue;
      }
      if (/PHASE\s+3/i.test(line) || /RACE\s+WEEK/i.test(line)) {
        currentPhase = 'Race Week';
        weekMonday = null;
        const r = parsePhaseRange(line, year);
        if (r) phases.push({ name: 'Race Week', label: 'Phase 3 — Race Week', ...r });
        continue;
      }
      if (/VACATION/i.test(line)) {
        currentPhase = 'Vacation';
        weekMonday = null;
        const r = parsePhaseRange(line, year);
        if (r) phases.push({ name: 'Vacation', label: 'Vacation', ...r });
        continue;
      }
    }

    // --- Week header: ### Week N · Month DD ---
    const weekMatch = line.match(
      /^###\s+Week\s+\d+\s+[·•]\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/
    );
    if (weekMatch) {
      const mi = MONTH_MAP[weekMatch[1]];
      const d = parseInt(weekMatch[2]);
      if (mi !== undefined && !isNaN(d)) weekMonday = getMondayOfWeek(year, mi, d);
      continue;
    }

    // --- Explicit-date table row: | [**]Day Month Num[**] | label | ---
    const explicitMatch = line.match(
      /^\|\s*\*{0,2}((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\*{0,2}\s*\|\s*([^|]+)\|?/
    );
    if (explicitMatch) {
      const parts = explicitMatch[1].trim().split(/\s+/);
      const mi = MONTH_MAP[parts[1]];
      const d = parseInt(parts[2]);
      if (mi !== undefined && !isNaN(d)) {
        sessions.push({
          date: toDateStr(year, mi, d),
          label: cleanLabel(explicitMatch[2]).slice(0, 60),
          type: inferType(explicitMatch[2]),
          phase: currentPhase,
        });
      }
      continue;
    }

    // --- Day-only table row: | Day | label | (requires weekMonday context) ---
    if (weekMonday) {
      const dayMatch = line.match(/^\|\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\|\s*([^|]+)\|?/);
      if (dayMatch) {
        const t = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() + (DAY_OFFSET[dayMatch[1]] ?? 0));
        sessions.push({
          date: toDateStr(year, t.getMonth(), t.getDate()),
          label: cleanLabel(dayMatch[2]).slice(0, 60),
          type: inferType(dayMatch[2]),
          phase: currentPhase,
        });
      }
    }
  }

  return { sessions, phases };
}

/** Legacy convenience wrapper. */
export function parsePlanSessions(markdown: string, year = 2026): PlanSession[] {
  return parsePlan(markdown, year).sessions;
}
