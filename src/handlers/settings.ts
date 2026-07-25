import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { account, flow, scheduleDailyReminder, setFlow, validTimezone } from "../vocab.js";

registerMainMenuItem({ label: "⚙️ Settings", data: "settings:show", order: 50 });
const composer = new Composer<Ctx>();
function keyboard() { return inlineKeyboard([[inlineButton("Daily limit", "settings:limit"), inlineButton("Reminder", "settings:reminder")], [inlineButton("Timezone", "settings:timezone")], [inlineButton("Back to menu", "menu:main")]]); }
composer.callbackQuery("settings:show", async (ctx) => { await ctx.answerCallbackQuery(); const user = account(ctx); await ctx.editMessageText(`Your daily limit is ${user.dailyNewLimit} cards.\nReminder: ${user.notificationSchedule ?? "off"}\nTimezone: ${user.timezone}`, { reply_markup: keyboard() }); });
composer.callbackQuery("settings:limit", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText("Choose your daily new-card limit.", { reply_markup: inlineKeyboard([[5, 10, 20].map((n) => inlineButton(String(n), `settings:set-limit:${n}`))],) }); });
composer.callbackQuery(/^settings:set-limit:(5|10|20)$/, async (ctx) => { await ctx.answerCallbackQuery(); account(ctx).dailyNewLimit = Number(ctx.match[1]); await ctx.editMessageText(`You’ll see up to ${ctx.match[1]} new cards a day.`, { reply_markup: keyboard() }); });
composer.callbackQuery("settings:reminder", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText("Choose a daily reminder time in your timezone.", { reply_markup: inlineKeyboard([[inlineButton("09:00", "settings:set-reminder:09:00"), inlineButton("18:00", "settings:set-reminder:18:00")], [inlineButton("Turn off", "settings:set-reminder:off")], [inlineButton("Back", "settings:show")]]) }); });
composer.callbackQuery(/^settings:set-reminder:(09:00|18:00|off)$/, async (ctx) => { await ctx.answerCallbackQuery(); const user = account(ctx); user.notificationSchedule = ctx.match[1] === "off" ? undefined : ctx.match[1]; await scheduleDailyReminder(ctx, user); await ctx.editMessageText(ctx.match[1] === "off" ? "Reminders are off. You can turn them back on anytime." : `I’ll remind you at ${ctx.match[1]} each day.`, { reply_markup: keyboard() }); });
composer.callbackQuery("settings:timezone", async (ctx) => { await ctx.answerCallbackQuery(); setFlow(ctx, { kind: "timezone" }); await ctx.editMessageText("Send your IANA timezone, like Europe/Paris or America/New_York."); });
composer.on("message:text", async (ctx, next) => { if (flow(ctx)?.kind !== "timezone") return next(); const timezone = ctx.message.text.trim(); if (!validTimezone(timezone)) { await ctx.reply("I couldn’t recognise that timezone. Try one like Europe/Paris or America/New_York."); return; } const user = account(ctx); user.timezone = timezone; await scheduleDailyReminder(ctx, user); setFlow(ctx); await ctx.reply(`Timezone set to ${timezone}. Your reminders will follow local time.`, { reply_markup: keyboard() }); });
export default composer;
