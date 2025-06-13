import { TradedPair } from "src/request_types";
import { LayerAkiraWSSAPI } from "./LayerAkiraWSSAPI";
import { Snapshot, Table, TableUpdate } from "src/response_types";
import { ExchangeTicker, SocketEvent } from "./types";
import { LayerAkiraHttpAPI } from "../http/LayerAkiraHttpAPI";
import { getPairKey, timeout } from "./utils";

export class DepthBook {
  /**
   * Array of exchange ticker to listen to.
   */
  private tickers: ExchangeTicker[];
  /**
   * Http client connection.
   */
  private httpClient: LayerAkiraHttpAPI;
  /**
   * WebSocket client connection.
   */
  private wsClient: LayerAkiraWSSAPI;
  /**
   * Logger function.
   */
  public logger: (arg: string) => void;
  /**
   * Depth book data.
   */
  private pairToBook: Map<string, Table<bigint>>;
  /**
   * Pair to message id
   */
  private pairToMsgId: Map<string, bigint>;
  /**
   * Pending delta to apply
   */
  private pendingEvt: Map<string, Array<TableUpdate<bigint>>>;
  /**
   * Pair to apply change
   */
  private pairToApplyChange: Map<string, Boolean>;
  /**
   * Start Sequence Snapshot
   */
  private startSequence: Map<string, bigint>;

  /**
   * Constructor for the DepthBook class.
   * @param wsClient - WebSocket client instance.
   * @param logger - Logger function.
   */
  constructor(
    httpClient: LayerAkiraHttpAPI,
    wsClient: LayerAkiraWSSAPI,
    tickers: Array<ExchangeTicker>,
    logger?: (arg: string) => void,
  ) {
    this.httpClient = httpClient;
    this.wsClient = wsClient;
    this.tickers = tickers;
    this.logger = logger ?? ((arg: string) => arg);
    this.pairToBook = new Map();
    this.pairToMsgId = new Map();
    this.pendingEvt = new Map();
    this.pairToApplyChange = new Map();
    this.startSequence = new Map();
  }

  /**
   * Get the current order book for a given pair.
   * @param pair The traded pair for which book is needed
   * @returns The order book for the given pair.
   */
  public getBook(pair: TradedPair): Table<bigint> | undefined {
    return this.pairToBook.get(getPairKey(pair));
  }

  public async run() {
    const relay = async (evt: TableUpdate<bigint> | SocketEvent.DISCONNECT) => {
      if (evt === SocketEvent.DISCONNECT) {
        this.logger("Disconnected from WebSocket");
        return;
      }
      let pair = evt.pair;
      let key = getPairKey(pair);
      let currentMsgId = this.pairToMsgId.get(key);

      if (!this.pairToApplyChange.get(key)) {
        let pending = this.pendingEvt.get(key);
        if (pending === undefined) {
          pending = [];
        }
        if (pending.length == 0) {
          pending.push(evt);
        }
        if (pending[pending.length - 1].msg_ids_end + 1n != currentMsgId) {
          this.pendingEvt.delete(key);
        }
        this.pendingEvt.set(key, pending);
        return;
      }

      let clearBase = false;
      (this.pendingEvt.get(key) || []).forEach((pendEvt) => {
        if (pendEvt.msg_ids_start <= (this.startSequence.get(key) || 0n)) {
          this.logger(`SKIP`);
          return;
        }

        this.logger(
          `Applying the pending evt ${pendEvt.msg_ids_start}: ${pendEvt.msg_ids_end}`,
        );
        this.applyChanges(pair, pendEvt);
        clearBase = true;
      });

      if (clearBase) {
        this.startSequence.delete(key);
      }
      this.pendingEvt.delete(key);
      currentMsgId = this.pairToMsgId.get(key) || 0n;

      let snapId = this.startSequence.get(key);
      if (snapId !== 0n && snapId !== undefined) {
        this.startSequence.delete(key);
        if (evt.msg_ids_start <= snapId && snapId <= evt.msg_ids_end)
          currentMsgId = evt.msg_ids_start - 1n;
      }

      if (
        currentMsgId + 1n === evt.msg_ids_start ||
        currentMsgId === evt.msg_ids_end
      )
        return this.applyChanges(pair, evt);
      else if (currentMsgId + 1n < evt.msg_ids_start) {
        this.logger(`missed messages for ${pair} \n
                            Resyncing snapshot. local ${currentMsgId} arrived ${evt.msg_ids_start}"`);
        this.pairToApplyChange.set(key, false);
        return await this.resetSnapshot(pair);
      } else {
        this.logger(`Wired`);
      }
    };

    this.tickers.forEach(async (ticker) => {
      this.logger(`Subscribing to depth stream for ${ticker.pair}`);
      await this.resetSnapshot(ticker.pair);
      let succ = await this.wsClient.subscribeOnDepthUpdate(ticker, relay);
      if (!succ) {
        this.logger(`Failed to subscribe to depth stream for ${ticker.pair}`);
        return;
      }
    });
    return;
  }

  /**
   * Fucntion to apply changes to the order book.
   * @param pair traded pair to apply changes to
   * @param update snapshot to apply
   */
  private applyChanges(pair: TradedPair, update: TableUpdate<bigint>) {
    this.logger(
      `Applying the new evt ${update.msg_ids_start}: ${update.msg_ids_end}: ${update}`,
    );
    let key = getPairKey(pair);
    let bids = this.pairToBook.get(key)?.bids ?? [];
    let asks = this.pairToBook.get(key)?.asks ?? [];

    update.bids.forEach((level) => {
      if (level[1] == 0n) {
        bids = bids.filter((bid) => bid[0] != level[0]);
      } else {
        const existingBidIndex = bids.findIndex((bid) => bid[0] == level[0]);
        if (existingBidIndex >= 0) {
          bids[existingBidIndex][1] = level[1];
        } else {
          bids.push([level[0], level[1], level[2]]);
        }
      }
    });

    update.asks.forEach((level) => {
      if (level[1] == 0n) {
        asks = asks.filter((ask) => ask[0] != level[0]);
      } else {
        const existingAskIndex = asks.findIndex((ask) => ask[0] == level[0]);
        if (existingAskIndex >= 0) {
          asks[existingAskIndex][1] = level[1];
        } else {
          asks.push([level[0], level[1], level[2]]);
        }
      }
    });

    bids.sort((a, b) => {
      return a[0] < b[0] ? 1 : -1;
    });

    asks.sort((a, b) => {
      return a[0] < b[0] ? -1 : 1;
    });

    this.pairToBook.set(key, {
      bids: bids,
      asks: asks,
      msg_id: update.msg_id,
    });

    this.pairToMsgId.set(key, BigInt(update.msg_id));
  }

  /**
   * Get the current order book for a given pair.
   * @param pair - The traded pair for the pair.
   * @returns {Promise<void>}
   */
  private async resetSnapshot(pair: TradedPair): Promise<void> {
    try {
      let key = getPairKey(pair);
      let res = await this.httpClient.getSnapshot(pair.base, pair.quote, false);
      if (res.error || res.result === undefined) {
        this.logger(`Failed to get snapshot for ${pair}: ${res.error}`);
        throw new Error(res.error);
      }
      let snap = res.result as Snapshot<bigint>;
      this.pairToBook.set(key, snap.levels);
      this.pairToMsgId.set(key, snap.levels.msg_id);
      this.startSequence.set(key, snap.levels.msg_id);

      let pendingEvt = this.pendingEvt.get(key);

      if (pendingEvt === undefined || pendingEvt.length == 0) {
      } else {
        let first = pendingEvt[0];
        let last = pendingEvt[pendingEvt.length - 1];

        if (snap.levels.msg_id < first.msg_ids_start - 1n) {
          this.logger(`Stale Snapshot to apply for ${pair} ${snap}`);
          this.pairToApplyChange.set(key, false);
          this.startSequence.delete(key);
          // timeout for 4 sec
          await timeout(4 * 1000);
          return this.resetSnapshot(pair);
        }

        if (snap.levels.msg_id > last.msg_id) {
          this.logger(`Clearing: ${pendingEvt}`);
          this.pendingEvt.delete(key);
        }
      }

      this.pendingEvt.set(
        key,
        pendingEvt?.filter((evt) => evt.msg_ids_end >= snap.levels.msg_id) ??
          [],
      );

      (this.pendingEvt.get(key) ?? []).forEach((evt) => {
        this.logger(
          `Applying the pending evt ${evt.msg_ids_start}: ${evt.msg_ids_end}`,
        );
        this.applyChanges(pair, evt);
        this.startSequence.delete(key);
      });

      this.pendingEvt.delete(key);
      this.pairToApplyChange.set(key, true);
    } catch (error) {
      this.logger(`Error resetting snapshot for ${pair}: ${error}`);
    }
  }
}
