import { IMessageEvent, w3cwebsocket as W3CWebSocket } from "websocket";
import { Job, MinimalEvent, SocketEvent } from "./types";
import { Result } from "../../response_types";
import { getEpochSeconds, sleep } from "./utils";

//
// export class AsyncLockManager<T> {
//   private locks = new Map<T, MinimalEvent<boolean> >();
//
//   async acquire(key: T) : Promise<void> {
//     while (true) {
//       if (!this.locks.has(key)) {
//         this.locks.set(key, new MinimalEvent<boolean>())
//         return
//       }
//       const evt = this.locks.get(key)!
//       await evt.wait()
//     }
//   }
//
//   release(key:T): void {
//     const evt = this.locks.get(key)
//     this.locks.delete(key)
//     evt?.emit(true)
//   }
//
// }
//
//
// class SubscriptionMultiplexer< T> {
//   private listeners = new Map<string, Array<[string,(evt: T) => Promise<void>]>>();
//
//   public addListener(clientId:string, key: string, cb: (evt: T) => Promise<void>) {
//     const contains = this.listeners.has(key)
//     if (!contains) this.listeners.set(key, []);
//     this.listeners.get(key)!.push([clientId,cb]);
//     return !contains
//   }
//
//   public removeListener(clientId:string, key: string) {
//     return this.listeners.delete(key);
//   }
//
//   public notify(key: string, evt: T) {
//     const cbs = this.listeners.get(key);
//     if (cbs) {
//       cbs.forEach(async (cb) => {
//         try {
//           await cb(evt);
//         } catch (e) {
//           console.error(`Error in listener for ${key}:`, e);
//         }
//       });
//     }
//   }
//
//   public notifyAll(evt:T) {
//     this.listeners.forEach((cbs, key) => {
//       cbs.forEach(async (cb) => {
//         try {
//           await cb(evt);
//         } catch (e) {
//           console.error(`Error in disconnect callback for ${key}:`, e);
//         }
//       });
//     });
//     this.listeners.clear();
//   }
//
//   public hasKey(key: string): boolean {
//     return this.listeners.has(key);
//   }
// }

export abstract class BaseWssApi {
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

  private readonly repeatCoolDownMillis: number;
  private client: W3CWebSocket | null = null;
  private responseQueue: IMessageEvent[] = [];
  private processingQueue: boolean = false;
  private jobs = new Map<number, Job<Result<string>>>();
  protected subscriptions: Map<
    number | string,
    (evt: any | SocketEvent.DISCONNECT) => Promise<void>
  > = new Map();
  private pendingSubscriptions: Map<
    number | string,
    (evt: any | SocketEvent.DISCONNECT) => Promise<void>
  > = new Map();

  protected constructor(
    wsPath: string,
    logger?: (msg: string) => void,
    shouldReconnect = true,
    repeatCoolDownMillis = 5000,
  ) {
    this.wsPath = wsPath;
    this.logger = logger ?? ((msg) => msg);
    this.shouldReconnect = shouldReconnect;
    this.repeatCoolDownMillis = repeatCoolDownMillis;
    this.isClosed = true;
  }

  protected abstract onopen(): void;
  protected abstract onclose(): void;
  protected abstract handleSubsEvent(json: Record<string, any>): Promise<void>;

  /**
   * Establishes a WebSocket connection and handles reconnection logic.
   * @returns A promise that resolves when the WebSocket client is terminated.
   */
  protected async connect(
    getUrl: (base: string) => Promise<string | undefined>,
  ): Promise<void> {
    this.isClosed = false;
    while (this.shouldReconnect && !this.isClosed) {
      try {
        await this.run(getUrl);
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

  protected close() {
    this.isClosed = true;
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
  protected async subscribe<T>(
    cb: (evt: any) => Promise<void>,
    data: Record<string, any>,
    streamId: number | string,
    idx: number,
    timeout?: number,
  ): Promise<Result<"OK" | T>> {
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
      console.log("D");
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
  protected async unsubscribe<T>(
    data: Record<string, any>,
    streamId: number | string,
    idx: number,
    timeout?: number,
  ): Promise<Result<"OK" | T>> {
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
  private async run(
    getUrl: (base: string) => Promise<string | undefined>,
  ): Promise<void> {
    // cleanup
    this.jobs.forEach((job) => job.event.emit());

    // issue listen key and establish connection
    const url = await getUrl(this.wsPath);
    if (!url) return;

    return new Promise((resolve) => {
      if (this.isClosed) {
        this.logger(`Ws is closed`);
        resolve();
        return;
      }

      let client = new W3CWebSocket(url, undefined, undefined);
      // TODO move to class args
      client.binaryType = "arraybuffer";
      client.onopen = () => {
        this.logger(`Connect to websocket api established for ${url}`);
        this.client = client;
        this.lastConnected = getEpochSeconds();
        this.onopen();
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
        this.onclose();
        resolve();
      };
    });
  }

  private enqueueMessage(message: IMessageEvent) {
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
    await this.handleSubsEvent(json);
  }
}
