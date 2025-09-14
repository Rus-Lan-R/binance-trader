import { Indicators } from "./indicators";

export type TSignal = "buy" | "sell" | "hold";

export interface ISignal {
  type: TSignal;
  reason: string;
  strategy: string;
}

export interface ISignalsServiceProps {
  indicators: Indicators;
}

export class Signals {
  private indicators: Indicators;

  constructor(props: ISignalsServiceProps) {
    this.indicators = props.indicators;
  }

  public updateIndicators(newIndicators: Indicators) {
    this.indicators = newIndicators;
  }

  public getSignal(
    strategy: "trendFollowing" | "meanReversion" | "macdCrossover"
  ): ISignal {
    switch (strategy) {
      case "trendFollowing":
        return this.trendFollowingStrategy();
      case "meanReversion":
        return this.meanReversionStrategy();
      case "macdCrossover":
        return this.macdCrossoverStrategy();
      default:
        return { type: "hold", reason: "Unknown strategy", strategy: "none" };
    }
  }

  // Trend-Following: EMA crossing + ADX filter
  private trendFollowingStrategy(): ISignal {
    const ema = this.indicators.emaCalculation();
    const flowCross = this.indicators.flowCross({
      prevShort: ema.prev.prevShort,
      lastShort: ema.prev.lastShort,
      lastLong: ema.prev.lastLong,
      prevLong: ema.prev.prevLong,
    });
    const adx = this.indicators.adxCalculation();

    if (
      adx.latestADX > this.indicators.adx.threshold &&
      flowCross.isCrossUp &&
      adx.latestPDI > adx.latestMDI
    ) {
      return {
        type: "buy",
        reason: "EMA Cross Up with strong uptrend (ADX > threshold, +DI > -DI)",
        strategy: "trendFollowing",
      };
    } else if (
      adx.latestADX > this.indicators.adx.threshold &&
      flowCross.isCrossDown &&
      adx.latestMDI > adx.latestPDI
    ) {
      return {
        type: "sell",
        reason:
          "EMA Cross Down with strong downtrend (ADX > threshold, -DI > +DI)",
        strategy: "trendFollowing",
      };
    } else {
      return {
        type: "hold",
        reason: "No strong trend or no EMA cross",
        strategy: "trendFollowing",
      };
    }
  }

  // Mean Reversion: RSI + ADX filter (for flat)
  private meanReversionStrategy(): ISignal {
    const rsi = this.indicators.rsiCalculation();
    const adx = this.indicators.adxCalculation();

    if (
      adx.latestADX < this.indicators.adx.threshold &&
      rsi.lastRSI < this.indicators.rsi.oversold
    ) {
      return {
        type: "buy",
        reason: "Oversold RSI in flat market (ADX < threshold)",
        strategy: "meanReversion",
      };
    } else if (
      adx.latestADX < this.indicators.adx.threshold &&
      rsi.lastRSI > this.indicators.rsi.overbought
    ) {
      return {
        type: "sell",
        reason: "Overbought RSI in flat market (ADX < threshold)",
        strategy: "meanReversion",
      };
    } else {
      return {
        type: "hold",
        reason: "No oversold/overbought in flat market",
        strategy: "meanReversion",
      };
    }
  }

  // MACD: Crossing MACD line & signal
  private macdCrossoverStrategy(): ISignal {
    const { macdLast, macdPrev } = this.indicators.macdCalculation();

    if (
      !!macdLast &&
      !!macdPrev &&
      "MACD" in macdLast &&
      "MACD" in macdPrev &&
      typeof macdLast.MACD === "number" &&
      typeof macdPrev.MACD === "number" &&
      typeof macdLast.signal === "number" &&
      typeof macdPrev.signal === "number"
    ) {
      if (macdLast.MACD > macdLast.signal && macdPrev.MACD <= macdPrev.signal) {
        return {
          type: "buy",
          reason: "MACD Cross Up (bullish signal)",
          strategy: "macdCrossover",
        };
      } else if (
        macdLast.MACD < macdLast.signal &&
        macdPrev.MACD >= macdPrev.signal
      ) {
        return {
          type: "sell",
          reason: "MACD Cross Down (bearish signal)",
          strategy: "macdCrossover",
        };
      } else {
        return {
          type: "hold",
          reason: "No MACD crossover",
          strategy: "macdCrossover",
        };
      }
    }
    return {
      type: "hold",
      reason: "No data for calculation",
      strategy: "macdCrossover",
    };
  }

  // Signals by all strategy
  public getAllSignals(): ISignal[] {
    return [
      this.trendFollowingStrategy(),
      this.meanReversionStrategy(),
      this.macdCrossoverStrategy(),
    ];
  }
}
