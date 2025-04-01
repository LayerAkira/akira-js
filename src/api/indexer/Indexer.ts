import { Result } from "../../response_types";
import {
  DbDeposit,
  DbOrder,
  DbRollup,
  DbTrade,
  DbWithdrawal,
  TraderVolume,
} from "./types";
import { BaseHttpAPI } from "../http/BaseHttpAPI";
import { ERC20Token } from "../../request_types";

/**
 * The API class for the Indexer SDK.
 * @category Main Classes
 */
export class IndexerAPI extends BaseHttpAPI {
  constructor(
    apiBaseUrl: string,
    logger?: (arg: string) => void,
    timeoutMillis?: number,
  ) {
    super(apiBaseUrl, logger, timeoutMillis);
  }

  /**
   * Retrieves trades data based on the transaction hash.
   *
   * @param tx_hash - The transaction hash.
   * @returns A Promise that resolves with the trade data result.
   */
  public async getTradesByTxHash(tx_hash: string): Promise<Result<DbTrade[]>> {
    return await this.get<Result<DbTrade[]>>(
      `/trades/${tx_hash}`,
      undefined,
      false,
      [],
      (o: any) => o,
    );
  }
  /**
   * Retrieves trades data for particular ticker.
   *
   * @param pair - trades for associated traded pair
   * @param cursor - {maker_hash}_{taker_hash} of last processed entry
   * @param num
   * @returns A Promise that resolves with the trade data result.
   */
  public async getTradesByTicker(
    pair: {
      base: ERC20Token;
      quote: ERC20Token;
      is_ecosystem_book: boolean;
    },
    cursor: string | null = null,
    num: string = "20",
  ): Promise<Result<DbTrade[]>> {
    return await this.get<Result<DbTrade[]>>(
      `/trades/${pair.base}/${pair.quote}/${pair.is_ecosystem_book}`,
      cursor !== null ? { cursor, num } : { num },
      false,
      [],
      (o: any) => o,
    );
  }
  /**
   * Retrieves rollup data based on the transaction hash.
   * @param tx_hash - The transaction hash.
   * @returns A Promise that resolves with the rollup data result.
   */
  public async getRollupByTxHash(tx_hash: string): Promise<Result<DbRollup>> {
    return await this.get<Result<DbRollup>>(
      `/rollup/${tx_hash}`,
      undefined,
      false,
      [],
      (o: any) => o,
    );
  }

  /**
   * Retrieves specific trader order details.
   * @param trader - Trader address.
   * @param order_hash - Order hash.
   * @returns A Promise that resolves with the trader order data result.
   */
  public async getTraderOrder(
    trader: string,
    order_hash: string,
  ): Promise<Result<DbOrder>> {
    return await this.get<Result<DbOrder>>(
      `/orders/${trader}/${order_hash}`,
      undefined,
      false,
      [],
      (o: any) => o,
    );
  }

  /**
   * Retrieves all orders for a trader.
   * @param trader - Trader address.
   * @param pair - optional to skew on particular traded pair
   * @param cursor - Cursor to paginate. use hash of the last processed order
   * @param num - Number of orders to fetch.
   * @param skip_dependant_orders - should synthetic part of lead order be skipped
   * @returns A Promise that resolves with a list of trader orders. from latest to oldest
   */
  public async getTraderOrders(
    trader: string,
    pair: {
      base: ERC20Token;
      quote: ERC20Token;
      is_ecosystem_book: boolean;
    } | null = null,
    cursor: string | null = null,
    num: string = "20",
    skip_dependant_orders: boolean = true,
  ): Promise<Result<{ data: DbOrder[]; cursor: string | null }>> {
    return await this.get<Result<{ data: DbOrder[]; cursor: string | null }>>(
      pair === null
        ? `/orders/${trader}`
        : `/orders/${trader}/${pair.base}/${pair.quote}/${pair.is_ecosystem_book}`,
      cursor !== null
        ? { cursor, num, skip_dependant_orders }
        : { num, skip_dependant_orders },
      false,
      [],
      (o: any) => o,
    );
  }

  /**
   * Retrieves the traded volume for a specific trader.
   * @param trader - Trader address.
   * @returns A Promise that resolves with the volume data for the trader.
   */
  public async getTradedVolume(trader: string): Promise<Result<TraderVolume>> {
    return await this.get<Result<TraderVolume>>(
      `/volume`,
      { trader },
      false,
      [],
      (o: any) => o,
    );
  }

  /**
   * Retrieves trader deposits
   * @param trader - Trader address.
   * @param token_address - filter to skew on specific token address
   * @param cursor - Cursor to paginate. use {tx_hash}_{event_idx} as cursor
   * @param num - Number of orders to fetch.
   * @returns A Promise that resolves with a list of db deposits. from latest to oldest
   */
  public async getTraderDeposits(
    trader: string,
    token_address: string | null = null,
    cursor: string | null = null,
    num: number = 20,
  ): Promise<Result<DbDeposit[]>> {
    let path = `/deposits/${trader}`;
    if (token_address !== null) path += "/" + token_address;
    return await this.get<Result<DbDeposit[]>>(
      path,
      cursor !== null ? { cursor, num } : { num },
      false,
      [],
      (o: any) => {
        o.forEach((e: any) => (e.amount = BigInt(e.amount)));
        return o;
      },
    );
  }

  /** Retrieves trader withdrawals.
   * @param trader - Trader address.
   * @param token_address - Filter by a specific token address.
   * @param cursor - Cursor for pagination, use {tx_hash}_{event_idx}.
   * @param num - Number of withdrawals to fetch.
   * @returns A Promise that resolves with a list of withdrawals, from latest to oldest.
   */
  public async getTraderWithdrawals(
    trader: string,
    token_address: string | null = null,
    cursor: string | null = null,
    num: number = 20,
  ): Promise<Result<DbWithdrawal[]>> {
    let path = `/withdrawals/${trader}`;
    if (token_address !== null) path += "/" + token_address;
    return await this.get<Result<DbWithdrawal[]>>(
      path,
      cursor !== null ? { cursor, num } : { num },
      false,
      [],
      (o: any) => {
        o.forEach((e: any) => (e.amount = BigInt(e.amount)));
        return o;
      },
    );
  }
}
