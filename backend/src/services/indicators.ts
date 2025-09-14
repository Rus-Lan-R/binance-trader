import { ADX, CrossDown, CrossUp, EMA, MACD, RSI } from "technicalindicators";

export interface IMacdParams {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export interface IEmaParams {
  shortPeriod: number;
  longPeriod: number;
}

export interface IAdxParams {
  period: number;
  threshold: number;
}

export interface IRsiParams {
  period: number;
  oversold: number;
  overbought: number;
}

interface IIndicatorsServiceProps {
  ema: IEmaParams;
  macd: IMacdParams;
  adx: IAdxParams;
  rsi: IRsiParams;
}

export interface ISplittedKLines {
  close: number[];
  high: number[];
  low: number[];
}

export class Indicators {
  public ema;
  public macd;
  public adx;
  public rsi;

  public splittedKLines: ISplittedKLines;
  constructor(data: IIndicatorsServiceProps) {
    this.macd = data.macd;
    this.ema = data.ema;
    this.adx = data.adx;
    this.rsi = data.rsi;
    this.splittedKLines = {
      close: [],
      low: [],
      high: [],
    };
  }

  public setSplittedKLines(newSplittedKLines: ISplittedKLines) {
    this.splittedKLines = newSplittedKLines;
  }

  public addSplittedKLines(newData: ISplittedKLines) {
    this.splittedKLines = {
      close: [...(this.splittedKLines.close || []), ...newData?.close],
      high: [...(this.splittedKLines.high || []), ...newData?.high],
      low: [...(this.splittedKLines.low || []), ...newData?.low],
    };
  }

  public emaCalculation() {
    const shortEMA = EMA.calculate({
      period: this.ema.shortPeriod,
      values: this.splittedKLines.close.slice(-this.ema.shortPeriod * 2),
    });

    const longEMA = EMA.calculate({
      period: this.ema.longPeriod,
      values: this.splittedKLines.close.slice(-this.ema.longPeriod * 2),
    });

    const lastShort = shortEMA[shortEMA.length - 1];
    const prevShort = shortEMA[shortEMA.length - 2];
    const lastLong = longEMA[longEMA.length - 1];
    const prevLong = longEMA[longEMA.length - 2];

    return {
      prev: { lastShort, prevLong, lastLong, prevShort },
      shortEMA,
      longEMA,
    };
  }

  public macdCalculation() {
    const macdResult = MACD.calculate({
      values: this.splittedKLines.close,
      fastPeriod: this.macd.fastPeriod,
      slowPeriod: this.macd.slowPeriod,
      signalPeriod: this.macd.signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    const macdLast = macdResult[macdResult.length - 1];
    const macdPrev = macdResult[macdResult.length - 2];

    return { macdLast, macdPrev };
  }

  public rsiCalculation() {
    const rsiValues = RSI.calculate({
      period: 14,
      values: this.splittedKLines.close.slice(-14 * 2),
    });
    const lastRSI = rsiValues[rsiValues.length - 1];

    return { rsiValues, lastRSI };
  }

  public adxCalculation() {
    const adxValues = ADX.calculate({
      high: this.splittedKLines.high,
      low: this.splittedKLines.low,
      close: this.splittedKLines.close,
      period: 14,
    });

    const latestADX = adxValues[adxValues.length - 1]?.adx;
    const latestPDI = adxValues[adxValues.length - 1]?.pdi;
    const latestMDI = adxValues[adxValues.length - 1]?.mdi;
    return { latestADX, latestPDI, latestMDI };
  }

  public flowCross(data: {
    prevShort: number;
    lastShort: number;
    lastLong: number;
    prevLong: number;
  }) {
    const isCrossUp = CrossUp.calculate({
      lineA: [data.prevShort, data.lastShort],
      lineB: [data.prevLong, data.lastLong],
    })[0];

    const isCrossDown = CrossDown.calculate({
      lineA: [data.prevShort, data.lastShort],
      lineB: [data.prevLong, data.lastLong],
    })[0];

    return { isCrossDown, isCrossUp };
  }
}
