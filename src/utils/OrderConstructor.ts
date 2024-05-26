import { Address } from "@/types.ts";
import { NULL_ADDRESS } from "@/constants.ts";
import {
  Constraints,
  ERC20Token,
  Order,
  OrderSide,
  Quantity,
  STPMode,
  TradedPair,
} from "@/request_types.ts";
import { ExchangeTicker } from "@/api";
import { getEpochSeconds } from "@/api/websocket/utils.ts";
import { TickerFeeMap } from "@/utils/TickerFeeMap.ts";
import { generateRandomSalt } from "@/utils/utils.ts";

/**
 * Helper class for constructing orders with various configurations.
 */
export class OrderConstructor {
  public readonly trader: Address;
  public readonly routerSigner: Address;
  public readonly traderNonce: number;
  public readonly exchangeFeeRecipient: Address;

  private readonly exchangeFeeMap: TickerFeeMap;
  private readonly routerFeeMap: TickerFeeMap;
  private readonly orderVersion: number;
  private readonly routerFeeRecipient: Address;
  private readonly ecosystemGasSteps: number;
  private readonly routerGasSteps: number;
  private readonly nativeGasFeeToken: Address;
  private source: string;

  /**
   * Creates an instance of OrderConstructor.
   * @param trader The address of the trader.
   * @param traderNonce The nonce of the trader.
   * @param exchangeFeeMap The map containing exchange fees.
   * @param exchangeFeeRecipient The address of the exchange fee recipient.
   * @param ecosystemGasSteps The number of gas steps for ecosystem trades.
   * @param routerGasSteps The number of gas steps for router trades.
   * @param nativeGasFeeToken The erc20 gas fee token native one
   * @param source source of order eg layerakira
   * @param routerFeeMap The map containing router fees (default is an empty map).
   * @param routerSigner The address of the router signer (default is NULL_ADDRESS).
   * @param routerFeeRecipient The address of the router fee recipient (default is NULL_ADDRESS).
   * @param orderVersion The version of the order (default is 0).
   */
  constructor(
    trader: Address,
    traderNonce: number,
    exchangeFeeMap: TickerFeeMap,
    exchangeFeeRecipient: Address,
    ecosystemGasSteps: number,
    routerGasSteps: number,
    nativeGasFeeToken: ERC20Token,
    source: string = "layerakira",
    routerFeeMap: TickerFeeMap = new TickerFeeMap([0, 0]),
    routerSigner: Address = NULL_ADDRESS,
    routerFeeRecipient: Address = NULL_ADDRESS,
    orderVersion: number = 0,
  ) {
    this.trader = trader;
    this.routerSigner = routerSigner;
    this.orderVersion = orderVersion;
    this.traderNonce = traderNonce;
    this.exchangeFeeMap = exchangeFeeMap;
    this.routerFeeMap = routerFeeMap;
    this.exchangeFeeRecipient = exchangeFeeRecipient;
    this.routerFeeRecipient = routerFeeRecipient;
    this.ecosystemGasSteps = ecosystemGasSteps;
    this.routerGasSteps = routerGasSteps;
    this.nativeGasFeeToken = nativeGasFeeToken;
    this.source = source;
  }

  /**
   * Builds a simple router swap order.
   * @param pair The traded pair for the swap.
   * @param price The protection price of the swap.
   * @param qty The quantity of the swap.
   * @param numberOfSwapsAllowed The number of swaps allowed.
   * @param side The side of the order (BUY or SELL).
   * @param gasPriceInChainToken The gas price in the chain token.
   * @param externalFunds Indicates if funds for the trades are taken externally or from LayerAkira smart contract.
   * @param minReceiveAmount The minimum receive amount for the swap. aka slippage
   * @param durationValid The validity duration of the order.
   * @param traderNonce The nonce of the trader (optional). if not specified default from constructor would be used
   * @returns The constructed order.
   */
  public buildSimpleRouterSwap(
    pair: TradedPair,
    price: bigint,
    qty: Quantity,
    numberOfSwapsAllowed: number,
    side: OrderSide,
    gasPriceInChainToken: bigint,
    externalFunds: boolean,
    minReceiveAmount: bigint,
    durationValid: number = 365 * 24 * 60 * 60,
    traderNonce?: number,
  ) {
    return this.buildOrder(
      {
        pair: pair,
        isEcosystemBook: false,
      },
      price,
      qty,
      numberOfSwapsAllowed,
      side,
      gasPriceInChainToken,
      externalFunds,
      true,
      false,
      false,
      false,
      minReceiveAmount,
      durationValid,
      traderNonce,
      this.nativeGasFeeToken,
      [1n, 1n],
      STPMode.NONE,
    );
  }

  /**
   * Builds a simple resting post only order.
   * @param ticker The ticker for the order.
   * @param limitPrice The limit price of the order.
   * @param qty The quantity of the order.
   * @param side The side of the order (BUY or SELL).
   * @param durationValid The validity duration of the order.
   * @param traderNonce The nonce of the trader (optional). if not specified default from constructor would be used
   * @returns The constructed order.
   */
  public buildSimpleRestingOrder(
    ticker: ExchangeTicker,
    limitPrice: bigint,
    qty: Quantity,
    side: OrderSide,
    durationValid: number = 365 * 24 * 60 * 60,
    traderNonce?: number,
  ) {
    return this.buildOrder(
      ticker,
      limitPrice,
      qty,
      0,
      side,
      0n,
      false,
      false,
      true,
      false,
      false,
      0n,
      durationValid,
      traderNonce,
      this.nativeGasFeeToken,
      [1n, 1n],
      STPMode.NONE,
    );
  }

  /**
   * Builds an order with the specified parameters.
   * @param ticker The ticker for the order.
   * @param price The price of the order/protection price.
   * @param qty The quantity of the order.
   * @param numberOfSwapsAllowed The number of swaps allowed.
   * @param side The side of the order (BUY or SELL).
   * @param gasPriceInChainToken The gas price in the chain token.
   * @param externalFunds Indicates if external funds are involved.
   * @param isMarketOrder Indicates if the order is a market order.
   * @param postOnly Indicates if the order is post-only.
   * @param bestLevelOnly Indicates if only  can be filled on the best level.
   * @param fullFillOnly Indicates if either fulfill happens or order became invalid
   * @param minReceiveAmount The minimum receive amount for the order, valid only for router taker.
   * @param durationValid The validity duration of the order.
   * @param traderNonce The nonce of the trader (optional). if not specified default from constructor would be used* @param gasFeeToken The gas fee token for the order.
   * @param gasFeeToken can be specified non-native token
   * @param conversionRate The conversion rate for the gas fee token if used non-native one.
   * @param stp The STP mode for the order.
   * @returns The constructed order.
   */
  public buildOrder(
    ticker: ExchangeTicker,
    price: bigint,
    qty: Quantity,
    numberOfSwapsAllowed: number,
    side: OrderSide,
    gasPriceInChainToken: bigint,
    externalFunds: boolean,
    isMarketOrder: boolean,
    postOnly: boolean = false,
    bestLevelOnly: boolean = false,
    fullFillOnly: boolean = false,
    minReceiveAmount: bigint = 0n,
    durationValid: number = 60 * 5,
    traderNonce?: number,
    gasFeeToken?: ERC20Token,
    conversionRate?: [bigint, bigint],
    stp?: STPMode,
  ): Order {
    return {
      constraints: this.buildConstraints(
        minReceiveAmount,
        numberOfSwapsAllowed,
        durationValid,
        traderNonce,
        stp,
      ),
      fee: {
        trade_fee: {
          recipient: this.exchangeFeeRecipient,
          maker_pbips: this.exchangeFeeMap.get(ticker)[0],
          taker_pbips: this.exchangeFeeMap.get(ticker)[1],
        },
        router_fee: {
          recipient: this.routerFeeRecipient,
          maker_pbips: this.routerFeeMap.get(ticker)[0],
          taker_pbips: this.routerFeeMap.get(ticker)[1],
        },
        gas_fee: {
          gas_per_action: ticker.isEcosystemBook
            ? this.ecosystemGasSteps
            : this.routerGasSteps,
          fee_token: gasFeeToken ?? this.nativeGasFeeToken,
          max_gas_price: gasPriceInChainToken,
          conversion_rate: conversionRate ?? [1n, 1n],
        },
      },
      flags: {
        full_fill_only: fullFillOnly,
        best_level_only: bestLevelOnly,
        post_only: postOnly,
        is_sell_side: side == OrderSide.SELL,
        is_market_order: isMarketOrder,
        to_ecosystem_book: ticker.isEcosystemBook,
        external_funds: externalFunds,
      },
      maker: this.trader,
      price: price,
      qty: qty,
      salt: generateRandomSalt(),
      ticker: ticker.pair,
      version: this.orderVersion,
      source: this.source,
    };
  }

  private buildConstraints(
    minReceiveAmount: bigint,
    numberOfSwapsAllowed: number,
    durationValid: number = 60 * 5,
    traderNonce?: number,
    stp?: STPMode,
  ): Constraints {
    return {
      number_of_swaps_allowed: numberOfSwapsAllowed,
      duration_valid: durationValid,
      created_at: getEpochSeconds(),
      stp: stp ?? STPMode.NONE,
      nonce: traderNonce ?? this.traderNonce,
      min_receive_amount: minReceiveAmount,
      router_signer: this.routerSigner,
    };
  }
}
