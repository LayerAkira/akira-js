import { Address, OrderTimestamp } from "./types";
import { ExchangeTicker } from "./api";
import { MatchingEngineResult } from "./response_types";

/**
 * Represents all status that order might have on exchange
 */
export enum OrderStatus {
  ACCEPTED = "ACC", // order accepted by the exchange
  OPEN = "OPEN", // order successfully inserted to the book
  SCHEDULED_CANCEL = "SCHEDULED_TO_CANCEL", // order scheduled to be cancelled
  CANCELLED = "CANCELLED", // order was successfully cancelled and removed from the order book
  PARTIALLY_FILLED = "PARTIALLY_FILLED", // order was partially filled
  FILLED = "FILLED", // order was fully filled
  CLOSED = "CLOSED", // order was closed (in case of taker orders)
  FAILED_ROLLUP = "FAILED_ROLLUP", // part of order was failed due some issue, used in reports only
  REIMBURSE = "REIMBURSE", // part of order was failed due some issue, used in reports only
  NOT_PROCESSED = "NOT_PROCESSED",
  EXPIRED = "EXPIRED", // order expired
}

/**
 *
 */
export enum SignScheme {
  ECDSA = "ecdsa curve",
  ACCOUNT = "account",
  //..
}

/**
 * Represents the erc20 token e.g. ETH
 */
export type ERC20Token = string;

/**
 * Represents the quantity of an asset.
 */
export interface Quantity {
  base_qty: bigint; // Quantity in the base asset, expressed as raw amount.
  quote_qty: bigint; // Quantity in the quote asset, expressed as raw amount.
  base_asset: bigint; // Raw amount of the base asset representing 1 unit. e.g 1eth = 10**18
}

export enum OrderSide {
  BUY = 0,
  SELL = 1,
}

export type TraderSignature = [string, string] | string[];

export enum OrderType {
  LIMIT = 0,
  MARKET = 1,
}

/**
 * Represents the flags associated with an order.
 */
export interface OrderFlags {
  full_fill_only: boolean; // Indicates whether the order can only be fully filled. FOK
  best_level_only: boolean; // Indicates whether the order should be filled at the best available price only
  post_only: boolean; // Indicates whether the order should be posted only (resting order/passive order)
  is_sell_side: boolean; // Indicates whether the order is on the sell side. (ask or bid side)
  is_market_order: boolean; // Indicates whether the order is a market order.
  to_ecosystem_book: boolean; // Indicates whether the order is directed to the ecosystem book or router book
  external_funds: boolean; // Indicates whether the order settlement would involve external_funds (funds not reside in LayerAkira smart contact)
}

/**
 * Represents the self-trade prevention mode for an order.
 */
export enum STPMode {
  NONE = 0, // No self-trade prevention.
  EXPIRE_TAKER = 1, // Expire on the taker side if signers matches, remaining cancelled
  EXPIRE_MAKER = 2, // Expire on the maker side,  if signers matches, makers cancelled, taker will be match with orders after them
  EXPIRE_BOTH = 3, // Both expire
}

/**
 * Represents the order traded pair for example {base:'ETH',quote:'STRK'}
 */
export interface TradedPair {
  base: ERC20Token;
  quote: ERC20Token;
}

/**
 * Represents the constraints associated with an order.
 */
export interface Constraints {
  number_of_swaps_allowed: number; // The maximum number of swaps (trades) allowed to happen with the order when he is taker
  duration_valid: number; // The duration of validity for the order in seconds
  created_at: OrderTimestamp; // The timestamp when the order was created, epoch, in seconds
  stp: STPMode; // The self-trade prevention mode for the order.
  nonce: number; // The nonce value associated with the maker
  min_receive_amount: bigint; // The minimum amount expected to be reachieved by the trade after full order fulfillment, only applicable to router taker external funds orders
  router_signer: Address; // The address of the router signer, that routes this orders to LayerAkira
}

/**
 * Represents the fixed fee structure for an order.
 */
export interface FixedFee {
  recipient: Address; // The recipient of the fixed fee
  maker_pbips: number; // The maker fee rate in PBIPS (Percentage Basis Points)
  taker_pbips: number; // The taker fee rate in PBIPS (Percentage Basis Points)
  apply_to_receipt_amount: boolean; // Take fees from spend or receive amount
}

/**
 * Represents the gas fee structure for an trading activity that imply on-chain fingerprint.
 */
export interface GasFee {
  gas_per_action: number; // The max gas cost per action, similar semantic like with blockchain fees
  fee_token: ERC20Token; // The token used for paying gas fees
  max_gas_price: bigint; // The max price per gas, similar semantic like with blockchain fees
  conversion_rate: [bigint, bigint]; // The conversion rate for gas fees, if paid in non-native for chain token
}

/**
 * Represents the fees associated with an order.
 */
export interface OrderFee {
  trade_fee: FixedFee;
  router_fee: FixedFee;
  gas_fee: GasFee;
}

/**
 * Represents information about the state of an order.
 */
export interface OrderStateInfo {
  filled_base_amount: bigint; // The filled quantity in the base token.
  filled_quote_amount: bigint; // The filled quantity in the quote token.
  cur_number_of_swaps: bigint; // The current number of swaps.
  status: OrderStatus; // The status of the order.
  limit_price: bigint | undefined; // The limit price of the order, if applicable. the price at which it resides as resting order
  paid_fee_as_maker: bigint; // not normalized, in token user decided to pay: either pay or receive, in total for exchange and router fees
  paid_fee_as_taker: bigint; // same as paid_fee_as_maker
  failed_base_amount: bigint; // amount that was failed
  failed_quote_amount: bigint; // amount that was failed
  failed_offchain: number; // failed offchain
  failed_onchain: number; // failed onchain
  reimbursement: bigint; // applicable to market makers
  gas_paid: bigint; // in final token user specified
}

export interface OutsideCall {
  to: Address; // Contract address
  selector: string; // Human-readable selector, e.g., "approve"
  args?: string[]; // Optional list of arguments, mutual exclusive with kwargs
  kwargs?: Record<string, string>; // Optional dictionary of keyword arguments of call
}

interface ExecuteOutsideCall {
  caller: string; // Contract address who can call
  calls: OutsideCall[]; // Array of calls
  execute_after: number; // Execution start time
  execute_before: number; // Execution end time
  nonce: string; // Unique identifier
  signature: TraderSignature; // List of integers for the signature, min size 2, max size 100
  signer_address: string; // Address of the signer
  version: string; // Version of snip12, v1, v2
}

/**
 * Represents a user order on the LayerAkira exchange
 */
export interface Order {
  maker: Address;
  price: bigint; // The price of the order. serves as protection price, not fillable if violates that
  qty: Quantity; // The quantity of the order.
  ticker: TradedPair;
  fee: OrderFee;
  constraints: Constraints;
  salt: bigint;
  flags: OrderFlags;
  source: string; // from where order
  sign_scheme: SignScheme;
  snip9_call?: ExecuteOutsideCall;
}

/**
 * Represents an extended order with additional state information.
 */
export interface ExtendedOrder extends Order {
  state: OrderStateInfo;
}

/**
 * Represents a reduced order with minimal information.
 */
export interface ReducedOrder {
  maker: Address;
  hash: string;
  state: OrderStateInfo;
  price: bigint;
  ticker: TradedPair;
  qty: Quantity;
  order_flags: OrderFlags;
  stp: STPMode;
  expiration_time: OrderTimestamp;
  source: string;
  created_at: OrderTimestamp;
  taker_match_result: MatchingEngineResult;
}

/**
 * Represents a request to cancel an order. Off-chain, do not incur any fees
 */
export interface CancelRequest {
  maker: Address;
  order_hash: string | null;
  salt: bigint;
  ticker?: ExchangeTicker;
}

/**
 * Represents a request to increase the nonce. On-chain, incur gas fees
 */
export interface IncreaseNonce {
  maker: Address;
  new_nonce: number;
  gas_fee: GasFee;
  salt: bigint;
  sign_scheme: SignScheme;
}

/**
 * Represents a request to withdraw funds.
 */
export interface Withdraw {
  maker: Address;
  token: ERC20Token;
  amount: bigint;
  salt: bigint;
  gas_fee: GasFee;
  receiver: Address;
  sign_scheme: SignScheme;
}

/**
 * Represents a mapping of ERC20 tokens to their addresses.
 */
export type TokenAddressMap = {
  [token: ERC20Token]: string;
};

/**
 * Represents a mapping of ERC20 tokens to decimals.
 */
export type ERCToDecimalsMap = {
  [token: ERC20Token]: number;
};
