export class CoinPair {
  public BASE_ASSET_NAME: string;
  public QUOTE_ASSET_NAME: string;
  public PAIR_ASSET_NAME: string;

  constructor(base: string, quote: string) {
    this.BASE_ASSET_NAME = base;
    this.QUOTE_ASSET_NAME = quote;
    this.PAIR_ASSET_NAME = `${base}${quote}`;
  }
}
