import { convertToBigintRecursively } from "../src/api/http/utils";
import { TableLevel } from "../src";
import {
  getInBaseForOutQuote,
  getInQuoteForOutBase,
  getOutBaseForInQuote,
  getOutQuoteForInBase,
} from "../src/utils/swap";

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
const bids: TableLevel[] = [
  // px in USDT, qty in ETH
  { price: 1000n * 10n ** 6n, volume: 10n ** 18n, orders: 5 },
  { price: 900n * 10n ** 6n, volume: 10n ** 18n - 10n ** 17n, orders: 24 },
  { price: 800n * 10n ** 6n, volume: 7n * 10n ** 17n, orders: 4 },
];

const asks: TableLevel[] = [
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
    let [amountInETH, trades, protectionPrice] = getInBaseForOutQuote(
      bids,
      600n * 10n ** 6n,
    );
    expect(6n * 10n ** 17n).toEqual(amountInETH);
    expect(3).toEqual(trades);
    expect(1000n * 10n ** 6n).toEqual(protectionPrice);
  });

  // #user wants to sell 1900 USDT worth, sweeping just 2 levels
  it("Intent: Sell base token (ETH) for quote (USDT): specify exact(approx) receive amount 1900 quote token", () => {
    let [amountInETH, trades, protectionPrice] = getInBaseForOutQuote(
      bids,
      1900n * 10n ** 6n,
    );
    expect(20125n * 10n ** 14n).toEqual(amountInETH);
    expect(30).toEqual(trades);
    expect(800n * 10n ** 6n).toEqual(protectionPrice);
  });

  // # user want to buy on 600 usdt, we sweep just 1 lvl
  it("Intent: Sell quote token (USDT) for base (ETH): specify exact(approx) spend 600 quote token", () => {
    let [amountOutETH, trades, protectionPrice] = getOutBaseForInQuote(
      asks,
      600n * 10n ** 6n,
    );
    expect(6n * 10n ** 17n).toEqual(amountOutETH);
    expect(3).toEqual(trades);
    expect(1000n * 10n ** 6n).toEqual(protectionPrice);
  });

  it("Intent: Buy base token (ETH) for quote (USDT): specify exact receive 0.3 base token", () => {
    let [amountInUSDT, trades, protectionPrice] = getInQuoteForOutBase(
      asks,
      3n * 10n ** 17n,
    );
    expect(300n * 10n ** 6n).toEqual(amountInUSDT);
    expect(2).toEqual(trades);
    expect(1000n * 10n ** 6n).toEqual(protectionPrice);
  });

  it("Intent: Sell base token (ETH) for quote (USDT): specify exact spend 0.6 base token", () => {
    let [amountOutUSDT, trades, protectionPrice] = getOutQuoteForInBase(
      bids,
      6n * 10n ** 17n,
    );
    expect(600n * 10n ** 6n).toEqual(amountOutUSDT);
    expect(3).toEqual(trades);
    expect(1000n * 10n ** 6n).toEqual(protectionPrice);
  });
});
