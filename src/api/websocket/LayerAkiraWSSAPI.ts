import { LayerAkiraHttpAPI } from "../http/LayerAkiraHttpAPI";
import { IMessageEvent, w3cwebsocket as W3CWebSocket } from "websocket";
import {
  BBO,
  CancelAllReport,
  ExecutionReport,
  FillTransactionInfo,
  Result,
  TableUpdate,
  Trade,
} from "../../response_types";
import { ExchangeTicker, Job, MinimalEvent, SocketEvent } from "./types";
import {
  getEpochSeconds,
  getHashCode,
  normalize,
  sleep,
  stringHash,
} from "./utils";
import {
  convertFieldsRecursively,
  convertToBigintRecursively,
} from "../http/utils";
import { formattedDecimalToBigInt, parseTableLvl } from "../utils";

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
      evt: TableUpdate | BBO | Trade | SocketEvent.DISCONNECT,
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
export class LayerAkiraWSSAPI implements ILayerAkiraWSSAPI {
  /**
   * The WebSocket path.
   */
  public readonly wsPath: string;
  /**
   * Logger function.
   */
  public logger: (arg: string) => void;
  /**
   * Indicates whether the WebSocket should attempt reconnection.
   */
  public readonly shouldReconnect: boolean;
  /**
   * Indicates whether the WebSocket connection is closed.
   */
  public isClosed: boolean;
  /**
   * Timestamp of the time in seconds when recent connection was established
   */
  public lastConnected: number = 0;

  private REISSUE_LISTEN_KEY_TIME = 28 * 60 * 1000; // 30min, take less to avoid disconnection

  private readonly repeatCoolDownMillis: number;
  private client: W3CWebSocket | null = null;
  private httpClient: LayerAkiraHttpAPI;
  private responseQueue: IMessageEvent[] = [];
  private processingQueue: boolean = false;
  private jobs = new Map<number, Job<Result<string>>>();
  private subscriptions: Map<
    number,
    (evt: any | SocketEvent.DISCONNECT) => Promise<void>
  > = new Map();
  private pendingSubscriptions: Map<
    number,
    (evt: any | SocketEvent.DISCONNECT) => Promise<void>
  > = new Map();
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
    this.wsPath = wsPath;
    this.httpClient = httpClient;
    this.logger = logger ?? ((arg: string) => arg);
    this.shouldReconnect = shouldReconnect;
    this.isClosed = true;
    this.repeatCoolDownMillis = repeatCoolDownMillis ?? 5 * 1000;
  }

  public async subscribeOnMarketData(
    clientCb: (
      evt: TableUpdate | BBO | SocketEvent.DISCONNECT,
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
    const res = await this.subscribe(
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
    const res = await this.subscribe(
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

  /**
   * Establishes a WebSocket connection and handles reconnection logic.
   * @returns A promise that resolves when the WebSocket client is terminated.
   */
  public async connect(): Promise<void> {
    this.isClosed = false;
    while (this.shouldReconnect && !this.isClosed) {
      try {
        await this.run();
      } catch (e) {
        this.logger(`Encountered ${e}`);
      }
      this.logger(`Websocket disconnected...`);
      await sleep(this.repeatCoolDownMillis);
      // cleanup
      this.subscriptions.forEach((clientCallback) => {
        clientCallback(SocketEvent.DISCONNECT);
      });
      this.subscriptions.clear();
    }
    this.logger(`Websocket client terminated`);
  }

  public close() {
    this.isClosed = true;
    if (this.listenKeyRefreshInterval) {
      clearInterval(this.listenKeyRefreshInterval);
      this.listenKeyRefreshInterval = null;
    }
    this.client?.close();
  }

  /**
   * Subscribes to a WebSocket stream, in case of success Result<"OK"> would be returned
   * @param cb - Callback function to handle incoming events from the stream.
   * @param data - Data object containing subscription details.
   * @param streamId - Unique identifier for the stream internally.
   * @param idx - json rpc request id.
   * @param timeout - Optional timeout value in milliseconds.
   * @returns A promise containing the result of the subscription request.
   */
  private async subscribe(
    cb: (evt: any) => Promise<void>,
    data: Record<string, any>,
    streamId: number,
    idx: number,
    timeout?: number,
  ): Promise<Result<"OK">> {
    const trySubscribe = async () => {
      let client = this.client;
      if (client === null) {
        return {
          error: `Ws not ready while do request: ${streamId} for ${data}`,
        };
      }
      if (
        this.subscriptions.has(streamId) ||
        this.pendingSubscriptions.has(streamId)
      ) {
        return { error: `Duplicate stream id ${streamId} for ${data}` };
      }
      this.jobs.set(idx, new Job(idx, data, new MinimalEvent()));
      this.pendingSubscriptions.set(streamId, cb);
      this.logger(`Sending to ws: ${JSON.stringify(data)}`);
      client!.send(JSON.stringify(data));
      let result: Result<string> | undefined;
      try {
        result = await this.jobs.get(idx)!.event.wait(timeout);
      } catch (e) {
        this.jobs.delete(idx);
        this.pendingSubscriptions.delete(streamId);
        throw e;
      }

      this.jobs.delete(idx);
      this.pendingSubscriptions.delete(streamId);
      if (
        result === undefined ||
        result.result === undefined ||
        client !== this.client
      ) {
        return { error: "Please retry" };
      }
      this.subscriptions.set(streamId, cb);
      return result;
    };
    while (true) {
      try {
        return (await trySubscribe()) as Result<"OK">;
      } catch (e) {
        if (timeout !== undefined) return { error: "Timeout" };
        await sleep(this.repeatCoolDownMillis);
      }
    }
  }

  /**
   * Unsubscribes from a WebSocket stream,  in case of success Result<"OK"> would be returned
   * @param data - Data object containing unsubscription details.
   * @param streamId - Unique identifier for the stream.
   * @param idx - json rpc request id.
   * @param timeout - Optional timeout value in milliseconds.
   * @returns A promise containing the result of the unsubscription request.
   */
  private async unsubscribe(
    data: Record<string, any>,
    streamId: number,
    idx: number,
    timeout?: number,
  ): Promise<Result<"OK">> {
    const tryUnsubscribe = async () => {
      let client = this.client;
      if (client === undefined) return { result: "OK" };
      if (
        !this.subscriptions.has(streamId) &&
        !this.pendingSubscriptions.has(streamId)
      ) {
        return { result: "OK" };
      } else if (this.pendingSubscriptions.has(streamId))
        return { error: "repeat" };

      this.jobs.set(idx, new Job(idx, data, new MinimalEvent()));
      this.logger(`Sending to ws: ${JSON.stringify(data)}`);
      client!.send(JSON.stringify(data));
      let result: Result<string> | undefined;
      try {
        result = await this.jobs.get(idx)!.event.wait(timeout);
      } catch (e) {
        this.jobs.delete(idx);
        throw e;
      }
      this.jobs.delete(idx);
      if (
        result === undefined ||
        result.result === undefined ||
        client !== this.client
      ) {
        return { error: "Please retry" };
      }
      this.subscriptions.delete(streamId);
      return result;
    };
    while (true) {
      try {
        return (await tryUnsubscribe()) as Result<"OK">;
      } catch (e) {
        if (timeout !== undefined) return { error: "Timeout" };
        await sleep(this.repeatCoolDownMillis);
      }
    }
  }

  /**
   * Establishes a WebSocket connection and handles incoming messages.
   * @returns A promise that resolves when the WebSocket client is closed.
   */
  private async run(): Promise<void> {
    // cleanup
    this.jobs.forEach((job) => job.event.emit());

    // issue listen key and establish connection
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

    return new Promise((resolve) => {
      if (this.isClosed) {
        this.logger(`Ws is closed`);
        resolve();
        return;
      }

      let client = new W3CWebSocket(
        `${this.wsPath}?listenKey=${listenKey.result}&signer=${signer?.toString()}`,
        undefined,
        undefined,
        {
          // Authorization: listenKey.result,
          // Signer: signer?.toString(),
        },
      );

      client.binaryType = "arraybuffer";

      client.onopen = () => {
        this.logger(
          `Connect to websocket api established for ${signer} ${this.httpClient.getTradingAccount()}`,
        );
        this.client = client;
        this.lastConnected = getEpochSeconds();
        this.startListenKeyRefresh();
      };

      client.onmessage = (e) => {
        this.enqueueMessage(e);
      };

      client.onerror = (error) => {
        this.logger(`WebSocket Error: ${error}`);
        client?.close();
      };

      client.onclose = (closeEvent) => {
        this.logger(`WebSocket closed: ${closeEvent}`);
        this.client = null;

        if (this.listenKeyRefreshInterval) {
          clearInterval(this.listenKeyRefreshInterval);
          this.listenKeyRefreshInterval = null;
        }

        resolve();
      };
    });
  }

  private enqueueMessage(message: IMessageEvent) {
    // if (message.data instanceof Buffer) { only node js env not browser
    //   const buffer = message.data as Buffer;
    //   message.data = buffer.toString('utf-8');
    // } else
    if (message.data instanceof ArrayBuffer) {
      // Handle data as ArrayBuffer (binary data)
      const arrayBuffer = message.data;
      const decoder = new TextDecoder("utf-8");
      message = { data: decoder.decode(arrayBuffer) };
    }
    this.logger("Received: '" + message.data + "'");
    this.responseQueue.push(message);
    if (!this.processingQueue) {
      this.processingQueue = true;
      this.processQueue();
    }
  }

  private async processQueue() {
    while (this.responseQueue.length > 0) {
      const message = this.responseQueue.shift();
      if (message) await this.handleSocketMessage(message);
    }
    this.processingQueue = false;
  }

  /**
   * Handles incoming WebSocket messages by parsing JSON data and emitting events accordingly.
   * @param e The WebSocket message event containing the message data.
   */
  private async handleSocketMessage(e: IMessageEvent) {
    let json = JSON.parse(e.data.toString());
    if (json.id !== undefined) return this.jobs.get(json.id)?.event.emit(json);
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
        `Unknown socket type of subscription message ${e.data.toString()}`,
      );
      return;
    }
    json = convertToBigintRecursively(json, this.exclusionParseBigIntFields);
    if (!this.subscriptions.has(subscription)) {
      // TODO need to unsubscribe eventually
      this.logger(`Unknown subscription message ${e.data.toString()}`);
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
