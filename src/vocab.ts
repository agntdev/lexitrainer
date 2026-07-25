import type { Ctx } from "./bot.js";
import { clearReminders, remindAt, type WorkerEnv } from "./toolkit/session/durable.js";

export type Rating = 0 | 3 | 4 | 5;
export type Card = {
  id: string;
  deckId: string;
  prompt: string;
  translation: string;
  example?: string;
  easiness: number;
  interval: number;
  dueDate: string;
  repetitions: number;
  isNew: boolean;
  reviewHistory: Array<{ date: string; rating: Rating }>;
};
export type Deck = { id: string; name: string; cardIds: string[]; createdAt: string };
export type ActiveSession = { type: "learn" | "review"; cardIds: string[]; index: number; revealed: boolean };
export type Account = {
  telegramId: number;
  language?: string;
  dailyNewLimit: number;
  notificationSchedule?: string;
  timezone: string;
  decks: Deck[];
  cards: Card[];
  nextDeck: number;
  nextCard: number;
  learnedCount: number;
  studyDays: string[];
  activeSession?: ActiveSession;
  onboarding?: "language" | "limit" | "reminder";
};
export type Flow = { kind: "deck-name" | "deck-rename" | "card-word" | "card-translation" | "card-example" | "timezone"; deckId?: string; word?: string; translation?: string; example?: string };

type Store = { vocab?: Account; flow?: Flow };

/** The single clock seam for all SRS, streak, and reminder calculations. */
export let now: () => Date = () => new Date();
export function setNowForTest(clock: () => Date): void { now = clock; }

function store(ctx: Ctx): Store { return ctx.session as Store; }
export function account(ctx: Ctx): Account {
  const s = store(ctx);
  if (!s.vocab) {
    s.vocab = {
      telegramId: ctx.from?.id ?? ctx.chat?.id ?? 0,
      dailyNewLimit: 10,
      timezone: "UTC",
      decks: [], cards: [], nextDeck: 1, nextCard: 1, learnedCount: 0, studyDays: [],
    };
  }
  return s.vocab;
}
export function flow(ctx: Ctx): Flow | undefined { return store(ctx).flow; }
export function setFlow(ctx: Ctx, value?: Flow): void { store(ctx).flow = value; }

export function validTimezone(value: string): boolean {
  try { Intl.DateTimeFormat(undefined, { timeZone: value }); return true; } catch { return false; }
}
export function localDay(a: Account, date = now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: a.timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date);
}
function utcDay(date: Date): string { return date.toISOString().slice(0, 10); }
export function addDays(date: Date, days: number): string {
  return utcDay(new Date(date.getTime() + days * 86_400_000));
}
export function createDeck(a: Account, name: string): Deck {
  const deck = { id: String(a.nextDeck++), name, cardIds: [], createdAt: now().toISOString() };
  a.decks.push(deck);
  return deck;
}
export function createCard(a: Account, deckId: string, prompt: string, translation: string, example?: string): Card {
  const card: Card = { id: String(a.nextCard++), deckId, prompt, translation, ...(example ? { example } : {}), easiness: 2.5, interval: 0, dueDate: localDay(a), repetitions: 0, isNew: true, reviewHistory: [] };
  a.cards.push(card);
  a.decks.find((d) => d.id === deckId)?.cardIds.push(card.id);
  return card;
}
export function cardFor(a: Account, id: string): Card | undefined { return a.cards.find((c) => c.id === id); }
export function deckFor(a: Account, id: string): Deck | undefined { return a.decks.find((d) => d.id === id); }
export function newCardsForToday(a: Account): Card[] {
  const day = localDay(a);
  const introduced = a.cards.filter((c) => !c.isNew && c.reviewHistory.some((r) => r.date === day)).length;
  return a.cards.filter((c) => c.isNew).slice(0, Math.max(0, a.dailyNewLimit - introduced));
}
export function dueCards(a: Account): Card[] { return a.cards.filter((c) => !c.isNew && c.dueDate <= localDay(a)); }
export function rateCard(a: Account, card: Card, rating: Rating): void {
  const previousEase = card.easiness;
  card.easiness = Math.max(1.3, previousEase + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));
  if (rating < 3) { card.interval = 1; card.repetitions = 0; }
  else { card.interval = card.repetitions === 0 ? 1 : card.repetitions === 1 ? 6 : Math.max(1, Math.round(card.interval * previousEase)); card.repetitions += 1; }
  card.isNew = false;
  card.dueDate = addDays(now(), card.interval);
  card.reviewHistory.push({ date: localDay(a), rating });
  if (!a.studyDays.includes(localDay(a))) a.studyDays.push(localDay(a));
  a.learnedCount = a.cards.filter((c) => !c.isNew).length;
}
export function streak(a: Account): number {
  let count = 0;
  let cursor = now();
  while (a.studyDays.includes(localDay(a, cursor))) { count++; cursor = new Date(cursor.getTime() - 86_400_000); }
  return count;
}
export function nextReminder(a: Account): number | undefined {
  if (!a.notificationSchedule) return undefined;
  const match = /^(\d{2}):(\d{2})$/.exec(a.notificationSchedule);
  if (!match) return undefined;
  const targetMinutes = Number(match[1]) * 60 + Number(match[2]);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: a.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const delta = targetMinutes - (hour * 60 + minute);
  return now().getTime() + (delta > 0 ? delta : delta + 1_440) * 60_000;
}
/** Worker-only, best-effort notification scheduling. The Durable Object owns
 * delivery, so a blocked chat or missing binding never interrupts a user flow. */
export async function scheduleDailyReminder(ctx: Ctx, a: Account): Promise<void> {
  const when = nextReminder(a);
  const env = (ctx as unknown as { env?: WorkerEnv }).env;
  if (!env || !ctx.chat) return;
  if (!when) { await clearReminders(env, ctx.chat.id); return; }
  await remindAt(env, ctx.chat.id, when, "A few cards are ready when you are.", 86_400_000);
}
