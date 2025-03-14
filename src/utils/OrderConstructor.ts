import { Address } from "../types";
import { NULL_ADDRESS } from "../constants";
import {
  Constraints,
  ERC20Token,
  MinimalTakerOrderInfo,
  Order,
  OrderFee,
  OrderSide,
  Quantity,
  SignScheme,
  SorContext,
  STPMode,
  TradedPair,
} from "../request_types";
import { ExchangeTicker } from "../api";
import { getEpochSeconds } from "../api/websocket/utils";
import { TickerFeeMap } from "./TickerFeeMap";
import { generateRandomSalt } from "./utils";

/**
 * Helper class for constructing orders with various configurations.
 */
export class OrderConstructor {
  public readonly trader: Address;
  public readonly routerSigner: Address;
  public readonly traderNonce: number;
  public readonly exchangeFeeRecipient: Address;
  public readonly ecosystemGasSteps: number;
  public readonly routerGasSteps: number;
  public readonly nativeGasFeeToken: Address;

  private readonly exchangeFeeMap: TickerFeeMap;
  private readonly routerFeeMap: TickerFeeMap;
  private readonly routerFeeRecipient: Address;
  private source: string;
  private signScheme: SignScheme;

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
   * @param sign_scheme
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
    sign_scheme: SignScheme = SignScheme.ECDSA,
  ) {
    this.trader = trader;
    this.routerSigner = routerSigner;
    this.traderNonce = traderNonce;
    this.exchangeFeeMap = exchangeFeeMap;
    this.routerFeeMap = routerFeeMap;
    this.exchangeFeeRecipient = exchangeFeeRecipient;
    this.routerFeeRecipient = routerFeeRecipient;
    this.ecosystemGasSteps = ecosystemGasSteps;
    this.routerGasSteps = routerGasSteps;
    this.nativeGasFeeToken = nativeGasFeeToken;
    this.source = source;
    this.signScheme = sign_scheme;
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
   * @param gasFeeToken token in which trader decided to pay for gas
   * @param conversionRate the rate [base gas, gasFeeToken]
   * @param durationValid The validity duration of the order.
   * @param traderNonce The nonce of the trader (optional). if not specified default from constructor would be used
   * @param signScheme
   * @param trader
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
    gasFeeToken?: string,
    conversionRate?: [bigint, bigint],
    durationValid: number = 365 * 24 * 60 * 60,
    traderNonce?: number,
    signScheme?: SignScheme,
    trader?: Address,
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
      true,
      false,
      false,
      false,
      minReceiveAmount,
      durationValid,
      traderNonce,
      gasFeeToken,
      conversionRate,
      STPMode.NONE,
      signScheme,
      trader,
      undefined,
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
   * @param signScheme
   * @param trader
   * @returns The constructed order.
   */
  public buildSimpleRestingOrder(
    ticker: ExchangeTicker,
    limitPrice: bigint,
    qty: Quantity,
    side: OrderSide,
    durationValid: number = 365 * 24 * 60 * 60,
    traderNonce?: number,
    signScheme?: SignScheme,
    trader?: Address,
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
      true,
      false,
      false,
      0n,
      durationValid,
      traderNonce,
      this.nativeGasFeeToken,
      [1n, 1n],
      STPMode.NONE,
      signScheme,
      trader,
      undefined,
    );
  }

  /**
   * Builds a simple  sor router swap order.
   * @param subPath
   * @param pair The traded pair for the swap.
   * @param price The protection price of the swap.
   * @param qty The quantity of the swap.
   * @param numberOfSwapsAllowed The number of swaps allowed.
   * @param side The side of the order (BUY or SELL).
   * @param gasPriceInChainToken The gas price in the chain token.
   * @param externalFunds Indicates if funds for the trades are taken externally or from LayerAkira smart contract.
   * @param minReceiveAmount The minimum receive amount for the swap. aka slippage
   * @param gasFeeToken token in which trader decided to pay for gas
   * @param conversionRate the rate [base gas, gasFeeToken]
   * @param durationValid The validity duration of the order.
   * @param traderNonce The nonce of the trader (optional). if not specified default from constructor would be used
   * @param signScheme
   * @param trader
   * @param lastQty
   * @param maxSpendAmount
   * @param fixedFeesToReceiptAmount
   * @param allowNonAtomic
   * @returns The constructed order.
   */
  public buildSORRouterSwap(
    subPath: MinimalTakerOrderInfo[],
    pair: TradedPair,
    price: bigint,
    qty: Quantity,
    numberOfSwapsAllowed: number,
    side: OrderSide,
    gasPriceInChainToken: bigint,
    externalFunds: boolean,
    minReceiveAmount?: bigint,
    gasFeeToken?: string,
    conversionRate?: [bigint, bigint],
    durationValid: number = 365 * 24 * 60 * 60,
    traderNonce?: number,
    signScheme?: SignScheme,
    trader?: Address,
    lastQty?: Quantity,
    maxSpendAmount?: bigint,
    fixedFeesToReceiptAmount: boolean = true,
    allowNonAtomic: boolean = false,
  ) {
    const ticker = {
      pair: pair,
      isEcosystemBook: false,
    };

    let fees = this.buildFees(
      ticker,
      fixedFeesToReceiptAmount,
      gasPriceInChainToken,
      gasFeeToken,
      conversionRate,
    );

    const sorCtx: SorContext = {
      last_base_qty: lastQty?.base_qty ?? 0n,
      last_quote_qty: lastQty?.quote_qty ?? 0n,
      order_fee: fees,
      allow_non_atomic: allowNonAtomic,
      path: subPath,
      min_receive_amount: minReceiveAmount,
      max_spend_amount: maxSpendAmount,
    };

    const fullFillOnly = maxSpendAmount === undefined || maxSpendAmount == 0n;
    return this.buildOrder(
      ticker,
      price,
      qty,
      numberOfSwapsAllowed,
      side,
      gasPriceInChainToken,
      externalFunds,
      true,
      fixedFeesToReceiptAmount,
      false,
      false,
      fullFillOnly,
      0n,
      durationValid,
      traderNonce,
      gasFeeToken,
      conversionRate,
      STPMode.NONE,
      signScheme,
      trader,
      sorCtx,
      this.buildFees(
        ticker,
        fixedFeesToReceiptAmount,
        gasPriceInChainToken,
        gasFeeToken,
        conversionRate,
        0,
        0,
        0,
        0,
      ),
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
   * @param apply_to_receipt_amount
   * @param postOnly Indicates if the order is post-only.
   * @param bestLevelOnly Indicates if only  can be filled on the best level.
   * @param fullFillOnly Indicates if either fulfill happens or order became invalid
   * @param minReceiveAmount The minimum receive amount for the order, valid only for router taker.
   * @param durationValid The validity duration of the order.
   * @param traderNonce The nonce of the trader (optional). if not specified default from constructor would be used* @param gasFeeToken The gas fee token for the order.
   * @param gasFeeToken can be specified non-native token
   * @param conversionRate The conversion rate for the gas fee token if used non-native one.
   * @param stp The STP mode for the order.
   * @param signScheme
   * @param trader
   * @param sorCtx
   * @param orderFee
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
    apply_to_receipt_amount = true,
    postOnly: boolean = false,
    bestLevelOnly: boolean = false,
    fullFillOnly: boolean = false,
    minReceiveAmount: bigint = 0n,
    durationValid: number = 60 * 5,
    traderNonce?: number,
    gasFeeToken?: ERC20Token,
    conversionRate?: [bigint, bigint],
    stp?: STPMode,
    signScheme?: SignScheme,
    trader?: Address,
    sorCtx?: SorContext,
    orderFee?: OrderFee,
  ): Order {
    let order: Order = {
      constraints: this.buildConstraints(
        minReceiveAmount,
        numberOfSwapsAllowed,
        durationValid,
        traderNonce,
        stp,
      ),
      fee:
        orderFee ??
        this.buildFees(
          ticker,
          apply_to_receipt_amount,
          gasPriceInChainToken,
          gasFeeToken,
          conversionRate,
        ),
      flags: {
        full_fill_only: fullFillOnly,
        best_level_only: bestLevelOnly,
        post_only: postOnly,
        is_sell_side: side == OrderSide.SELL,
        is_market_order: isMarketOrder,
        to_ecosystem_book: ticker.isEcosystemBook,
        external_funds: externalFunds,
      },
      maker: trader ?? this.trader,
      price: price,
      qty: qty,
      salt: generateRandomSalt(),
      ticker: ticker.pair,
      source: this.source,
      sign_scheme: signScheme ?? this.signScheme,
    };
    if (sorCtx !== undefined) order.sor = sorCtx;
    return order;
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
  private buildFees(
    ticker: ExchangeTicker,
    apply_to_receipt_amount: boolean,
    gasPriceInChainToken: bigint,
    gasFeeToken?: ERC20Token,
    conversionRate?: [bigint, bigint],
    exchange_pbips_taker?: number,
    exchange_pbips_maker?: number,
    router_pbips_taker?: number,
    router_pbips_maker?: number,
  ) {
    return {
      trade_fee: {
        recipient: this.exchangeFeeRecipient,
        maker_pbips: exchange_pbips_maker ?? this.exchangeFeeMap.get(ticker)[0],
        taker_pbips: exchange_pbips_taker ?? this.exchangeFeeMap.get(ticker)[1],
        apply_to_receipt_amount: apply_to_receipt_amount,
      },
      router_fee: {
        recipient: this.routerFeeRecipient,
        maker_pbips: router_pbips_maker ?? this.routerFeeMap.get(ticker)[0],
        taker_pbips: router_pbips_taker ?? this.routerFeeMap.get(ticker)[1],
        apply_to_receipt_amount: apply_to_receipt_amount,
      },
      gas_fee: {
        gas_per_action: ticker.isEcosystemBook
          ? this.ecosystemGasSteps
          : this.routerGasSteps,
        fee_token: gasFeeToken ?? this.nativeGasFeeToken,
        max_gas_price: gasPriceInChainToken,
        conversion_rate: conversionRate ?? [1n, 1n],
      },
    };
  }
}
