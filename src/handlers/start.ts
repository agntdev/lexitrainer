import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { account, createDeck, scheduleDailyReminder } from "../vocab.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const WELCOME = "👋 Welcome! Tap a button below to get started.";

composer.command("start", async (ctx) => {
  const user = account(ctx);
  await ctx.reply(WELCOME);
  if (!user.language) {
    user.onboarding = "language";
    await ctx.reply("Pick the language you’re learning.", { reply_markup: { inline_keyboard: [[{ text: "English", callback_data: "onboard:language:English" }, { text: "Spanish", callback_data: "onboard:language:Spanish" }], [{ text: "French", callback_data: "onboard:language:French" }, { text: "German", callback_data: "onboard:language:German" }]] } });
    return;
  }
  await ctx.reply("What would you like to practise today?", { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery(/^onboard:language:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = account(ctx); user.language = ctx.match[1]; user.onboarding = "limit";
  if (user.decks.length === 0) createDeck(user, `${user.language} vocabulary`);
  await ctx.editMessageText("How many new cards feels right each day?", { reply_markup: { inline_keyboard: [[5, 10, 20].map((n) => ({ text: String(n), callback_data: `onboard:limit:${n}` }))] } });
});
composer.callbackQuery(/^onboard:limit:(5|10|20)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = account(ctx); user.dailyNewLimit = Number(ctx.match[1]); user.onboarding = "reminder";
  await ctx.editMessageText("When should I remind you to review? Times use your current UTC timezone.", { reply_markup: { inline_keyboard: [[{ text: "09:00", callback_data: "onboard:reminder:09:00" }, { text: "18:00", callback_data: "onboard:reminder:18:00" }], [{ text: "No reminders", callback_data: "onboard:reminder:off" }]] } });
});
composer.callbackQuery(/^onboard:reminder:(09:00|18:00|off)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = account(ctx); user.notificationSchedule = ctx.match[1] === "off" ? undefined : ctx.match[1]; user.onboarding = undefined;
  await scheduleDailyReminder(ctx, user);
  await ctx.editMessageText("You’re all set. Small, steady reviews add up.", { reply_markup: mainMenuKeyboard() });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
