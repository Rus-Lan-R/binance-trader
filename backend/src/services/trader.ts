import { BigNumber } from "bignumber.js";
import Binance, { CandleChartInterval_LT, OrderType } from "binance-api-node";
import { Wallet } from "./wallet";
import { CoinPair } from "./coin";

interface ITraderProps {
  binance: {
    apiKey: string;
    apiSecret: string;
    httpBase: string;
    wsBase: string;
  };
  coin: {
    baseAssetName: string;
    quoteAssetName: string;
  };
  settings: {
    INTERVAL: CandleChartInterval_LT;
    RISK_PERCENT: number;
    STOP_LOSS_PERCENT: number;
    TAKE_PROFIT_PERCENT: number;
    K_LINES_LIMIT: number;
  };
}

export class Trader extends Wallet {
  public exchangeInfo: {
    minQty: BigNumber;
    maxQty: BigNumber;
    stepSize: BigNumber;
  };
  public settings: ITraderProps["settings"];
  public hasOpenOrders: boolean;

  constructor(data: ITraderProps) {
    const binanceClient = Binance({
      apiKey: data.binance.apiKey,
      apiSecret: data.binance.apiSecret,
      httpBase: data.binance.httpBase,
      wsBase: data.binance.wsBase,
    });
    const coinPair = new CoinPair(
      data.coin.baseAssetName,
      data.coin.quoteAssetName
    );

    super({ binanceClient, coinPair });

    this.exchangeInfo = {
      minQty: new BigNumber(0),
      maxQty: new BigNumber(0),
      stepSize: new BigNumber(0),
    };

    this.settings = data.settings;
    this.hasOpenOrders = false;
  }

  public async init() {
    const openOrders = await this.getOpenOcoOrders();
    this.hasOpenOrders = !!openOrders.length;
    await this.getBalance();
    await this.getExchangeInfo();
  }

  public async getExchangeInfo() {
    try {
      const info = await this.binanceClient.exchangeInfo();
      const btcPair = info.symbols.find(
        (s) => s.symbol === this.coinPair.PAIR_ASSET_NAME
      );
      if (!btcPair) {
        throw new Error(`Symbol ${this.coinPair.PAIR_ASSET_NAME} not found`);
      }
      const lotFilter = btcPair.filters.find(
        (f) => f.filterType === "LOT_SIZE"
      );
      if (!lotFilter) {
        throw new Error("LOT_SIZE filter not found");
      }
      this.exchangeInfo = {
        minQty: new BigNumber(lotFilter.minQty || 0),
        maxQty: new BigNumber(lotFilter.maxQty || 0),
        stepSize: new BigNumber(lotFilter.stepSize || 0),
      };
      console.log("EXCHANGE INFO:", {
        minQty: this.exchangeInfo.minQty.toFixed(2),
        maxQty: this.exchangeInfo.maxQty.toFixed(2),
        stepSize: this.exchangeInfo.stepSize.toFixed(2),
      });
    } catch (err) {
      console.error("Error fetching exchange info:", (err as Error).message);
      throw err;
    }
  }

  public async getOpenOcoOrders() {
    try {
      const allOpenOrders = await this.binanceClient.openOrders({
        symbol: this.coinPair.PAIR_ASSET_NAME,
      });

      if (!allOpenOrders?.[0]) {
        console.log(`No open orders for ${this.coinPair.PAIR_ASSET_NAME}`);
        return [];
      }

      // Filter OCO orders (those with a orderListId) and group by orderListId
      const ocoOrdersMap = new Map<number, any[]>();
      allOpenOrders.forEach((order: any) => {
        if (order.orderListId && order.orderListId !== -1) {
          // orderListId indicates OCO
          if (!ocoOrdersMap.has(order.orderListId)) {
            ocoOrdersMap.set(order.orderListId, []);
          }
          ocoOrdersMap.get(order.orderListId)!.push(order);
        }
      });

      if (ocoOrdersMap.size === 0) {
        console.log(`No open OCO orders for ${this.coinPair.PAIR_ASSET_NAME}`);
        return [];
      }

      // Format OCO orders
      const formattedOrders = Array.from(ocoOrdersMap.entries()).map(
        ([orderListId, orders]) => {
          // Typically, OCO has two orders: limit (take-profit) and stop-limit (stop-loss)
          const limitOrder =
            orders.find((o) => o.type === "LIMIT_MAKER") || orders[0];
          const stopOrder =
            orders.find((o) => o.type === "STOP_LOSS_LIMIT") || orders[1] || {};

          return {
            orderListId: orderListId,
            symbol: this.coinPair.PAIR_ASSET_NAME,
            status: limitOrder.status, // Assuming both orders have the same status
            quantity: new BigNumber(limitOrder.origQty).toFixed(8),
            price: new BigNumber(limitOrder.price).toFixed(2), // Take-profit price
            stopPrice: new BigNumber(stopOrder.stopPrice || 0).toFixed(2), // Stop-loss trigger price
            stopLimitPrice: new BigNumber(stopOrder.price || 0).toFixed(2), // Stop-loss limit price
            createdAt: new Date(limitOrder.time).toISOString(),
            orders: orders.map((o: any) => ({
              orderId: o.orderId,
              clientOrderId: o.clientOrderId,
            })),
          };
        }
      );

      console.log(
        `Retrieved ${formattedOrders.length} open OCO orders for ${this.coinPair.PAIR_ASSET_NAME}`
      );
      return formattedOrders;
    } catch (err) {
      console.error("Error fetching open OCO orders:", (err as Error).message);
      throw err;
    }
  }

  async closeOco() {
    await this.binanceClient.cancelOpenOrders({
      symbol: this.coinPair.PAIR_ASSET_NAME,
    });
  }

  public async buyWithOco() {
    try {
      const balance = await this.getStoredBalancePair();
      if (!balance?.quoteBalance || balance.quoteBalance.lte(0)) {
        console.log("Insufficient quote asset balance");
        return;
      }

      const price = await this.getCurrentPrice();
      if (price.lte(0)) {
        console.log("Invalid price received");
        return;
      }

      const priceInBaseAsset = balance.quoteBalance.div(price);
      const riskAmount = priceInBaseAsset.multipliedBy(
        this.settings.RISK_PERCENT
      );

      if (riskAmount.lte(0)) {
        console.log("Calculated risk amount is zero or negative");
        return;
      }

      const quantity = this.adjustQuantity(riskAmount);
      if (quantity === "0.00000000") {
        console.log("Adjusted quantity is too small");
        return;
      }

      console.log(`Preparing to buy ${quantity} at ${price.toFixed(2)}`);

      const order = await this.binanceClient.order({
        symbol: this.coinPair.PAIR_ASSET_NAME,
        side: "BUY",
        type: OrderType.MARKET,
        quantity: quantity,
      });
      console.log("✅ Buy order executed:", order);

      const stopLossPrice = price
        .multipliedBy(1 - this.settings.STOP_LOSS_PERCENT)
        .toFixed(2);
      const takeProfitPrice = price
        .multipliedBy(1 + this.settings.TAKE_PROFIT_PERCENT)
        .toFixed(2);

      const ocoOrder = await this.binanceClient.orderOco({
        symbol: this.coinPair.PAIR_ASSET_NAME,
        side: "SELL",
        quantity: quantity,
        price: takeProfitPrice,
        stopPrice: stopLossPrice,
        stopLimitPrice: stopLossPrice,
        stopLimitTimeInForce: "GTC",
      });
      console.log("✅ OCO order set:", ocoOrder);

      this.hasOpenOrders = true;
    } catch (err) {
      console.error("❌ Buy with OCO error:", (err as Error).message);
      throw err;
    }
  }

  public async sell() {
    try {
      // Cancel any existing OCO orders before selling
      if (this.hasOpenOrders) {
        console.log(
          `Canceling open OCO orders for ${this.coinPair.PAIR_ASSET_NAME}`
        );
        await this.closeOco();
        this.hasOpenOrders = false;
      }

      const balance = await this.getStoredBalancePair();
      if (!balance?.baseBalance || balance.baseBalance.lte(0)) {
        console.log("No base asset to sell");
        return;
      }

      const quantity = this.adjustQuantity(balance.baseBalance);
      if (quantity === "0.00000000") {
        console.log("Adjusted sell quantity is too small");
        return;
      }

      console.log(`Preparing to sell ${quantity}`);

      const order = await this.binanceClient.order({
        symbol: this.coinPair.PAIR_ASSET_NAME,
        side: "SELL",
        type: OrderType.MARKET,
        quantity: quantity,
      });
      console.log("✅ Sell order executed:", order);
    } catch (err) {
      console.error("❌ Sell error:", (err as Error).message);
      throw err;
    }
  }

  public async getCurrentPrice() {
    try {
      const ticker = await this.binanceClient.prices({
        symbol: this.coinPair.PAIR_ASSET_NAME,
      });
      const price = new BigNumber(ticker[this.coinPair.PAIR_ASSET_NAME]);
      if (price.lte(0)) {
        throw new Error("Invalid price received");
      }
      return price;
    } catch (err) {
      console.error("Error fetching price:", (err as Error).message);
      throw err;
    }
  }

  public async getKLines() {
    try {
      const kLines = await this.binanceClient.candles({
        symbol: this.coinPair.PAIR_ASSET_NAME,
        interval: this.settings.INTERVAL,
        limit: this.settings.K_LINES_LIMIT,
        endTime: Date.now(),
      });
      return kLines;
    } catch (err) {
      console.error("Error fetching kLines:", (err as Error).message);
      throw err;
    }
  }

  public async getConvertedBalance(currencyValue: BigNumber) {
    return this.storedAccountBalancePair.baseBalance.multipliedBy(
      currencyValue
    );
  }

  private adjustQuantity(amount: BigNumber) {
    let adjusted = amount
      .div(this.exchangeInfo.stepSize)
      .integerValue(BigNumber.ROUND_DOWN)
      .multipliedBy(this.exchangeInfo.stepSize);

    if (adjusted.lt(this.exchangeInfo.minQty)) {
      console.warn(
        `Adjusted quantity ${adjusted.toFixed(
          8
        )} below minimum ${this.exchangeInfo.minQty.toFixed(8)}`
      );
      return "0.00000000";
    }
    if (adjusted.gt(this.exchangeInfo.maxQty)) {
      console.warn(
        `Adjusted quantity ${adjusted.toFixed(
          8
        )} above maximum ${this.exchangeInfo.maxQty.toFixed(8)}`
      );
      adjusted = this.exchangeInfo.maxQty;
    }

    return adjusted.toFixed(8, BigNumber.ROUND_DOWN);
  }
}
