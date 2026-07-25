import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { account, dueCards, streak } from "../vocab.js";

registerMainMenuItem({ label: "📈 Progress", data: "stats:show", order: 40 });
const composer = new Composer<Ctx>();
composer.callbackQuery("stats:show", async (ctx) => {
  await ctx.answerCallbackQuery(); const user = account(ctx); const reviewed = user.cards.flatMap((c) => c.reviewHistory); const good = reviewed.filter((r) => r.rating >= 4).length;
  const retention = reviewed.length ? Math.round((good / reviewed.length) * 100) : 0;
  await ctx.editMessageText(`You’ve learned ${user.learnedCount} words.\n\nYour streak: ${streak(user)} day${streak(user) === 1 ? "" : "s"}\nDue now: ${dueCards(user).length}\nRetention: ${retention}%`, { reply_markup: inlineKeyboard([[inlineButton("Review due", "review:start")], [inlineButton("Back to menu", "menu:main")]]) });
});
export default composer;
