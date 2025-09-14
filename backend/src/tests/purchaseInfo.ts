import { indicators, signalsInstance, testTrader } from "../bots/bot";
import { ISplittedKLines } from "../services/indicators";

let inPosition = false;
let lastPurchasePrice = 0;
let profit = 0;

export const purchaseInfo = async () => {
  const kLines = await testTrader.getKLines();

  const preparedKLines =
    kLines?.map((item) => {
      return {
        high: item.high,
        open: item.open,
        close: item.close,
        low: item.low,
        time: item.closeTime / 1000,
      };
    }) || [];

  Array.from({ length: testTrader?.settings?.K_LINES_LIMIT })?.map(
    (_, index) => {
      const currentKline = preparedKLines[index];
      const splittedKLines = preparedKLines
        ?.slice(0, index + 1)
        .reduce<ISplittedKLines>(
          (acc, item) => {
            return {
              close: [...(acc?.close || []), +item.close],
              high: [...(acc?.high || []), +item.high],
              low: [...(acc?.low || []), +item.low],
            };
          },
          { close: [], high: [], low: [] }
        );

      indicators.setSplittedKLines(splittedKLines);

      const signal = signalsInstance.getSignal("macdCrossover");
      // console.log(signal.type);
      if (signal.type === "buy" && !inPosition) {
        lastPurchasePrice = +currentKline?.close;
        console.log("BUY: ", currentKline?.close);
        inPosition = true;
      } else if (
        signal.type === "sell" &&
        inPosition &&
        +currentKline?.close > lastPurchasePrice
      ) {
        inPosition = false;
        profit += +currentKline?.close - lastPurchasePrice;
        console.log("SELL: ", currentKline?.close);
      }
    }
  );
  console.log("PROFIT: ", profit.toFixed(2));
};
