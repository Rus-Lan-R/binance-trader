import { IRsiParams } from "../../services/indicators";

export const rsiParams: {
  [key: string]: IRsiParams;
} = {
  "1m": {
    period: 9,
    oversold: 20,
    overbought: 80,
  },
  "15m": {
    period: 14,
    oversold: 30,
    overbought: 70,
  },
  "1h": {
    period: 14,
    oversold: 30,
    overbought: 70,
  },
};
