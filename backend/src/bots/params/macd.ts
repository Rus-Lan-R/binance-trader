import { IMacdParams } from "../../services/indicators";

export const macdParams: { [key: string]: IMacdParams } = {
  "1m": {
    fastPeriod: 3,
    slowPeriod: 10,
    signalPeriod: 3,
  },
  "15m": {
    fastPeriod: 5,
    slowPeriod: 13,
    signalPeriod: 5,
  },
  "1h": {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
  },
};
