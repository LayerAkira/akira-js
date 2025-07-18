import { ERC20Token } from "../../request_types";
import { Address } from "../../types";

export interface DbTrade {
  maker: Address;
  taker: Address;
  ticker: [ERC20Token, ERC20Token];
  router_maker: Address;
  router_taker: Address;
  amount_base: string;
  amount_quote: string;
  is_failed: boolean;
  is_ecosystem_book: boolean;
  taker_source: string;
  maker_source: string;
  maker_hash: Address;
  taker_hash: Address;
  event_block: number | null;
  tx_index: number | null;
  tx_hash: string;
  event_idx: number;
  usd_volume: string;
  exchange_address: string;
  is_sell: boolean;
}

export interface DbRollup {
  apply_steps: {
    nonce_steps: number;
    withdraw_steps: number;
    router_steps: number;
    ecosystem_steps: number;
    gas_price: string;
  };
  tx_hash: string;
  tx_index: number | null;
  block_number: number | null;
  exchange_address: string;
  spent_on_gas: string;
  db_id: string | null;
  is_pending: boolean;
  trades_count: number;
  takers_count: number;
  makers_count: number;
  rollup_index: number;
}

export interface SorClosure {
  dependent_orders: string[]; // sor orders in path excluding lead order
  received: string; //received in last order
  received_asset: ERC20Token; //  # received last asset
  paid_gas: string; // paid  in sor excluding
  paid_as_taker_router: string; // paid  in sor excluding lead
  paid_as_taker_exchange: string; //  # paid  in sor excluding lead
  trades_as_taker: number; //   in sor excluding lead
  failed_trades_as_taker: number; // in sor excluding lead
  gas_token: ERC20Token; // in sor excluding lead
  fixed_fee_token: ERC20Token; // in sor excluding lead
}

export interface DbOrder {
  order_hash: string;
  maker: Address;
  price: string;
  qty_base: string;
  qty_quote: string;
  is_sell_side: boolean;
  post_only: boolean;
  best_level_only: boolean;
  full_fill_only: boolean;
  is_market_order: boolean;
  to_ecosystem_book: boolean;
  external_funds: boolean;
  source: string;
  number_of_swaps_allowed: number;
  duration_valid: number;
  created_at: number;
  min_received: string;
  exchange_address: string;
  spent: string;
  received: string;
  paid_gas: string;
  gas_token: string;
  paid_as_maker_router: string;
  paid_as_taker_router: string;
  paid_as_maker_exchange: string;
  paid_as_taker_exchange: string;
  fixed_fee_token: string;
  trades_as_taker: number;
  trades_as_maker: number;
  tx_hash: string;
  base_asset: string;
  quote_asset: string;
  failed_trades_as_taker: number;
  failed_trades_as_maker: number;
  lead_order: string;
  previous_order: string;
  sor: SorClosure;
}

export interface TraderVolume {
  trader: Address;
  total_usd_traded_vol: number;
  total_trades: number;
  total_orders: number;
}

export interface DbDeposit {
  tx_hash: string;
  receiver: Address;
  token_address: Address;
  funder: Address;
  amount: string;
  event_idx: number;
  tx_index: number | null;
  event_block: number | null;
  event_time: number | null; // in seconds
}

/**
 * Interface for withdrawal data.
 */
export interface DbWithdrawal {
  tx_hash: string;
  maker: Address;
  token_address: Address;
  receiver: Address;
  salt: string;
  amount: string;
  spent_gas: string;
  gas_token: ERC20Token;
  direct: boolean;
  event_block: number | null;
  tx_index: number | null;
  event_idx: number;
  exchange_address: Address;
  event_time: number | null; // in seconds
}

export interface DbKline {
  time: number; // in milliseconds; end of interval
  open: string; // open px in interval
  high: string; // high px in interval
  low: string; // low px  in interval
  close: string; // close px in interval
  volume: string; // total volume in base asset in interval
  trades: number; // total trades in interval
  buy_volume: string; // total base volume for taker buyers in interval
  buy_quote_volume: string; // total quote volume for taker in interval
  start_time: number; // in mills; start of interval
}

export interface MarketStat {
  market: {
    base: ERC20Token;
    quote: ERC20Token;
    is_ecosystem_book: boolean;
  };
  quote_volume: string;
  change: string;
  low: string;
  high: string;
}
