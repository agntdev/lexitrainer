import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { account, createCard, flow, setFlow } from "../vocab.js";

const composer = new Composer<Ctx>();
function askWord(ctx: Ctx) { setFlow(ctx, { kind: "card-word" }); return ctx.reply("What word or phrase would you like to learn?"); }
composer.command("add", askWord);
composer.callbackQuery(/^card:add:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); setFlow(ctx, { kind: "card-word", deckId: ctx.match[1] }); await ctx.editMessageText("What word or phrase would you like to learn?"); });
composer.on("message:text", async (ctx, next) => {
  const current = flow(ctx); if (!current || !["card-word", "card-translation", "card-example"].includes(current.kind)) return next();
  const text = ctx.message.text.trim(); if (!text || text.length > 500) { await ctx.reply("Keep it between 1 and 500 characters, then try again."); return; }
  if (current.kind === "card-word") { setFlow(ctx, { ...current, kind: "card-translation", word: text }); await ctx.reply("What does it mean?"); return; }
  if (current.kind === "card-translation") { setFlow(ctx, { ...current, kind: "card-example", translation: text }); await ctx.reply("Add an example sentence, or tap Skip.", { reply_markup: inlineKeyboard([[inlineButton("Skip", "card:skip-example")]]) }); return; }
  await chooseDeck(ctx, { ...current, example: text });
});
async function chooseDeck(ctx: Ctx, current: NonNullable<ReturnType<typeof flow>>) {
  const user = account(ctx); setFlow(ctx, current);
  if (current.deckId && user.decks.some((d) => d.id === current.deckId)) { await save(ctx, current.deckId); return; }
  if (!user.decks.length) { await ctx.reply("Create a deck first, then add your card.", { reply_markup: inlineKeyboard([[inlineButton("➕ New deck", "deck:new")]]) }); return; }
  await ctx.reply("Which deck should hold this card?", { reply_markup: inlineKeyboard(user.decks.map((d) => [inlineButton(d.name, `card:save:${d.id}`)])) });
}
composer.callbackQuery("card:skip-example", async (ctx) => { await ctx.answerCallbackQuery(); const current = flow(ctx); if (!current || current.kind !== "card-example") { await ctx.editMessageText("That card flow has ended. Start again with /add."); return; } await chooseDeck(ctx, current); });
composer.callbackQuery(/^card:save:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await save(ctx, ctx.match[1]); });
async function save(ctx: Ctx, deckId: string) {
  const current = flow(ctx); const user = account(ctx);
  if (!current?.word || !current.translation || !user.decks.some((d) => d.id === deckId)) { await ctx.reply("I couldn’t save that card. Start again with /add."); setFlow(ctx); return; }
  const card = createCard(user, deckId, current.word, current.translation, current.example); setFlow(ctx);
  await ctx.reply(`Saved “${card.prompt}”. It’ll be ready in your next session.`, { reply_markup: inlineKeyboard([[inlineButton("Start learning", "session:start"), inlineButton("Add another", `card:add:${deckId}`)]]) });
}
export default composer;
