import type { ChronicleDay } from "@/lib/chronicle";
import { MS_PER_SECOND } from "@/lib/constants";
import { m } from "@/paraglide/messages";

import { durText } from "./format";

const HOUR_PAD = 2;

/** counters only the client knows (since the page opened); merged into today's chronicle */
export interface ChronicleLocal {
  monsters: number;
  bosses: number;
  raids: number;
  levels: number;
}
export const NO_LOCAL: ChronicleLocal = { monsters: 0, bosses: 0, raids: 0, levels: 0 };

export type ChronicleFact = { label: string; value: string };

const hourText = (hour: number): string => `${String(hour).padStart(HOUR_PAD, "0")}:00`;

/** true when nothing at all happened that day (the card shows the "blank ledger" line) */
export const isQuietDay = (day: ChronicleDay, local: ChronicleLocal): boolean =>
  day.sessions === 0 &&
  day.prompts === 0 &&
  day.toolCalls === 0 &&
  local.monsters + local.bosses + local.raids + local.levels === 0;

/** the chronicle as a short list of fantasy sentences, in the viewer's language */
export const chronicleSentences = (day: ChronicleDay, isToday: boolean, local: ChronicleLocal): string[] => {
  const out: string[] = [];
  const intro = isToday ? m.chronicle_intro_today : m.chronicle_intro_yesterday;
  if (day.sessions > 0) out.push(intro({ count: day.sessions }));
  if (day.projects.length > 0)
    out.push(m.chronicle_s_projects({ count: day.projects.length, names: day.projects.join(", ") }));
  if (day.prompts > 0) out.push(m.chronicle_s_orders({ count: day.prompts }));
  if (day.toolCalls > 0) out.push(m.chronicle_s_calls({ count: day.toolCalls, tool: day.tools[0]?.tool ?? "—" }));
  if (day.files > 0) out.push(m.chronicle_s_files({ count: day.files }));
  if (day.commits > 0) out.push(m.chronicle_s_commits({ count: day.commits }));
  if (day.recovered > 0) out.push(m.chronicle_s_tests({ count: day.recovered }));
  if (day.tasks > 0) out.push(m.chronicle_s_tasks({ count: day.tasks }));
  if (day.loops > 0) out.push(m.chronicle_s_loops({ count: day.loops }));
  if (day.longestSessionMs > 0)
    out.push(m.chronicle_s_longest({ duration: durText(day.longestSessionMs / MS_PER_SECOND) }));
  if (day.busiestHour !== null) out.push(m.chronicle_s_busiest({ hour: hourText(day.busiestHour) }));
  if (isToday) {
    if (local.monsters > 0) out.push(m.chronicle_s_monsters({ count: local.monsters }));
    if (local.bosses > 0) out.push(m.chronicle_s_bosses({ count: local.bosses }));
    if (local.raids > 0) out.push(m.chronicle_s_raids({ count: local.raids }));
    if (local.levels > 0) out.push(m.chronicle_s_levels({ count: local.levels }));
  }
  return out;
};

/** the compact facts grid (label + value); client-only counters are appended for today, zeros are skipped */
export const chronicleFacts = (day: ChronicleDay, isToday: boolean, local: ChronicleLocal): ChronicleFact[] => {
  const rows: [string, number | string][] = [
    [m.chronicle_f_sessions(), day.sessions],
    [m.chronicle_f_projects(), day.projects.length],
    [m.chronicle_f_prompts(), day.prompts],
    [m.chronicle_f_calls(), day.toolCalls],
    [m.chronicle_f_files(), day.files],
    [m.chronicle_f_commits(), day.commits],
    [m.chronicle_f_tests(), day.recovered],
    [m.chronicle_f_tasks(), day.tasks],
    [m.chronicle_f_loops(), day.loops],
  ];
  if (day.longestSessionMs > 0) rows.push([m.chronicle_f_longest(), durText(day.longestSessionMs / MS_PER_SECOND)]);
  if (day.busiestHour !== null) rows.push([m.chronicle_f_busiest(), hourText(day.busiestHour)]);
  if (isToday)
    rows.push(
      [m.chronicle_f_monsters(), local.monsters],
      [m.chronicle_f_bosses(), local.bosses],
      [m.chronicle_f_raids(), local.raids],
      [m.chronicle_f_levels(), local.levels],
    );
  return rows.filter(([, value]) => value !== 0).map(([label, value]) => ({ label, value: String(value) }));
};

/** one day as markdown bullets: outcomes a standup cares about (commits, files, tests fixed, tasks done, projects) */
const standupBullets = (day: ChronicleDay): string[] => {
  const bullets: string[] = [];
  if (day.commits > 0) bullets.push(`${m.chronicle_f_commits()}: ${day.commits}`);
  if (day.files > 0) bullets.push(`${m.chronicle_f_files()}: ${day.files}`);
  if (day.recovered > 0) bullets.push(`${m.chronicle_f_tests()}: ${day.recovered}`);
  if (day.tasks > 0) bullets.push(`${m.chronicle_f_tasks()}: ${day.tasks}`);
  if (day.projects.length > 0) bullets.push(`${m.chronicle_f_projects()}: ${day.projects.join(", ")}`);
  return bullets.length > 0 ? bullets.map((bullet) => `- ${bullet}`) : [`- ${m.chronicle_md_nothing()}`];
};

/** plain markdown for a standup: Yesterday / Today bullets */
export const chronicleStandup = (yesterday: ChronicleDay, today: ChronicleDay): string =>
  [
    `## ${m.chronicle_md_title()}`,
    "",
    `**${m.chronicle_md_yesterday()}**`,
    ...standupBullets(yesterday),
    "",
    `**${m.chronicle_md_today()}**`,
    ...standupBullets(today),
    "",
  ].join("\n");
