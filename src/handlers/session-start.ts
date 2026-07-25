import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { account, cardFor, newCardsForToday, rateCard, type ActiveSession, type Rating } from "../vocab.js";

registerMainMenuItem({ label: "🆕 New session", data: "session:start", order: 10 });
registerMainMenuItem({ label: "▶️ Resume session", data: "session:resume", order: 12 });
const composer = new Composer<Ctx>();
function ratings() { return inlineKeyboard([[inlineButton("Again", "rate:0"), inlineButton("Hard", "rate:3")], [inlineButton("Good", "rate:4"), inlineButton("Easy", "rate:5")]]); }
async function showCard(ctx: Ctx, edit = true) {
  const user = account(ctx); const session = user.activeSession; const card = session && cardFor(user, session.cardIds[session.index]);
  if (!session || !card) { user.activeSession = undefined; const text = "You’ve finished this session. Nice work showing up."; if (edit) await ctx.editMessageText(text, { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) }); else await ctx.reply(text); return; }
  const progress = `${session.index + 1} of ${session.cardIds.length}`;
  if (!session.revealed) { const text = `${session.type === "learn" ? "New card" : "Review"} · ${progress}\n\n${card.prompt}\n\nThink of the meaning, then reveal it.`; if (edit) await ctx.editMessageText(text, { reply_markup: inlineKeyboard([[inlineButton("Reveal", "session:reveal")], [inlineButton("Save for later", "menu:main")]]) }); else await ctx.reply(text, { reply_markup: inlineKeyboard([[inlineButton("Reveal", "session:reveal")], [inlineButton("Save for later", "menu:main")]]) }); return; }
  const example = card.example ? `\n\nExample: ${card.example}` : "";
  const text = `${card.prompt}\n\n${card.translation}${example}\n\nHow well did you remember it?`;
  if (edit) await ctx.editMessageText(text, { reply_markup: ratings() }); else await ctx.reply(text, { reply_markup: ratings() });
}
composer.callbackQuery("session:start", async (ctx) => {
  await ctx.answerCallbackQuery(); const user = account(ctx); const cards = newCardsForToday(user);
  if (!cards.length) { await ctx.editMessageText(user.cards.length ? "No new cards left for today — great pacing. Review what’s due instead." : "Your deck is waiting for its first card — add one and come back.", { reply_markup: inlineKeyboard([[inlineButton(user.cards.length ? "Review due" : "Browse decks", user.cards.length ? "review:start" : "deck:list")], [inlineButton("Back to menu", "menu:main")]]) }); return; }
  user.activeSession = { type: "learn", cardIds: cards.map((c) => c.id), index: 0, revealed: false }; await showCard(ctx);
});
composer.callbackQuery("session:resume", async (ctx) => { await ctx.answerCallbackQuery(); const session = account(ctx).activeSession; if (!session) { await ctx.editMessageText("There’s no session to resume yet. Start a new one whenever you’re ready.", { reply_markup: inlineKeyboard([[inlineButton("New session", "session:start")], [inlineButton("Back to menu", "menu:main")]]) }); return; } await showCard(ctx); });
composer.callbackQuery("session:reveal", async (ctx) => { await ctx.answerCallbackQuery(); const session = account(ctx).activeSession; if (!session) { await ctx.editMessageText("That session has ended. Start a fresh one when you’re ready."); return; } session.revealed = true; await showCard(ctx); });
composer.callbackQuery(/^rate:([0345])$/, async (ctx) => {
  await ctx.answerCallbackQuery(); const user = account(ctx); const session = user.activeSession; const card = session && cardFor(user, session.cardIds[session.index]);
  if (!session || !card || !session.revealed) { await ctx.editMessageText("Reveal a card before rating it."); return; }
  rateCard(user, card, Number(ctx.match[1]) as Rating); session.index += 1; session.revealed = false; await showCard(ctx);
});
export default composer;
