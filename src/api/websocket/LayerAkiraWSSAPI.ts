import { LayerAkiraHttpAPI } from "../http/LayerAkiraHttpAPI";
import {
  BBO,
  CancelAllReport,
  ExecutionReport,
  FillTransactionInfo,
  Result,
  TableUpdate,
  Trade,
} from "../../response_types";
import { ExchangeTicker, SocketEvent } from "./types";
import { getHashCode, normalize, stringHash } from "./utils";
import {
  convertFieldsRecursively,
  convertToBigintRecursively,
} from "../http/utils";
import { formattedDecimalToBigInt, parseTableLvl } from "../utils";
import { getPairKey } from "./utils";
import { BaseWssApi } from "./BaseWssApi";

/**
 * Represents a LayerAkira WebSocket API.
 */
export interface ILayerAkiraWSSAPI {
  /**
   * Establishes a connection to the WebSocket API.
   * @returns A promise that resolves when the connection is terminated
   */
  connect(): Promise<void>;

  /**
   * Closes the WebSocket connection.
   */
  close(): void;

  /**
   * Subscribes to market data events.
   * @param clientCb - Callback function to handle incoming market data events.
   * @param eventType - Type of market data event to subscribe to.
   * @param ticker - The exchange ticker for which to subscribe.
   * @param timeout - Optional timeout value in milliseconds.
   * @returns A promise containing the result of the subscription request.
   */
  subscribeOnMarketData(
    clientCb: (
      evt: TableUpdate<bigint | string> | BBO | Trade | SocketEvent.DISCONNECT,
    ) => Promise<void>,
    eventType: SocketEvent.BBO | SocketEvent.BOOK_DELTA | SocketEvent.TRADE,
    ticker: ExchangeTicker,
    timeout?: number,
  ): Promise<Result<string>>;

  /**
   * Unsubscribes from market data events.
   * @param eventType - Type of market data event to unsubscribe from.
   * @param ticker - The exchange ticker for which to unsubscribe.
   * @param timeout - Optional timeout value in milliseconds.
   * @returns A promise containing the result of the unsubscription request.
   */
  unSubscribeFromMarketData(
    eventType: SocketEvent.BBO | SocketEvent.BOOK_DELTA | SocketEvent.TRADE,
    ticker: ExchangeTicker,
    timeout?: number,
  ): Promise<Result<string>>;

  /**
   * Subscribes to execution report events.
   * @param clientCb - Callback function to handle incoming execution report events.
   * @param timeout - Optional timeout value in milliseconds.
   * @returns A promise containing the result of the subscription request.
   */
  subscribeOnExecReport(
    clientCb: (
      evt:
        | FillTransactionInfo
        | CancelAllReport
        | ExecutionReport
        | SocketEvent.DISCONNECT,
    ) => Promise<void>,
    timeout?: number,
  ): Promise<Result<string>>;

  /**
   * Unsubscribes from execution report events.
   * @param timeout - Optional timeout value in milliseconds.
   * @returns A promise containing the result of the unsubscription request.
   */
  unSubscribeFromExecReport(timeout?: number): Promise<Result<string>>;
}

/**
 * The API class for the LayerAkira SDK.
 * The LayerAkiraWSSAPI class provides functionality for subscribing and unsubscribing
 * to events emitted by LayerAkira exchange over websockets.
 * It establishes a WebSocket connection to the specified path and handles reconnection logic if necessary.
 * In case of disconnection:
 *  1) ongoing pending requests would be cancelled
 *  2) subscribers would be notified about disconnection with DISCONNECT event. It is guaranteed that only one event for client would be fired
 *  3) all internal state would be cleared, i.e. user would need to subscribe again once connection established back
 *  4) if shouldReconnect specified in constructor than websockets would automatically reconnect after small cooldown
 *  Notes:
 *      After each N minutes user need to refresh listen key
 *      When connection established we are sending Signer and Listen key which we obtain from httpClient, i.e.
 *      httpClient should have set credentials in order for WSS client to obtain listen key
 * @category Main Classes
 */
export class LayerAkiraWSSAPI extends BaseWssApi implements ILayerAkiraWSSAPI {
  private REISSUE_LISTEN_KEY_TIME = 28 * 60 * 1000; // 30min, take less to avoid disconnection

  private httpClient: LayerAkiraHttpAPI;
  private rpcReqId = 0;
  private readonly exclusionParseBigIntFields = [
    "maker",
    "order_hash",
    "taker",
    "client",
    "hash",
    "tx_hash",
    "old_tx_hash",
  ];

  private readonly castByQuote = new Set([
    "price",
    "quote_qty",
    "acc_quote_qty",
    "fill_price",
    "fill_quote_qty",
  ]);
  private readonly castByBase = new Set([
    "base_qty",
    "acc_base_qty",
    "fill_base_qty",
  ]);
  private listenKeyRefreshInterval: NodeJS.Timeout | null = null;

  /**
   * Array of depth stream listerners based on pairs
   */
  private depthListners: Map<
    string,
    Array<(evt: TableUpdate<bigint> | SocketEvent.DISCONNECT) => Promise<void>>
  >;

  /**
   * Constructs a new LayerAkiraWSSAPI instance.
   * @param wsPath - The WebSocket path.
   * @param httpClient - The HTTP client for LayerAkira.
   * @param shouldReconnect - Whether to attempt reconnection in case of disconnections
   * @param logger - Optional logger function.
   * @param repeatCoolDownMillis sleep after failed attempts for restore disconnection and retry for subs/unsub if timeout not specified
   */
  constructor(
    wsPath: string,
    httpClient: LayerAkiraHttpAPI,
    shouldReconnect: boolean,
    logger?: (arg: string) => void,
    repeatCoolDownMillis?: number,
  ) {
    super(wsPath, logger, shouldReconnect, repeatCoolDownMillis);
    this.httpClient = httpClient;
    this.depthListners = new Map();
  }

  /**
   * Establishes a WebSocket connection and handles reconnection logic.
   * @returns A promise that resolves when the WebSocket client is terminated.
   */
  public async connect(): Promise<void> {
    return await super.connect(this.buildUrl);
  }

  public async subscribeOnDepthUpdate(
    ticker: ExchangeTicker,
    clientCb: (
      evt: TableUpdate<bigint> | SocketEvent.DISCONNECT,
    ) => Promise<void>,
  ): Promise<boolean> {
    try {
      let key = getPairKey(ticker.pair);
      // check if the pair is already subscribed
      if (this.depthListners.has(key)) {
        this.depthListners.get(key)?.push(clientCb);
        return true;
      }
      let res = await this.subscribeOnMarketData(
        (evt) => {
          return this.handleDepthStream(evt);
        },
        SocketEvent.BOOK_DELTA,
        ticker,
      );
      if (res.error !== undefined) {
        this.logger(
          `Error subscribing to depth update for ${ticker.pair}: ${res.error}`,
        );
        return false;
      }
      this.depthListners.set(key, [clientCb]);
      this.logger(`Subscribed to depth update for ${ticker.pair}`);
      return true;
    } catch (e) {
      this.logger(`Error subscribing to depth update for ${ticker.pair}: ${e}`);
      return false;
    }
  }

  /**
   * Depth Stream handler function
   * @param evt - Event object containing depth update or disconnect event.
   * @returns {Promise<void>}
   */
  private async handleDepthStream(
    evt: TableUpdate<bigint> | BBO | SocketEvent.DISCONNECT,
  ): Promise<void> {
    if (typeof evt === "object" && "ts" in evt) {
      // unreachable bbo
      return;
    }
    // TODO: move to the base
    if (evt === SocketEvent.DISCONNECT) {
      this.depthListners.forEach(async (cbs, key) => {
        let promises: Promise<void>[] = [];
        if (cbs.length) {
          cbs.map((cb) => promises.push(cb(SocketEvent.DISCONNECT)));
        }
        await Promise.all(promises);
        this.depthListners.delete(key);
      });
      return;
    }
    let listeners = this.depthListners.get(getPairKey(evt.pair));
    if (listeners === undefined || listeners.length === 0) {
      this.logger(
        `No listeners found for depth update for ${evt.pair}, skipping`,
      );
      return;
    }
    listeners.forEach(async (cb) => {
      try {
        await cb(evt);
      } catch (e) {
        this.logger(
          `Error handling depth update for ${evt.pair}: ${e}, skipping`,
        );
      }
    });
  }

  public async subscribeOnMarketData(
    clientCb: (
      evt: TableUpdate<bigint> | BBO | SocketEvent.DISCONNECT,
    ) => Promise<void>,
    event: SocketEvent.BBO | SocketEvent.TRADE | SocketEvent.BOOK_DELTA,
    ticker: ExchangeTicker,
    timeout?: number,
  ): Promise<Result<"OK">> {
    this.rpcReqId += 1;
    const reqData = {
      action: "subscribe",
      id: this.rpcReqId,
      stream: event,
      ticker: {
        base: ticker.pair.base,
        quote: ticker.pair.quote,
        ecosystem_book: ticker.isEcosystemBook,
      },
    };
    const res = await this.subscribe<"OK">(
      clientCb,
      reqData,
      getHashCode(ticker, event),
      this.rpcReqId,
      timeout,
    );
    this.logger(
      `Request result for ${event} ${JSON.stringify(ticker)} is ${JSON.stringify(res)}`,
    );
    return res;
  }

  async unSubscribeFromMarketData(
    event: SocketEvent.BBO | SocketEvent.TRADE | SocketEvent.BOOK_DELTA,
    ticker: ExchangeTicker,
    timeout?: number,
  ): Promise<Result<"OK">> {
    this.rpcReqId += 1;
    const data = {
      stream: event,
      ticker: {
        base: ticker.pair.base,
        quote: ticker.pair.quote,
        ecosystem_book: ticker.isEcosystemBook,
      },
      action: "unsubscribe",
      id: this.rpcReqId,
    };
    return await this.unsubscribe(
      data,
      getHashCode(ticker, event),
      this.rpcReqId,
      timeout,
    );
  }

  async subscribeOnExecReport(
    clientCb: (evt: any | SocketEvent.DISCONNECT) => Promise<void>,
    timeout?: number,
  ): Promise<Result<"OK">> {
    this.rpcReqId += 1;
    const tradingAcc = this.httpClient.getTradingAccount();
    if (tradingAcc === undefined) return { error: "Undefined trading account" };
    const reqData = {
      action: "subscribe",
      id: this.rpcReqId,
      stream: `${SocketEvent.EXECUTION_REPORT}_${tradingAcc}`,
    };
    const res = await this.subscribe<"OK">(
      clientCb,
      reqData,
      stringHash(normalize(tradingAcc)),
      this.rpcReqId,
      timeout,
    );
    this.logger(
      `Request result for ${SocketEvent.EXECUTION_REPORT} is ${JSON.stringify(res)}`,
    );
    return res;
  }

  async unSubscribeFromExecReport(timeout?: number): Promise<Result<"OK">> {
    this.rpcReqId += 1;
    const tradingAcc = this.httpClient.getTradingAccount();
    if (tradingAcc === undefined) return { error: "Undefined trading account" };

    const data = {
      stream: `${SocketEvent.EXECUTION_REPORT}_${tradingAcc}`,
      action: "unsubscribe",
      id: this.rpcReqId,
    };
    return await this.unsubscribe(
      data,
      stringHash(normalize(tradingAcc)),
      this.rpcReqId,
      timeout,
    );
  }

  public close() {
    super.close();
    if (this.listenKeyRefreshInterval) {
      clearInterval(this.listenKeyRefreshInterval);
      this.listenKeyRefreshInterval = null;
    }
  }

  protected onopen() {
    this.startListenKeyRefresh();
  }

  protected onclose() {
    if (this.listenKeyRefreshInterval) {
      clearInterval(this.listenKeyRefreshInterval);
      this.listenKeyRefreshInterval = null;
    }
  }
  private async buildUrl(base: string) {
    const signer = this.httpClient.getSigner();
    if (signer === undefined) {
      this.logger(`Cant establish ws connection because no auth passed`);
      return;
    }

    const listenKey = await this.httpClient.getListenKey();
    if (listenKey.result === undefined) {
      this.logger(
        `Failed to query listen key for ${signer} signer due ${JSON.stringify(listenKey)}`,
      );
      return;
    }
    return `${base}?listenKey=${listenKey.result}&signer=${signer?.toString()}`;
  }

  protected async handleSubsEvent(json: Record<string, any>) {
    let [bDecimals, qDecimals] = [0, 0];
    if (json?.pair !== undefined) {
      const pair = json?.pair;
      bDecimals = this.httpClient.erc20ToDecimals[pair.base];
      qDecimals = this.httpClient.erc20ToDecimals[pair.quote];
      json = convertFieldsRecursively(json, this.castByBase, (e: any) =>
        formattedDecimalToBigInt(e, bDecimals),
      );
      json = convertFieldsRecursively(json, this.castByQuote, (e: any) =>
        formattedDecimalToBigInt(e, qDecimals),
      );
      json.result.pair = pair;
      if (json.result.sor) {
        json.result.sor.fill_receive_qty = formattedDecimalToBigInt(
          json.result.sor.fill_receive_qty,
          this.httpClient.erc20ToDecimals[json.result.sor.receive_token],
        );
      }
    }

    let subscription: number;
    if (
      [SocketEvent.BBO, SocketEvent.TRADE, SocketEvent.BOOK_DELTA].includes(
        json.stream,
      )
    ) {
      if (json.stream == SocketEvent.BBO) {
        json.result.bid = parseTableLvl(json.result.bid, bDecimals, qDecimals);
        json.result.ask = parseTableLvl(json.result.ask, bDecimals, qDecimals);
      } else if (json.stream == SocketEvent.BOOK_DELTA) {
        json.result.bids = json.result.bids.map((e: any) =>
          parseTableLvl(e, bDecimals, qDecimals),
        );
        json.result.asks = json.result.asks.map((e: any) =>
          parseTableLvl(e, bDecimals, qDecimals),
        );
      }
      subscription = getHashCode(
        { pair: json.pair, isEcosystemBook: json.ecosystem },
        json.stream,
      );
    } else if (json.stream == SocketEvent.EXECUTION_REPORT) {
      subscription = stringHash(normalize(json.client));
      json.result.client = json.client;
      if (json.pair !== undefined) {
        json.result.pair = json.pair;
      }
    } else {
      this.logger(
        `Unknown socket type of subscription message ${json.toString()}`,
      );
      return;
    }
    json = convertToBigintRecursively(json, this.exclusionParseBigIntFields);
    if (!this.subscriptions.has(subscription)) {
      // TODO need to unsubscribe eventually
      this.logger(`Unknown subscription message ${json.toString()}`);
      return;
    }
    await this.subscriptions.get(subscription)!(json["result"]);
  }

  private startListenKeyRefresh() {
    if (this.listenKeyRefreshInterval) {
      clearInterval(this.listenKeyRefreshInterval);
    }

    this.listenKeyRefreshInterval = setInterval(
      () => this.refreshListenKey(),
      this.REISSUE_LISTEN_KEY_TIME,
    );
  }
  private async refreshListenKey() {
    this.logger(`Refreshing listen key...`);

    const listenKeyResponse = await this.httpClient.getListenKey();

    if (listenKeyResponse.result) {
      this.logger(`Listen key refreshed successfully`);
    } else {
      this.logger(
        `Failed to refresh listen key: ${JSON.stringify(listenKeyResponse)}`,
      );
    }
  }
}
