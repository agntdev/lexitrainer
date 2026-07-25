import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { account, createDeck, deckFor, flow, setFlow } from "../vocab.js";

registerMainMenuItem({ label: "📚 Browse decks", data: "deck:list", order: 30 });
const composer = new Composer<Ctx>();

function deckKeyboard(user: ReturnType<typeof account>) {
  return inlineKeyboard([
    ...user.decks.map((d) => [inlineButton(`${d.name} · ${d.cardIds.length}`, `deck:open:${d.id}`)]),
    [inlineButton("➕ New deck", "deck:new"), inlineButton("⬅️ Back", "menu:main")],
  ]);
}
composer.callbackQuery("deck:list", async (ctx) => {
  await ctx.answerCallbackQuery(); const user = account(ctx);
  if (!user.decks.length) { await ctx.editMessageText("No decks yet — tap ➕ New deck to make your first one.", { reply_markup: deckKeyboard(user) }); return; }
  await ctx.editMessageText("Choose a deck to see its cards.", { reply_markup: deckKeyboard(user) });
});
composer.callbackQuery("deck:new", async (ctx) => { await ctx.answerCallbackQuery(); setFlow(ctx, { kind: "deck-name" }); await ctx.editMessageText("Name your new deck."); });
composer.callbackQuery(/^deck:open:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); const user = account(ctx); const deck = deckFor(user, ctx.match[1]);
  if (!deck) { await ctx.editMessageText("That deck is no longer here. Try your deck list again.", { reply_markup: deckKeyboard(user) }); return; }
  const cards = deck.cardIds.map((id) => user.cards.find((c) => c.id === id)?.prompt).filter(Boolean);
  const body = cards.length ? `${deck.name}\n\n${cards.join("\n")}` : `${deck.name} is ready for its first card.`;
  await ctx.editMessageText(body, { reply_markup: inlineKeyboard([[inlineButton("➕ Add card", `card:add:${deck.id}`)], [inlineButton("Rename", `deck:rename:${deck.id}`), inlineButton("Delete", `deck:delete:${deck.id}`)], [inlineButton("⬅️ Decks", "deck:list")]]) });
});
composer.callbackQuery(/^deck:rename:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); setFlow(ctx, { kind: "deck-rename", deckId: ctx.match[1] }); await ctx.editMessageText("Send the new deck name."); });
composer.callbackQuery(/^deck:delete:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); const deck = deckFor(account(ctx), ctx.match[1]);
  await ctx.editMessageText(deck ? `Delete ${deck.name}? Its cards will be removed too.` : "That deck is already gone.", { reply_markup: deck ? inlineKeyboard([[inlineButton("Delete deck", `deck:confirm-delete:${deck.id}`), inlineButton("Keep it", `deck:open:${deck.id}`)]]) : deckKeyboard(account(ctx)) });
});
composer.callbackQuery(/^deck:confirm-delete:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); const user = account(ctx); const id = ctx.match[1]; const deck = deckFor(user, id);
  if (!deck) { await ctx.editMessageText("That deck is already gone.", { reply_markup: deckKeyboard(user) }); return; }
  user.decks = user.decks.filter((d) => d.id !== id); user.cards = user.cards.filter((c) => c.deckId !== id);
  await ctx.editMessageText("Deck deleted. Your other decks are safe.", { reply_markup: deckKeyboard(user) });
});
composer.on("message:text", async (ctx, next) => {
  const current = flow(ctx); if (!current || (current.kind !== "deck-name" && current.kind !== "deck-rename")) return next();
  const name = ctx.message.text.trim(); if (name.length < 1 || name.length > 60) { await ctx.reply("Use a deck name between 1 and 60 characters."); return; }
  const user = account(ctx);
  if (current.kind === "deck-name") { const deck = createDeck(user, name); setFlow(ctx); await ctx.reply(`${deck.name} is ready. Tap ➕ Add card when you have a word to save.`, { reply_markup: inlineKeyboard([[inlineButton("➕ Add card", `card:add:${deck.id}`), inlineButton("Browse decks", "deck:list")]]) }); }
  else { const deck = deckFor(user, current.deckId ?? ""); if (deck) deck.name = name; setFlow(ctx); await ctx.reply(deck ? `Renamed to ${name}.` : "That deck is no longer here.", { reply_markup: deckKeyboard(user) }); }
});
export default composer;
