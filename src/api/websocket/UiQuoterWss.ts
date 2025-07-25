import { ERC20Token } from "../../request_types";
import { BaseWssApi } from "./BaseWssApi";
import { TableUpdate } from "../../response_types";

export interface FixedDepthSubRequest {
  base: ERC20Token;
  quote: ERC20Token;
  exponent: number;
  levels: number;
  ecosystem: boolean;
}

export const formatStreamId = (r: FixedDepthSubRequest): string => {
  let expStr: string;
  if (r.exponent >= 0) {
    expStr = `ag_${10 ** r.exponent}`;
  } else {
    const decimalPlaces = Math.abs(r.exponent);
    expStr = `ag_0_${"0".repeat(decimalPlaces - 1)}1`;
  }
  return `stream_${r.base}_${r.quote}_${expStr}_${Number(r.ecosystem)}_${r.levels}`;
};

export class UiQuoterWss extends BaseWssApi {
  private idx: number;

  constructor(
    wsPath: string,
    logger?: (msg: string) => void,
    shouldReconnect = true,
    repeatCoolDownMillis = 5000,
  ) {
    super(wsPath, logger, shouldReconnect, repeatCoolDownMillis);
    this.idx = 0;
  }

  public async subscribeOnDepth(
    cb: (update: TableUpdate<string>) => Promise<void>,
    request: FixedDepthSubRequest,
    timeout?: number,
  ) {
    const streamId = formatStreamId(request);
    this.idx += 1;
    const res = await this.subscribe<"subscribed">(
      cb,
      {
        action: "subscribe",
        id: this.idx,
        stream: "snap",
        ticker: request,
      },
      streamId,
      this.idx,
      timeout,
    );
    if (res.result && res.result == "subscribed") {
      return { result: "OK" };
    }
    return res;
  }
  public async unsubscribeFromDepth(
    request: FixedDepthSubRequest,
    timeout?: number,
  ) {
    const streamId = formatStreamId(request);
    this.idx += 1;
    const res = await super.unsubscribe<"unsubscribed">(
      {
        action: "unsubscribe",
        id: this.idx,
        stream: "snap",
        ticker: request,
      },
      streamId,
      this.idx,
      timeout,
    );
    if (res.result && res.result == "unsubscribed") {
      return { result: "OK" };
    }
    return res;
  }

  protected async handleSubsEvent(json: Record<string, any>): Promise<void> {
    await this.subscriptions.get(json.stream)!(json["result"]);
  }

  async connect() {
    return await super.connect(async (_) => _);
  }

  close() {
    super.close();
  }

  protected onclose(): void {}

  protected onopen(): void {}
}
