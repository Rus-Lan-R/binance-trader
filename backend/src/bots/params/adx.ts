import { IAdxParams } from "../../services/indicators";

export const adxParams: {
  [key: string]: IAdxParams;
} = {
  "1m": {
    period: 10,
    threshold: 20,
  },
  "15m": {
    period: 14,
    threshold: 25,
  },
  "1h": {
    period: 14,
    threshold: 25,
  },
};
