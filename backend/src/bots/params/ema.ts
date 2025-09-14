import { IEmaParams } from "../../services/indicators";

export const emaParams: {
  [key: string]: IEmaParams;
} = {
  "1m": {
    shortPeriod: 9,
    longPeriod: 21,
  },
  "15m": {
    shortPeriod: 12,
    longPeriod: 26,
  },
  "1h": {
    shortPeriod: 50,
    longPeriod: 200,
  },
};
