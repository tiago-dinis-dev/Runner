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

/** Extract a short calendar-cell label (first segment before ·, max 40 chars) */
function shortLabel(raw: string): string {
  const clean = cleanLabel(raw);
  // Take everything before the first " · " separator as the title
  const firstSep = clean.indexOf(' · ');
  const title = firstSep > 0 ? clean.slice(0, firstSep) : clean;
  return title.trim().slice(0, 40);
}

/** Extract the detail breakdown (segments after the first · separator) */
function detailFromRaw(raw: string): string | undefined {
  const clean = cleanLabel(raw);
  const firstSep = clean.indexOf(' · ');
  if (firstSep < 0) return undefined;
  return clean.slice(firstSep + 3).trim() || undefined;
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
  // If plan has YAML front-matter with race_date, prefer that for any Race session rows
  const fmMatch = markdown.match(/race_date:\s*["']?(\d{4}-\d{2}-\d{2})["']?/i);
  const raceDate: string | undefined = fmMatch ? fmMatch[1] : undefined;
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

    // --- Explicit-date table row: | [**]Day Month Num[**] | label | [details] | ---
    const explicitMatch = line.match(
      /^\|\s*\*{0,2}((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\*{0,2}\s*\|\s*([^|]+?)\s*\|(?:\s*([^|]+?)\s*\|)?/
    );
    if (explicitMatch) {
      const parts = explicitMatch[1].trim().split(/\s+/);
      const mi = MONTH_MAP[parts[1]];
      const d = parseInt(parts[2]);
      if (mi !== undefined && !isNaN(d)) {
        const rawLabel = explicitMatch[2];
        const rawDetails = explicitMatch[3];
        // 3-column format: col3 is details; 2-column: fall back to · splitting col2
        const details = rawDetails
          ? rawDetails.trim() || undefined
          : detailFromRaw(rawLabel);
        // Prefer explicit front-matter race_date for Race sessions to avoid week-offset issues
        let sessionDate = toDateStr(year, mi, d);
        if (raceDate && inferType(rawLabel) === 'Race') sessionDate = raceDate;
        sessions.push({
          date: sessionDate,
          label: rawDetails ? cleanLabel(rawLabel) : shortLabel(rawLabel),
          details,
          type: inferType(rawLabel),
          phase: currentPhase,
        });
      }
      continue;
    }

    // --- Day-only table row: | Day | label | [details] | (requires weekMonday context) ---
    if (weekMonday) {
      const dayMatch = line.match(/^\|\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\|\s*([^|]+?)\s*\|(?:\s*([^|]+?)\s*\|)?/);
      if (dayMatch) {
        const t = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() + (DAY_OFFSET[dayMatch[1]] ?? 0));
        const rawLabel = dayMatch[2];
        const rawDetails = dayMatch[3];
        const details = rawDetails
          ? rawDetails.trim() || undefined
          : detailFromRaw(rawLabel);
        let sessionDate = toDateStr(year, t.getMonth(), t.getDate());
        if (raceDate && inferType(rawLabel) === 'Race') sessionDate = raceDate;
        sessions.push({
          date: sessionDate,
          label: rawDetails ? cleanLabel(rawLabel) : shortLabel(rawLabel),
          details,
          type: inferType(rawLabel),
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
