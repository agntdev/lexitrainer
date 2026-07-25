import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { account, dueCards } from "../vocab.js";

registerMainMenuItem({ label: "🔁 Review due", data: "review:start", order: 20 });
const composer = new Composer<Ctx>();
composer.callbackQuery("review:start", async (ctx) => {
  await ctx.answerCallbackQuery(); const user = account(ctx); const cards = dueCards(user);
  if (!cards.length) { await ctx.editMessageText("Nothing is due right now — you’re nicely caught up.", { reply_markup: inlineKeyboard([[inlineButton("New session", "session:start")], [inlineButton("Back to menu", "menu:main")]]) }); return; }
  user.activeSession = { type: "review", cardIds: cards.map((c) => c.id), index: 0, revealed: false };
  const card = cards[0]; await ctx.editMessageText(`Review · 1 of ${cards.length}\n\n${card.prompt}\n\nThink of the meaning, then reveal it.`, { reply_markup: inlineKeyboard([[inlineButton("Reveal", "session:reveal")], [inlineButton("Save for later", "menu:main")]]) });
});
export default composer;
