import * as SDK from "../src";
import { convertToBigintRecursively } from "../src/api/http/utils";

describe("utility functions for parsing JSON", () => {
  it("should cast primitives strings numbers to bigint", async () => {
    expect(1n).toEqual(convertToBigintRecursively("1"));
    expect(1n).toEqual(convertToBigintRecursively("0x1"));
    expect(42n).toEqual(convertToBigintRecursively("42"));
  });
  it("should not cast primitives strings numbers to bigint", async () => {
    expect("1n").toEqual(convertToBigintRecursively("1n"));
    expect("x1").toEqual(convertToBigintRecursively("x1"));
    expect(5).toEqual(convertToBigintRecursively(5));
  });
  it("should cast complex objects", async () => {
    let complexObject = {
      list: [{ price: "42", notRelated: 5, justString: "hello" }],
      object: {
        primitivesInts: [1, 2, 3, 4],
        primitivesStrings: ["1", "2", "3", "0x4"],
      },
      exclusionField: "0x0",
    };
    let correct = {
      list: [{ price: 42n, notRelated: 5, justString: "hello" }],
      object: {
        primitivesInts: [1, 2, 3, 4],
        primitivesStrings: [1n, 2n, 3n, 4n],
      },
      exclusionField: "0x0",
    };

    expect(correct).toEqual(
      convertToBigintRecursively(complexObject, ["exclusionField"]),
    );
  });
});

// Ticker ETH/USDT base/quote asset
const bids: SDK.TableLevel[] = [
  // px in USDT, qty in ETH
  { price: 1000n * 10n ** 6n, volume: 10n ** 18n, orders: 5 },
  { price: 900n * 10n ** 6n, volume: 10n ** 18n - 10n ** 17n, orders: 24 },
  { price: 800n * 10n ** 6n, volume: 7n * 10n ** 17n, orders: 4 },
];

const asks: SDK.TableLevel[] = [
  // px in USDT, qty in ETH
  { price: 1000n * 10n ** 6n, volume: 10n ** 18n, orders: 5 },
  { price: 1200n * 10n ** 6n, volume: 10n ** 18n - 10n ** 17n, orders: 24 },
  { price: 1300n * 10n ** 6n, volume: 7n * 10n ** 17n, orders: 4 },
];

console.log(`Bids`);
for (let idx = 0; idx < bids.length; idx++) {
  const lvl = bids[idx];
  console.log(
    `Lvl ${idx} px ${lvl.price / 10n ** 6n} -> ${Number(lvl.volume / 10n ** 15n) / 10 ** 3} eth orders ${lvl.orders}`,
  );
}

console.log(`Asks`);
for (let idx = 0; idx < asks.length; idx++) {
  const lvl = asks[idx];
  console.log(
    `Lvl ${idx} px ${lvl.price / 10n ** 6n} -> ${Number(lvl.volume / 10n ** 15n) / 10 ** 3} eth orders ${lvl.orders}`,
  );
}

describe("swap result estimation", () => {
  // # user want to sell on 600 usdt worth of eth, we sweep just 1 lvl
  it("Intent: Sell base token (ETH) for quote (USDT): specify exact(approx) receive amount 600 quote token", () => {
    let [amountInETH, trades, protectionPrice] = SDK.getInBaseForOutQuote(
      bids,
      600n * 10n ** 6n,
    );
    expect(6n * 10n ** 17n).toEqual(amountInETH);
    expect(3).toEqual(trades);
    expect(1000n * 10n ** 6n).toEqual(protectionPrice);
  });

  // #user wants to sell 1900 USDT worth, sweeping just 2 levels
  it("Intent: Sell base token (ETH) for quote (USDT): specify exact(approx) receive amount 1900 quote token", () => {
    let [amountInETH, trades, protectionPrice] = SDK.getInBaseForOutQuote(
      bids,
      1900n * 10n ** 6n,
    );
    expect(20125n * 10n ** 14n).toEqual(amountInETH);
    expect(30).toEqual(trades);
    expect(800n * 10n ** 6n).toEqual(protectionPrice);
  });

  // # user want to buy on 600 usdt, we sweep just 1 lvl
  it("Intent: Sell quote token (USDT) for base (ETH): specify exact(approx) spend 600 quote token", () => {
    let [amountOutETH, trades, protectionPrice] = SDK.getOutBaseForInQuote(
      asks,
      600n * 10n ** 6n,
    );
    expect(6n * 10n ** 17n).toEqual(amountOutETH);
    expect(3).toEqual(trades);
    expect(1000n * 10n ** 6n).toEqual(protectionPrice);
  });

  it("Intent: Buy base token (ETH) for quote (USDT): specify exact receive 0.3 base token", () => {
    let [amountInUSDT, trades, protectionPrice] = SDK.getInQuoteForOutBase(
      asks,
      3n * 10n ** 17n,
    );
    expect(300n * 10n ** 6n).toEqual(amountInUSDT);
    expect(2).toEqual(trades);
    expect(1000n * 10n ** 6n).toEqual(protectionPrice);
  });

  it("Intent: Sell base token (ETH) for quote (USDT): specify exact spend 0.6 base token", () => {
    let [amountOutUSDT, trades, protectionPrice] = SDK.getOutQuoteForInBase(
      bids,
      6n * 10n ** 17n,
    );
    expect(600n * 10n ** 6n).toEqual(amountOutUSDT);
    expect(3).toEqual(trades);
    expect(1000n * 10n ** 6n).toEqual(protectionPrice);
  });
});

describe("Trade Validation Functions", () => {
  const tickerSpec: SDK.TickerSpecification = {
    ticker: { pair: { base: "ETH", quote: "USDT" }, isEcosystemBook: false },
    rawPriceIncrement: 10n,
    rawMinQuoteQty: 1000n,
    rawQuoteQtyIncrement: 100n,
  };
  const baseAsset = 10n ** 18n;

  describe("validateCanQuote", () => {
    it("should return true for valid quote", () => {
      const price = 1000n;
      const qty = { base_qty: 1000n, quote_qty: 1000n, base_asset: baseAsset };
      const [isValid, reason] = SDK.validateCanQuote(price, qty, tickerSpec);
      expect(isValid).toBe(true);
      expect(reason).toBeUndefined();
    });

    it("should return false for base qty less than min quote qty", () => {
      const price = 1000n;
      const qty = { base_qty: 500n, quote_qty: 0n, base_asset: 10n ** 18n };
      const [isValid, reason] = SDK.validateCanQuote(price, qty, tickerSpec);
      expect(isValid).toBe(false);
      expect(reason).toBe("Min quote amount is 1000");
    });

    it("should return false for zero traded amount", () => {
      const price = 1000n;
      const qty = { base_qty: 0n, quote_qty: 0n, base_asset: 10n ** 18n };
      const [isValid, reason] = SDK.validateCanQuote(price, qty, tickerSpec);
      expect(isValid).toBe(false);
      expect(reason).toBe("Traded amount is zero");
    });

    it("should return false for non-matchable amount", () => {
      const price = 1n * 10n ** 18n;
      const qty = { base_qty: 0n, quote_qty: 999n, base_asset: 10n ** 18n };
      const [isValid, reason] = SDK.validateCanQuote(price, qty, tickerSpec);
      expect(isValid).toBe(false);
      expect(reason).toBe("Matchable amount 0 less than min quote qty 1000");
    });

    it("should return false for incorrect price tick", () => {
      const price = 1005n;
      const qty = { base_qty: 1000n, quote_qty: 0n, base_asset: 10n ** 18n };
      const [isValid, reason] = SDK.validateCanQuote(price, qty, tickerSpec);
      expect(isValid).toBe(false);
      expect(reason).toBe("price 1005 have incorrect tick for tick 10");
    });
  });

  describe("getMatchableAmountInBase", () => {
    it("should return correct matchable amount for given price and quantity", () => {
      const price = 1000n;
      const qty = { base_qty: 1000n, quote_qty: 1000n, base_asset: 10n ** 18n };
      const minTradedQty = 100n;
      const bothSpecified = false;
      const result = SDK.getMatchableAmountInBase(
        price,
        qty,
        minTradedQty,
        bothSpecified,
      );
      expect(result).toBe(1000n);
    });

    it("should return zero for zero quote quantity when bothSpecified is true", () => {
      const price = 1000n;
      const qty = { base_qty: 0n, quote_qty: 0n, base_asset: 10n ** 18n };
      const minTradedQty = 100n;
      const bothSpecified = true;
      const result = SDK.getMatchableAmountInBase(
        price,
        qty,
        minTradedQty,
        bothSpecified,
      );
      expect(result).toBe(0n);
    });

    it("should return correct matchable amount when base quantity is zero", () => {
      const price = 10n ** 18n;
      const qty = { base_qty: 0n, quote_qty: 1000n, base_asset: 10n ** 18n };
      const minTradedQty = 100n;
      const bothSpecified = false;
      const result = SDK.getMatchableAmountInBase(
        price,
        qty,
        minTradedQty,
        bothSpecified,
      );
      expect(result).toBe((price * qty.quote_qty) / price);
    });

    it("should return smaller value between base quantity and calculated quote amount", () => {
      const price = 10n ** 18n;
      const qty = { base_qty: 2000n, quote_qty: 1000n, base_asset: 10n ** 18n };
      const minTradedQty = 100n;
      const bothSpecified = false;
      const result = SDK.getMatchableAmountInBase(
        price,
        qty,
        minTradedQty,
        bothSpecified,
      );
      expect(result).toBe(1000n);
    });
  });
});
