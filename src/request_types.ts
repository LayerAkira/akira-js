import {BigNumberish} from "ethers";
import {Address, OrderTimestamp} from "./general_types";

export enum OrderStatus {
    ACCEPTED = 'ACC',  // order accepted by the exchange
    OPEN = 'OPEN',  // order successfully inserted to the book
    SCHEDULED_CANCEL = 'SCHEDULED_TO_CANCEL',  // order scheduled to be cancelled
    CANCELLED = 'CANCELLED',  // order was successfully cancelled and removed from the order book
    PARTIALLY_FILLED = 'PARTIALLY_FILLED',  // order was partially filled
    FILLED = 'FILLED',  // order was fully filled
    CLOSED = 'CLOSED',  // order was closed (in case of taker orders)
    FAILED_ROLLUP = 'FAILED_ROLLUP',  // part of order was failed due some issue, used in reports only
    REIMBURSE = 'REIMBURSE',  // part of order was failed due some issue, used in reports only
    NOT_PROCESSED = 'NOT_PROCESSED',
    EXPIRED = 'EXPIRED',  // order expired
}

// ticker symbol like ETH, STRK
export type ERC20Token = string;


export interface Quantity {
    base_qty: BigNumberish;   // quantity in base asset raw amount
    quote_qty: BigNumberish;  // quantity in quote asset raw amount
    base_asset: BigNumberish; // raw amount of base asset representing 1, eg 1 eth is 10**18
}


enum Side {
    BUY = 0,
    SELL = 1
}

export enum OrderType {
    LIMIT = 0,
    MARKET = 1
}

interface OrderFlags {
    full_fill_only: boolean;
    best_level_only: boolean;
    post_only: boolean;
    is_sell_side: boolean;
    is_market_order: boolean;
    to_ecosystem_book: boolean;
    external_funds: boolean;
}


export enum STPMode {
    NONE = 0,
    EXPIRE_TAKER = 1,
    EXPIRE_MAKER = 2,
    EXPIRE_BOTH = 3
}


export interface TradedPair {
    base: ERC20Token;
    quote: ERC20Token;
}


export interface Constraints {
    number_of_swaps_allowed: number;
    duration_valid: number;
    created_at: OrderTimestamp;
    stp: STPMode;
    nonce: number;
    min_receive_amount: BigNumberish;
    router_signer: Address;
}

export interface FixedFee {
    recipient: Address;
    maker_pbips: number;
    taker_pbips: number;
}

export interface GasFee {
    gas_per_action: number;
    fee_token: ERC20Token;
    max_gas_price: BigNumberish;
    conversion_rate: [BigNumberish, BigNumberish];  // conversion rate to
}

export interface OrderFee {
    trade_fee: FixedFee;
    router_fee: FixedFee;
    gas_fee: GasFee;
}


export interface OrderStateInfo {
    filled_base_amount: BigNumberish
    filled_quote_amount: BigNumberish
    cur_number_of_swaps: BigNumberish
    status: OrderStatus
    limit_price: BigNumberish | undefined
}


export interface Order {
    maker: Address;
    price: BigNumberish;
    qty: Quantity;
    ticker: TradedPair;
    fee: OrderFee;
    constraints: Constraints;
    salt: BigNumberish;
    flags: OrderFlags;
    version: number;
    // get side(): Side {
    //     return this.flags.isSellSide ? Side.SELL : Side.BUY;
    // }
    //
    // get type(): OrderType {
    //     return this.flags.isMarketOrder ? OrderType.MARKET : OrderType.LIMIT;
    // }

}


export interface ExtendedOrder extends Order {
    state: OrderStateInfo;
}


export interface ReducedOrder {
    maker: Address
    hash: string
    state: OrderStateInfo
    price: BigNumberish
    ticker: TradedPair
    qty: Quantity
    order_flags: OrderFlags
    stp: STPMode
    expiration_time: OrderTimestamp
}


export interface CancelRequest {
    maker: Address;
    order_hash: string | null;
    salt: BigNumberish;
}

export interface IncreaseNonce {
    maker: Address;
    new_nonce: number;
    gas_fee: GasFee;
    salt: BigNumberish;
}

export interface Withdraw {
    maker: Address;
    token: ERC20Token;
    amount: BigNumberish;
    salt: BigNumberish;
    gas_fee: GasFee;
    receiver: Address;
}