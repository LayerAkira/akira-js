import { Address } from "../../types";

/**
 * Represents trade information for an order on the LayerAkira exchange.
 */
export interface OrderTradeInfo {
  filled_base_amount: bigint; // filled amount in base asset
  filled_quote_amount: bigint; // filled amount in quote qty
  last_traded_px: bigint;
  num_trades_happened: number;
  as_taker_completed: boolean;
}

interface Event {
  block_number: number;
  transaction_hash: string;
}

/**
 * Represents a trade event on the LayerAkira exchange.
 */
export interface TradeEvent extends Event {
  maker: Address; // The address of the maker
  taker: Address; // The address of the taker
  ticker: {
    // Ticker information
    baseAddress: Address; // The address of the base asset
    quoteAddress: Address; // The address of the quote asset
  };
  router_maker: Address; // The address of the maker's router
  router_taker: Address; // The address of the taker's router
  amount_base: bigint; // The amount of base asset traded
  amount_quote: bigint; // The amount of quote asset traded
  is_sell_side: boolean; // Indicates if the trade is on the sell side
  is_failed: boolean; // Indicates if the trade failed
  is_ecosystem_book: boolean; // Indicates if the trade is in the ecosystem book
  maker_hash: string;
  taker_hash: string;
  maker_source: string;
  taker_source: string;
}

/**
 * Represents a withdrawal event on the LayerAkira exchange.
 */
export interface WithdrawalEvent extends Event {
  maker: Address; // The address of the maker
  token: Address; // The address of the token
  receiver: Address; // The address of the receiver
  salt: bigint; // The salt value
  amount: bigint; // The amount of tokens withdrawn before gas fees if applied
  gas_price: bigint; // The gas price
  gas_fee: {
    // Gas fee details
    gas_per_action: number; // Gas per action
    fee_token: Address; // The address of the fee token
    max_gas_price: bigint; // The maximum gas price
    conversion_rate: [bigint, bigint]; // The conversion rate
  };
  direct: boolean; // Indicates if the withdrawal is performed by the user or handled by exchange
}
/**
 * Represents a deposit event on the LayerAkira exchange.
 */
export interface DepositEvent extends Event {
  receiver: Address; // recipient of funds on exchange contract  side
  token: Address; // The address of the token
  funder: Address; // The address of the funder
  amount: bigint; // The amount of tokens deposited
}
