import { ERC20Token, ERCToDecimalsMap } from "../../request_types";
import { BBO, Result, Snapshot } from "../../response_types";
import { formattedDecimalToBigInt, parseTableLvl } from "../utils";
import { BaseHttpAPI } from "./BaseHttpAPI";

/**
 * The API class for the LayerAkira SDK.
 * @category Main Classes
 */
export class LayerAkiraUIQuoter extends BaseHttpAPI {
  public readonly erc20ToDecimals: ERCToDecimalsMap;
  private readonly baseFeeToken: ERC20Token;

  constructor(
    apiBaseUrl: string,
    erc20ToDecimals: ERCToDecimalsMap,
    baseFeeToken: ERC20Token,
    logger?: (arg: string) => void,
    timeoutMillis?: number,
  ) {
    super(apiBaseUrl, logger, timeoutMillis);
    this.erc20ToDecimals = erc20ToDecimals;
    this.baseFeeToken = baseFeeToken;
  }

  /**
   * Retrieves gas price that client would need to specify with some premium when sending some trading actions to LayerAkira
   * which would require onchain fingerprint
   * @returns A Promise that resolves with the gas price result
   */
  public async queryGasPrice(): Promise<Result<bigint>> {
    return await this.get("/gas_price", undefined, true, [], (o) =>
      formattedDecimalToBigInt(o, 18),
    );
  }

  /**
   * Retrieves the book snapshot from the specified trading pair
   * @param base
   * @param quote
   * @param exponent
   * @param levels - How many levels of book should be retrieved, -1 indicating all levels
   * @param to_ecosystem_book - Indicates whether to retrieve snapshot from the ecosystem book or router book
   * @param applyParseInt
   * @returns A Promise that resolves with the book Snapshot result.
   */
  public async getSnapshot(
    base: ERC20Token,
    quote: ERC20Token,
    to_ecosystem_book: boolean,
    exponent: number,
    levels: number = -1,
    applyParseInt: boolean = true,
  ): Promise<Result<Snapshot<bigint | string>>> {
    const baseDecimals = this.erc20ToDecimals[base];
    const quoteDecimals = this.erc20ToDecimals[quote];
    return await this.get(
      "/orderbook",
      {
        base,
        quote,
        exponent,
        ecosystem: to_ecosystem_book,
        levels: levels,
      },
      applyParseInt,
      [],
      (o: any) => {
        o.levels.bids = o.levels.bids.map((lst: any) =>
          applyParseInt ? parseTableLvl(lst, baseDecimals, quoteDecimals) : lst,
        );
        o.levels.asks = o.levels.asks.map((lst: any) =>
          applyParseInt ? parseTableLvl(lst, baseDecimals, quoteDecimals) : lst,
        );
        return o;
      },
    );
  }

  /**
   * Fetches suggested conversion rate between tokens in case user need rate for order building
   *  @param token in what token we want to pay setlement
   * @returns A promise that resolves to a Result object containing the
   * conversion rate [amount of base token, amount of fee token]
   */
  public async getConversionRate(
    token: ERC20Token,
  ): Promise<Result<[bigint, bigint]>> {
    return await this.get(
      "/conversion_rate",
      {
        token,
      },
      false,
      [],
      (e: any) => {
        if (e.length == 0) return e;
        e[0] = formattedDecimalToBigInt(
          e[0],
          this.erc20ToDecimals[this.baseFeeToken],
        );
        e[1] = formattedDecimalToBigInt(e[1], this.erc20ToDecimals[token]);
        return e;
      },
    );
  }

  public async getBBO(
    base: ERC20Token,
    quote: ERC20Token,
    to_ecosystem_book: boolean,
    exponent: number,
  ): Promise<Result<BBO>> {
    return await this.get(
      "/bbo",
      {
        base: base,
        quote: quote,
        ecosystem: to_ecosystem_book,
        exponent: exponent,
      },
      true,
      [],
      (o: any) => {
        const b = this.erc20ToDecimals[base];
        const q = this.erc20ToDecimals[quote];
        if (o.bid.price)
          o.bid = {
            price: formattedDecimalToBigInt(o.bid.price, q),
            volume: formattedDecimalToBigInt(o.bid.volume, b),
            orders: o.bid.orders,
          };
        if (o.ask.price)
          o.ask = {
            price: formattedDecimalToBigInt(o.ask.price, q),
            volume: formattedDecimalToBigInt(o.ask.volume, b),
            orders: o.ask.orders,
          };
        return o;
      },
    );
  }

  public async getPrices(
    tokens: ERC20Token[],
    applyParseInt: boolean = true,
  ): Promise<Result<Record<string, bigint | string>>> {
    return await this.get(
      "/prices",
      {
        tokens: tokens.join(","),
      },
      applyParseInt,
      [],
      (o: any) => {
        if (!applyParseInt) return o;
        Object.keys(o).forEach(
          (token) =>
            (o[token] = formattedDecimalToBigInt(
              o[token],
              this.erc20ToDecimals[token],
            )),
        );

        return o;
      },
    );
  }
}
