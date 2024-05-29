import { TradedPair } from "../../request_types";

/**
 * Represents an exchange ticker for websocket subscription
 */
export interface ExchangeTicker {
  pair: TradedPair;
  isEcosystemBook: boolean;
}

/**
 * Represents all event types that might be subscribed on  LayerAkira exchange and supported by wss client
 */
export enum SocketEvent {
  DISCONNECT = "disconnect", // wss client can emit it in case of disconnection
  BBO = "bbo",
  EXECUTION_REPORT = "fills",
  TRADE = "trade",
  BOOK_DELTA = "snap",
}

export interface IMinimalEvent<T> {
  wait(timeout?: number): Promise<T | undefined>;

  emit(evt?: T): void;
}

export class MinimalEvent<T> implements IMinimalEvent<T> {
  private resolver: ((value: T | undefined) => void) | null = null;
  private emittedValue?: T;

  wait(timeout?: number): Promise<T | undefined> {
    if (this.emittedValue !== undefined) {
      return Promise.resolve(this.emittedValue);
    }
    return new Promise<T | undefined>((resolve, reject) => {
      this.resolver = resolve;
      if (timeout !== undefined) {
        setTimeout(() => {
          if (this.resolver) {
            reject();
            this.resolver = null;
          }
        }, timeout);
      }
    });
  }

  emit(evt: T): void {
    this.emittedValue = evt;
    if (this.resolver) {
      this.resolver(evt);
      this.resolver = null;
    }
  }
}

export interface JobInterface<T> {
  idx: number;
  request: Record<string, any>;
  event: IMinimalEvent<T>;
}

export class Job<T> implements JobInterface<T> {
  idx: number;
  request: Record<string, any>;
  event: IMinimalEvent<T>;

  constructor(
    idx: number,
    request: Record<string, any>,
    event: IMinimalEvent<T>,
  ) {
    this.idx = idx;
    this.request = request;
    this.event = event;
  }
}
