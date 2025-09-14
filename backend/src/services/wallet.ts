import { Binance } from "binance-api-node";
import { CoinPair } from "./coin";
import { BigNumber } from "bignumber.js";

interface IWalletServiceProps {
  binanceClient: Binance;
  coinPair: CoinPair;
}

const BALANCE_UPDATE_INTERVAL = 3000;

export class Wallet {
  public storedAccountBalancePair;
  protected binanceClient: Binance;
  public coinPair: CoinPair;

  constructor(data: IWalletServiceProps) {
    this.coinPair = data.coinPair;
    this.binanceClient = data.binanceClient;
    this.storedAccountBalancePair = {
      baseBalance: new BigNumber(0),
      quoteBalance: new BigNumber(0),
      timestamp: 0,
    };
  }

  async getBalance() {
    try {
      const account = await this.binanceClient.accountInfo();

      const balance = account.balances.reduce<{
        baseBalance: BigNumber;
        quoteBalance: BigNumber;
      }>(
        (acc, item) => {
          if (item.asset === this.coinPair.BASE_ASSET_NAME) {
            return { ...acc, baseBalance: new BigNumber(item.free) };
          } else if (item.asset === this.coinPair.QUOTE_ASSET_NAME) {
            return { ...acc, quoteBalance: new BigNumber(item.free) };
          }
          return acc;
        },
        { baseBalance: BigNumber(0), quoteBalance: BigNumber(0) }
      );

      if (!balance) {
        console.log(`❌ Asset ${this.coinPair.BASE_ASSET_NAME} not found`);
        return;
      }

      return { balance };
    } catch (err) {
      console.error("❌ Unable balance retrieve:", (err as Error).message);
    }
  }

  public async getStoredBalancePair() {
    if (
      Date.now() >
      this.storedAccountBalancePair.timestamp + BALANCE_UPDATE_INTERVAL
    ) {
      const data = await this.getBalance();
      if (data?.balance) {
        this.setStoredBalance({
          baseBalance: data.balance.baseBalance,
          quoteBalance: data.balance.quoteBalance,
        });
      }
      return data?.balance;
    }
    return this.storedAccountBalancePair;
  }

  public setStoredBalance(value: {
    baseBalance: BigNumber;
    quoteBalance: BigNumber;
  }) {
    this.storedAccountBalancePair = {
      baseBalance: value.baseBalance,
      quoteBalance: value.quoteBalance,
      timestamp: Date.now(),
    };
  }
}
