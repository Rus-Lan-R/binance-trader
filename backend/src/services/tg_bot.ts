import TgBot from "node-telegram-bot-api";

export class TelegramBot {
  private bot: TgBot;

  constructor(data: { key: string }) {
    this.bot = new TgBot(data.key, {
      polling: true,
    });
  }

  async init() {
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId, "start");
    });
  }

  async listenMessages() {
    this.bot.on("message", async (msg) => {});
  }
}
