import TgBot from "node-telegram-bot-api";

export class TelegramBot {
  private bot: TgBot;
  private chatIds: number[];
  constructor(data: { key: string }) {
    this.bot = new TgBot(data.key, {
      polling: true,
    });
    this.chatIds = [];
  }

  async init() {
    this.bot.onText(/\/subscribe/, async (msg) => {
      const chatId = msg.chat.id;
      this.chatIds.push(chatId);
      await this.bot.sendMessage(chatId, "Subscribed on logs");
    });
  }

  async listenMessages() {
    this.bot.on("message", async (msg) => {});
  }

  async sendMessage(message: string) {
    await Promise.all(
      this.chatIds.map((item) => this.bot.sendMessage(item, message))
    );
  }
}
