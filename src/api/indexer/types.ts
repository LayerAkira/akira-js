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
  amount: bigint;
  event_idx: number;
  tx_index: number | null;
  event_block: number | null;
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
  amount: bigint;
  spent_gas: string;
  gas_token: ERC20Token;
  direct: boolean;
  event_block: number | null;
  tx_index: number | null;
  event_idx: number;
  exchange_address: Address;
}
