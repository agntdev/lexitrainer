import { buildBot } from "./bot.js";
import { setDefaultCommands } from "./toolkit/index.js";

async function main() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN is required");
    process.exit(1);
  }
  const bot = await buildBot(token);
  // `/add` is the one intentional typed shortcut: learners often remember a
  // word away from the menu and can immediately start the structured flow.
  await setDefaultCommands(bot, [{ command: "add", description: "Add a vocabulary card" }]);
  bot.start();
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
