import { Snapshot, TableLevel, TickerSpecification } from "../response_types";
import { ERC20Token, FixedFee, GasFee, Quantity } from "../request_types";

function ceilDivide(dividend: bigint, divisor: bigint): bigint {
  // Perform division and add 1 to round up if there is any remainder
  return dividend % divisor === 0n
    ? dividend / divisor
    : dividend / divisor + 1n;
}
function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/**
 * Calculate how much base tokens needed to perform the swap given bids/asks book
 * remaining amount of quote tokens that needs to be fulfilled.
 * @param bookSide List of price levels, total volume at that level, and number of orders.
 * @param remainingFillAmountQuote Remaining amount of quote tokens to be fulfilled.
 * @param baseAsset1Qty Quantity of the base asset representing 1 unit (default is 10^18).
 * @param minTradedQty in base asset
 * @returns Base amount of tokens necessary to run this trade and the approximate number of trades and protection price, and remaining amount of quote tokens
 */
export function intentQuoteForBaseAsset(
  bookSide: TableLevel[],
  remainingFillAmountQuote: bigint,
  baseAsset1Qty: bigint = 10n ** 18n,
  minTradedQty: bigint = 1n,
): [bigint, number, bigint, bigint] {
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
      //TODO: real issue how to make good approximation?
      const trades = min(
        ceilDivide(lvl.volume, minTradedQty),
        BigInt(lvl.orders),
      );
      totalReceiveToken +=
        (remainingFillAmountQuote * baseAsset1Qty) / lvl.price;
      approxTrades += Number(trades);
    }
    remainingFillAmountQuote -= volumeInQuoteAsset;
    if (remainingFillAmountQuote <= 0) break;
  }
  return [
    totalReceiveToken,
    approxTrades,
    lastLevel,
    remainingFillAmountQuote < 0n ? 0n : remainingFillAmountQuote,
  ];
}

/**
 * Calculate how much quote tokens are needed to perform the swap given bids/asks book
 * and the remaining amount of base tokens that needs to be fulfilled.
 * @param bookSide List of tuples containing price, total volume, and number of orders.
 * @param remainingFillAmountEth Remaining amount of base tokens to fulfill.
 * @param baseAssetQty Quantity of the base asset (default is 1).
 * @param minTradedQty traded amount in base asset
 * @returns Quote amount of tokens necessary to run this trade and the number of trades that would happen approximately and protection price and remaining amount of base tokens
 */
export function intentBaseForQuoteAsset(
  bookSide: TableLevel[],
  remainingFillAmountEth: bigint,
  baseAssetQty: bigint = 10n ** 18n,
  minTradedQty: bigint = 1n,
): [bigint, number, bigint, bigint] {
  let totalReceiveToken = 0n;
  let approxTrades = 0;
  let lastLvl = 0n;

  for (const lvl of bookSide) {
    lastLvl = lvl.price;
    if (lvl.volume <= remainingFillAmountEth) {
      totalReceiveToken += (lvl.price * lvl.volume) / baseAssetQty;
      approxTrades += lvl.orders;
    } else {
      //TODO: real issue how to make good approximation?
      const trades = min(
        ceilDivide(lvl.volume, minTradedQty),
        BigInt(lvl.orders),
      );
      totalReceiveToken += (remainingFillAmountEth * lvl.price) / baseAssetQty;
      approxTrades += Number(trades);
    }

    remainingFillAmountEth -= lvl.volume;
    if (remainingFillAmountEth <= 0) break;
  }

  return [
    totalReceiveToken,
    approxTrades,
    lastLvl,
    remainingFillAmountEth < 0n ? 0n : remainingFillAmountEth,
  ];
}

/**
 * Refers to Sell Order.
 * Intent: user want to know how much he needs to sell base tokens to receive quoteAmount tokens
 * @param bids List of bid price levels, total volume at each level, and number of orders.
 * @param quoteAmount Amount of quote tokens to be fulfilled.
 * @param baseAssetQty Quantity of the base asset representing 1 unit (default is 10^18).
 * @param minTradedQty in base asset
 * @returns Base amount of tokens necessary to run this trade, approximate number of trades, and protection price and remaining  quote
 */
export function getInBaseForOutQuote(
  bids: TableLevel[],
  quoteAmount: bigint,
  baseAssetQty: bigint = 10n ** 18n,
  minTradedQty: bigint = 1n,
) {
  return intentQuoteForBaseAsset(bids, quoteAmount, baseAssetQty, minTradedQty);
}

/**
 * Refers to Buy Order
 * Intent: user want to know how much he would receive if he spends quoteAmount tokens
 * @param asks List of ask price levels, total volume at each level, and number of orders.
 * @param quoteAmount Amount of quote tokens user spending.
 * @param baseAssetQty Quantity of the base asset representing 1 unit (default is 10^18).
 * @param minTradedQty in base asset
 * @returns Quote amount of tokens necessary to run this trade, approximate number of trades, and protection price and remaining quote
 */
export function getOutBaseForInQuote(
  asks: TableLevel[],
  quoteAmount: bigint,
  baseAssetQty: bigint = 10n ** 18n,
  minTradedQty: bigint = 1n,
) {
  return intentQuoteForBaseAsset(asks, quoteAmount, baseAssetQty, minTradedQty);
}

/**
 * Refers to Buy Order
 * Intent: user want to know how much he needs to spend quote tokens if he receives baseAmount tokens
 * @param asks List of ask price levels, total volume at each level, and number of orders.
 * @param baseAmount Amount of base tokens to be fulfilled.
 * @param baseAssetQty Quantity of the base asset representing 1 unit (default is 10^18).
 * @param minTradedQty
 * @returns Quote amount of tokens necessary to run this trade, approximate number of trades, and protection price and remaining amount of base tokens
 */
export function getInQuoteForOutBase(
  asks: TableLevel[],
  baseAmount: bigint,
  baseAssetQty: bigint = 10n ** 18n,
  minTradedQty: bigint = 1n,
) {
  return intentBaseForQuoteAsset(asks, baseAmount, baseAssetQty, minTradedQty);
}

/**
 * Refers to Sell Order
 * Intent: user wants to know how much quote tokens he would receive if he spends baseAmount of tokens
 * @param bids List of bid price levels, total volume at each level, and number of orders.
 * @param baseAmount Amount of base tokens to be fulfilled.
 * @param baseAssetQty Quantity of the base asset representing 1 unit (default is 10^18).
 * @param minTradedQty
 * @returns Base amount of tokens necessary to run this trade, approximate number of trades, and protection price and remaining amount of base tokens
 */
export function getOutQuoteForInBase(
  bids: TableLevel[],
  baseAmount: bigint,
  baseAssetQty: bigint = 10n ** 18n,
  minTradedQty: bigint = 1n,
) {
  return intentBaseForQuoteAsset(bids, baseAmount, baseAssetQty, minTradedQty);
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
 * @param totalAmount The total amount received.
 * @param asTaker A boolean indicating whether the fee should be calculated as a taker fee.
 * @returns The calculated fixed swap fee.
 */
export function calcFixedSwapFee(
  fee: FixedFee,
  totalAmount: bigint,
  asTaker: boolean,
) {
  const pBips = BigInt(asTaker ? fee.taker_pbips : fee.maker_pbips);
  if (pBips == 0n) return 0n;
  return (totalAmount * pBips - 1n) / BigInt(100 * 100 * 100) + 1n;
}

/**
 * Validates if a quote can be made based on the given price (protection price), quantity, and ticker specification.
 * @param price - The price/protection price at which the quote is being made.
 * @param qty - The quantity of the quote.
 * @param tickerSpec - The specification of the ticker.
 * @returns A tuple where the first element is a boolean indicating if the quote is valid,
 *          and the second element is an optional string providing a reason if the quote is not valid.
 */
export function validateCanQuote(
  price: bigint,
  qty: Quantity,
  tickerSpec: TickerSpecification,
): [boolean, string?] {
  if (qty.base_qty != 0n) {
    if (qty.base_qty % tickerSpec.rawQuoteQtyIncrement > 0n)
      return [false, `Min quote increment is ${tickerSpec.rawMinQuoteQty}`];
    if (qty.base_qty < tickerSpec.rawMinQuoteQty)
      return [false, `Min quote amount is ${tickerSpec.rawMinQuoteQty}`];
  }
  if (qty.base_qty == 0n && qty.quote_qty == 0n)
    return [false, "Traded amount is zero"];
  const matchable = getMatchableAmountInBase(
    price,
    qty,
    tickerSpec.rawMinQuoteQty,
    false,
  );
  if (matchable == 0n)
    return [
      false,
      `Matchable amount ${matchable} less than min quote qty ${tickerSpec.rawMinQuoteQty}`,
    ];
  if (price % tickerSpec.rawPriceIncrement > 0n)
    return [
      false,
      `price ${price} have incorrect tick for tick ${tickerSpec.rawPriceIncrement}`,
    ];
  return [true, undefined];
}

/**
 * Calculates the matchable amount in base asset given the price/protection price, quantity, minimum traded quantity, and if both quantities are specified.
 * @param price - The price at which the matchable amount are being calculated against.
 * @param qty - The quantity of the trade.
 * @param minTradedQty - The minimum traded quantity for base amount.
 * @param bothSpecified - A boolean indicating if both base and quote quantities are specified.
 * @param minQuoteIncrease
 * @returns The matchable amount in the base asset wrt to constraints
 */
export function getMatchableAmountInBase(
  price: bigint,
  qty: Quantity,
  minTradedQty: bigint,
  bothSpecified: boolean,
  minQuoteIncrease: bigint = 1n,
) {
  if (qty.quote_qty == 0n) {
    if (bothSpecified) return 0n;
    const tradable = (qty.base_qty / minTradedQty) * minTradedQty;
    const unspent = tradable > 0n ? qty.base_qty - tradable : 0n;
    return tradable + (unspent / minQuoteIncrease) * minQuoteIncrease;
  }
  let baseQty = (qty.base_qty / minTradedQty) * minTradedQty;
  const unspent = baseQty > 0n ? qty.base_qty - baseQty : 0n;
  baseQty = baseQty + (unspent / minQuoteIncrease) * minQuoteIncrease;

  const q =
    ((qty.base_asset * qty.quote_qty) / price / minTradedQty) * minTradedQty;
  // const baseInQuote =
  if (baseQty == 0n) return bothSpecified ? 0n : q;
  return q < baseQty ? q : baseQty;
}

/**
 * Calculate the total available volume for the base asset from the order book levels.
 * @param { [bigint, bigint, number][] } levels - The levels of the order book (bids or asks).
 * @returns { bigint } - The total available volume for the base asset.
 */
export function calculateTotalBaseVolume(
  levels: [bigint, bigint, number][],
): bigint {
  return levels.reduce((acc: bigint, lvl) => acc + lvl[1], 0n);
}
/**
 * Calculate the total available volume for the quote asset from the order book levels.
 * @param { [bigint, bigint, number][] } levels - The levels of the order book (bids or asks).
 * @param { bigint } baseAsset - The base asset unit for normalization (default: 10n ** 18n).
 * @returns { bigint } - The total available volume for the quote asset.
 */
export function calculateTotalQuoteVolume(
  levels: [bigint, bigint, number][],
  baseAsset = 10n * 18n,
): bigint {
  return levels.reduce(
    (acc: bigint, lvl) => acc + (lvl[0] * lvl[1]) / baseAsset,
    0n,
  );
}
