import { Indicators, ISplittedKLines } from "../services/indicators";
import { Signals } from "../services/signals";
import { Trader } from "../services/trader";
import dotenv from "dotenv";
import { macdParams } from "./params/macd";
import { emaParams } from "./params/ema";
import { adxParams } from "./params/adx";
import { rsiParams } from "./params/rsi";
import { TelegramBot } from "../services/tg_bot";
dotenv.config();

const BASE_ASSET_NAME = "SOL";
const QUOTE_ASSET_NAME = "USDT";

const tgBot = new TelegramBot({ key: process.env.TELEGRAM_BOT_KEY || "" });

export const testTrader = new Trader({
  binance: {
    apiKey: process.env.BINANCE_API_KEY!,
    apiSecret: process.env.BINANCE_API_SECRET!,
    httpBase: "https://testnet.binance.vision",
    wsBase: "wss://testnet.binance.vision/ws",
  },
  coin: {
    baseAssetName: BASE_ASSET_NAME,
    quoteAssetName: QUOTE_ASSET_NAME,
  },
  settings: {
    INTERVAL: "1m",
    RISK_PERCENT: 0.1,
    STOP_LOSS_PERCENT: 0.02,
    TAKE_PROFIT_PERCENT: 0.05,
    K_LINES_LIMIT: 1000,
  },
});

export const indicators = new Indicators({
  macd: macdParams[testTrader.settings.INTERVAL],
  ema: emaParams[testTrader.settings.INTERVAL],
  adx: adxParams[testTrader.settings.INTERVAL],
  rsi: rsiParams[testTrader.settings.INTERVAL],
});

export const signalsInstance = new Signals({
  indicators: indicators,
});

let lastCandleTime = 0;

export const runBot = async () => {
  await tgBot.init();
  await tgBot.listenMessages();
  await testTrader.init();
  const kLines = await testTrader.getKLines();

  const splittedKLines = kLines?.reduce<ISplittedKLines>(
    (acc, item) => {
      return {
        close: [...(acc?.close || []), +item.close],
        high: [...(acc?.high || []), +item.high],
        low: [...(acc?.low || []), +item.low],
      };
    },
    { close: [], high: [], low: [] }
  );

  if (splittedKLines) {
    indicators.setSplittedKLines(splittedKLines);
  }

  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${testTrader.coinPair.PAIR_ASSET_NAME.toLowerCase()}@kline_${
      testTrader.settings.INTERVAL
    }`
  );

  ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data.toString());
    const { e: eventType, E: eventTime, s: symbol, k: ticks } = data;
    const {
      T: closeTime,
      o: open,
      h: high,
      l: low,
      c: close,
      v: volume,
      n: trades,
      i: interval,
      x: isFinal,
    } = ticks;

    indicators.addSplittedKLines({ close: [close], high: [high], low: [low] });

    if (isFinal && closeTime > lastCandleTime) {
      console.log(close);
      const { balance } = (await testTrader.getBalance()) ?? {};
      console.log(
        `${balance?.baseBalance.toFixed(2)}:${
          testTrader.coinPair.BASE_ASSET_NAME
        } | ${balance?.quoteBalance.toFixed(2)}:${
          testTrader.coinPair.QUOTE_ASSET_NAME
        }`
      );

      try {
        lastCandleTime = closeTime;
        const signal = signalsInstance.getSignal("trendFollowing");

        console.log(signal.type);
        if (signal.type === "buy" && !testTrader.hasOpenOrders) {
          console.log("BUY: ", close, " close price");
          await testTrader.buyWithOco();
        } else if (signal.type === "sell" && testTrader.hasOpenOrders) {
          console.log("SELL: ", close, " close price");
          await testTrader.sell();
        }
      } catch (error) {
        console.log("ERROR: ", error);
      }
    }
  };
};
