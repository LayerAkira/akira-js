import { ExchangeTicker } from "@/api";
import { FeeTuple } from "@/response_types.ts";

/**
 * Represents a map that stores ExchangeTicker objects and their corresponding fee tuples.
 */
export class TickerFeeMap {
  public readonly defaultFee: FeeTuple;

  private map: Map<ExchangeTicker, FeeTuple>;

  /**
   * Creates an instance of TickerFeeMap.
   * @param defaultFee The default fee tuple to be used when a ticker is not found.
   * @param entries Optional initial entries to populate the map.
   */
  constructor(defaultFee: FeeTuple, entries?: [ExchangeTicker, FeeTuple][]) {
    this.defaultFee = defaultFee;
    this.map = new Map(entries);
  }

  /**
   * Gets the fee tuple for a given ticker, with default if not found.
   * @param ticker The ExchangeTicker object representing the ticker.
   * @returns The fee tuple associated with the ticker, or the default fee if not found.
   */
  get(ticker: ExchangeTicker): FeeTuple {
    return this.map.get(ticker) || this.defaultFee;
  }

  /**
   * Sets the fee tuple for a given ticker.
   * @param ticker The ExchangeTicker object representing the ticker.
   * @param fee The fee tuple to set for the ticker.
   */
  set(ticker: ExchangeTicker, fee: FeeTuple): void {
    this.map.set(ticker, fee);
  }

  /**
   * Checks if the map contains a given ticker.
   * @param ticker The ExchangeTicker object representing the ticker.
   * @returns True if the map contains the ticker, otherwise false.
   */
  has(ticker: ExchangeTicker): boolean {
    return this.map.has(ticker);
  }

  /**
   * Gets the size of the map.
   * @returns The number of entries in the map.
   */
  size(): number {
    return this.map.size;
  }

  /**
   * Clears all entries from the map.
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Executes a provided function once for each key-value pair in the map.
   * @param callbackfn A function that accepts three arguments: value, key, and the map itself.
   */
  forEach(
    callbackfn: (
      value: FeeTuple,
      key: ExchangeTicker,
      map: Map<ExchangeTicker, FeeTuple>,
    ) => void,
  ): void {
    this.map.forEach(callbackfn);
  }

  /**
   * Converts the map to an array of key-value pairs.
   * @returns An array containing key-value pairs representing the entries in the map.
   */
  toArray(): [ExchangeTicker, FeeTuple][] {
    return Array.from(this.map.entries());
  }
}
