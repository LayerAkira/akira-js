import { TableLevel } from "@/response_types.ts";
import { ERC20Token, FixedFee, GasFee } from "@/request_types.ts";

function ceilDivide(dividend: bigint, divisor: bigint): bigint {
  // Perform division and add 1 to round up if there is any remainder
  return dividend % divisor === 0n
    ? dividend / divisor
    : dividend / divisor + 1n;
}

/**
 * Calculate how much base tokens needed to perform the swap given bids/asks book
 * remaining amount of quote tokens that needs to be fulfilled.
 * @param bookSide List of price levels, total volume at that level, and number of orders.
 * @param remainingFillAmountQuote Remaining amount of quote tokens to be fulfilled.
 * @param baseAsset1Qty Quantity of the base asset representing 1 unit (default is 10^18).
 * @returns Base amount of tokens necessary to run this trade and the approximate number of trades and protection price
 */
export function intentQuoteForBaseAsset(
  bookSide: TableLevel[],
  remainingFillAmountQuote: bigint,
  baseAsset1Qty: bigint = 10n ** 18n,
): [bigint, number, bigint] {
  let totalReceiveToken = 0n;
  let approxTrades = 0;
  let lastLevel = 0n;
  for (const lvl of bookSide) {
    lastLevel = lvl.price;
    const volumeInQuoteAsset = (lvl.price * lvl.volume) / baseAsset1Qty;
    if (volumeInQuoteAsset <= remainingFillAmountQuote) {
      totalReceiveToken += lvl.volume;
      approxTrades += lvl.orders;
    } else {
      const trades = ceilDivide(
        BigInt(lvl.orders) * remainingFillAmountQuote,
        volumeInQuoteAsset,
      );
      totalReceiveToken +=
        (remainingFillAmountQuote * baseAsset1Qty) / lvl.price;
      approxTrades += Number(trades);
    }
    remainingFillAmountQuote -= volumeInQuoteAsset;
    if (remainingFillAmountQuote <= 0) break;
  }
  return [totalReceiveToken, approxTrades, lastLevel];
}

/**
 * Calculate how much quote tokens are needed to perform the swap given bids/asks book
 * and the remaining amount of base tokens that needs to be fulfilled.
 * @param bookSide List of tuples containing price, total volume, and number of orders.
 * @param remainingFillAmountEth Remaining amount of base tokens to fulfill.
 * @param baseAssetQty Quantity of the base asset (default is 1).
 * @returns Quote amount of tokens necessary to run this trade and the number of trades that would happen approximately and protection price
 */
export function intentBaseForQuoteAsset(
  bookSide: TableLevel[],
  remainingFillAmountEth: bigint,
  baseAssetQty: bigint = 10n ** 18n,
): [bigint, number, bigint] {
  let totalReceiveToken = 0n;
  let approxTrades = 0;
  let lastLvl = 0n;

  for (const lvl of bookSide) {
    lastLvl = lvl.price;
    if (lvl.volume <= remainingFillAmountEth) {
      totalReceiveToken += (lvl.price * lvl.volume) / baseAssetQty;
      approxTrades += lvl.orders;
    } else {
      const trades = ceilDivide(
        BigInt(lvl.orders) * remainingFillAmountEth,
        lvl.volume,
      );
      totalReceiveToken += (remainingFillAmountEth * lvl.price) / baseAssetQty;
      approxTrades += Number(trades);
    }

    remainingFillAmountEth -= lvl.volume;
    if (remainingFillAmountEth <= 0) break;
  }

  return [totalReceiveToken, approxTrades, lastLvl];
}

/**
 * Refers to Sell Order.
 * Intent: user want to know how much he needs to sell base tokens to receive quoteAmount tokens
 * @param bids List of bid price levels, total volume at each level, and number of orders.
 * @param quoteAmount Amount of quote tokens to be fulfilled.
 * @param baseAssetQty Quantity of the base asset representing 1 unit (default is 10^18).
 * @returns Base amount of tokens necessary to run this trade, approximate number of trades, and protection price.
 */
export function getInBaseForOutQuote(
  bids: TableLevel[],
  quoteAmount: bigint,
  baseAssetQty: bigint = 10n ** 18n,
) {
  return intentQuoteForBaseAsset(bids, quoteAmount, baseAssetQty);
}

/**
 * Refers to Buy Order
 * Intent: user want to know how much he would receive if he spends quoteAmount tokens
 * @param asks List of ask price levels, total volume at each level, and number of orders.
 * @param quoteAmount Amount of quote tokens user spending.
 * @param baseAssetQty Quantity of the base asset representing 1 unit (default is 10^18).
 * @returns Quote amount of tokens necessary to run this trade, approximate number of trades, and protection price.
 */
export function getOutBaseForInQuote(
  asks: TableLevel[],
  quoteAmount: bigint,
  baseAssetQty: bigint = 10n ** 18n,
) {
  return intentQuoteForBaseAsset(asks, quoteAmount, baseAssetQty);
}

/**
 * Refers to Buy Order
 * Intent: user want to know how much he needs to spend quote tokens if he receives baseAmount tokens
 * @param asks List of ask price levels, total volume at each level, and number of orders.
 * @param baseAmount Amount of base tokens to be fulfilled.
 * @param baseAssetQty Quantity of the base asset representing 1 unit (default is 10^18).
 * @returns Quote amount of tokens necessary to run this trade, approximate number of trades, and protection price.
 */
export function getInQuoteForOutBase(
  asks: TableLevel[],
  baseAmount: bigint,
  baseAssetQty: bigint = 10n ** 18n,
) {
  return intentBaseForQuoteAsset(asks, baseAmount, baseAssetQty);
}

/**
 * Refers to Sell Order
 * Intent: user wants to know how much quote tokens he would receive if he spends baseAmount of tokens
 * @param bids List of bid price levels, total volume at each level, and number of orders.
 * @param baseAmount Amount of base tokens to be fulfilled.
 * @param baseAssetQty Quantity of the base asset representing 1 unit (default is 10^18).
 * @returns Base amount of tokens necessary to run this trade, approximate number of trades, and protection price.
 */
export function getOutQuoteForInBase(
  bids: TableLevel[],
  baseAmount: bigint,
  baseAssetQty: bigint = 10n ** 18n,
) {
  return intentBaseForQuoteAsset(bids, baseAmount, baseAssetQty);
}

/**
 * Calculates the gas fee for a single trade.
 * @param gasFee The gas fee object containing gas-related parameters.
 * @param actualGasPrice if specified used for infer fee else would be use upper value specified in gas fee
 * @returns The gas fee amount as a tuple containing the fee token and the calculated fee.
 */
export function calcSingleTradeGasFee(
  gasFee: GasFee,
  actualGasPrice?: bigint,
): [ERC20Token, bigint] {
  const gasPrice = actualGasPrice ?? gasFee.max_gas_price;
  const fee = BigInt(gasFee.gas_per_action) * gasPrice;
  return [
    gasFee.fee_token,
    (fee * gasFee.conversion_rate[1]) / gasFee.conversion_rate[0],
  ];
}

/**
 * Calculates the fixed swap fee.
 * @param fee The fixed fee object containing fee-related parameters.
 * @param totalAmountReceive The total amount received.
 * @param asTaker A boolean indicating whether the fee should be calculated as a taker fee.
 * @returns The calculated fixed swap fee.
 */
export function calcFixedSwapFee(
  fee: FixedFee,
  totalAmountReceive: bigint,
  asTaker: boolean,
) {
  const pBips = BigInt(asTaker ? fee.taker_pbips : fee.maker_pbips);
  if (pBips == 0n) return 0n;
  return (totalAmountReceive * pBips - 1n) / BigInt(100 * 100 * 100) + 1n;
}