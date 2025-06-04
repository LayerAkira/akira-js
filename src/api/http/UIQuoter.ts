import { Address } from "../../types";
import { ERC20Token, ERCToDecimalsMap, GasFee } from "../../request_types";
import { Result, Snapshot } from "../../response_types";
import {
  bigIntToFormattedDecimal,
  formattedDecimalToBigInt,
  parseTableLvl,
} from "../utils";
import { BaseHttpAPI } from "./BaseHttpAPI";

export interface LayerAkiraHttpConfig {
  jwt?: string;
  tradingAccount?: Address;
  signer?: Address;
  apiBaseUrl: string;
}

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
    return await this.get("/gas/price");
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
    exponent: number = 0, //todo
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
        ecosystem: +to_ecosystem_book,
        levels: levels,
      },
      applyParseInt,
      [],
      (o: any) => {
        console.log("DAMN");
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
   * @returns A promise that resolves to a Result object containing the conversion rate
   */
  public async getConversionRate(
    token: ERC20Token,
  ): Promise<Result<[bigint, bigint]>> {
    return await this.get(
      "/info/conversion_rate",
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
}
