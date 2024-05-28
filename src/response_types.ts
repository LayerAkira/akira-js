import { ERC20Token, OrderStatus, TradedPair } from "@/request_types.ts";
import { Address } from "@/types.ts";
import { ExchangeTicker } from "@/api";

/**
 * Represents the result of an operation.
 */
export interface Result<T> {
  result?: T; // The result of the operation, omitted if operation failed
  code?: number; // The status code of the operation, might be omitted in case of successful operation
  error?: string; // The error message, if any, human-readable
  exception?: Error; // The exception, if any
}

/**
 * Represents a level in the order book.
 */
export interface TableLevel {
  price: bigint; // The price of the level in raw format
  volume: bigint; // The volume at this level, in quote asset.
  orders: number; // The number of orders at this level.
}

/**
 * Represents the Best Bid and Offer (BBO).
 */
export interface BBO {
  bid?: TableLevel | null; // The best bid level.
  ask?: TableLevel | null; // The best ask level.
  ts: number; // The timestamp when the BBO was sent.
}

/**
 * Represents the order book table.
 */
export interface Table {
  bids: [bigint, bigint, number][]; // Array of bid levels [price, volume, orders].
  asks: [bigint, bigint, number][]; // Array of ask levels [price, volume, orders].
}

/**
 * Represents a snapshot of the order book.
 */
export interface Snapshot {
  levels: Table; // The levels of the order book.
  msg_id: string; // The message ID of the snapshot.
  time: number; // The timestamp when the snapshot was taken.
}

/**
 * Represents an update to the order book table.
 */
export interface TableUpdate extends Table {
  msg_id: bigint; // The message ID of the update.
  time: number; // The timestamp when the update was received.
}

/**
 * Represents a user's balance of an ERC20 token.
 */
export interface Balance {
  token: ERC20Token; // The ERC20 token.
  balance: bigint; // The available balance of the token on exchange.
  locked: bigint; // The locked or reserved balance of the token exchange.
}

export type FeeTuple = [number, number]; // Array of maker and taker fees in percentage basis points.

/**
 * Represents a user's trading fee for a specific traded pair.
 */
export interface UserFee extends TradedPair {
  fee: FeeTuple[]; // Array of maker and taker fees in percentage basis points.
}

/**
 * Represents user information including balances and fees on exchange.
 */
export interface UserInfo {
  nonce: number; // The nonce value for the user.
  balances: Balance[]; // Array of token balances held by the user.
  fees: UserFee[]; // Array of trading fees applicable to the user.
}

/**
 * Represents an execution report for an order.
 */
export interface ExecutionReport {
  client: Address; // maker of order
  pair: TradedPair; // The traded pair associated with the execution.
  fill_price: bigint; // The price at which the order was filled.
  fill_base_qty: bigint; // The filled quantity in the base token.
  fill_quote_qty: bigint; // The filled quantity in the quote token.
  acc_base_qty: bigint; // The accumulated filled quantity in the base token.
  acc_quote_qty: bigint; // The accumulated filled quantity in the quote token.
  hash: string; // The order hash.
  is_sell_side: boolean; // Indicates whether the order was on the sell side.
  status: OrderStatus; // The status of the order.
}

/**
 * Represents a trade.
 */
export interface Trade {
  price: bigint; // The price at which the trade occurred.
  base_qty: bigint; // The quantity of the base currency involved in the trade.
  quote_qty: bigint; // The quantity of the quote currency involved in the trade.
  is_sell_side: boolean; // Indicates whether the trade was on the sell side.
  time: number; // The timestamp when the trade occurred.
}

/**
 * Interface representing the configuration for number of steps each rollup action would require
 */
export interface StepsConfiguration {
  withdraw: { steps: number };
  swapRouter: { steps: number };
  swapEcosystem: { steps: number };
  nonce: { steps: number };
}

/**
 * Interface representing the specification for an exchange ticker.
 */
export interface TickerSpecification {
  /**
   * The exchange ticker details, eg ETH/USDT, router book
   */
  ticker: ExchangeTicker;
  /**
   * The raw price increment for the price (min tick for price) e.g.  10**5 (0.1) for USDT in quote asset
   */
  rawPriceIncrement: bigint;
  /**
   * Minimum amount that can be traded under this market in base asset, 10**15 (0.001) for ETH
   */
  rawMinQuoteQty: bigint;
  /**
   * Minimal increment in base qty (min tick for qty). for example 10**14 (0.0001) for ETH
   */
  rawQuoteQtyIncrement: bigint;
}

/**
 * Interface that defines the specifications for a router, including fees and addresses related to the router's operation
 */
export interface RouterSpecification {
  /**
   * The router taker basis points.
   * This represents the fee in percent of basis points that the client as taker would be charged which goes to router fee recipient
   */
  routerTakerPbips: number;
  /**
   * The router maker basis points.
   * This represents the fee in percent of basis points that the client as maker would be charged which goes to router fee recipient
   */
  routerMakerPbips: number;
  /**
   * The address of the router signer.
   * This is the address which used for signing order on behalf or router fee recipient
   */
  routerSigner: Address;
  /**
   * The address of the router fee recipient.
   * This is the address that will receive the fees collected for routing. Router
   */
  routerFeeRecipient: Address;
}
