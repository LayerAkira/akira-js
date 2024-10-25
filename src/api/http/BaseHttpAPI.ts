import { ethers, toUtf8Bytes } from "ethers";
import { bigIntReplacer, convertToBigintRecursively, stall } from "./utils";
import { Result } from "../../response_types";

export class BaseHttpAPI {
  public readonly apiBaseUrl: string;
  public readonly timeoutMillis: number;
  public logger: (arg: string) => void;

  constructor(
    apiBaseUrl: string,
    logger?: (arg: string) => void,
    timeoutMillis: number = 10 * 1000,
  ) {
    this.apiBaseUrl = apiBaseUrl;
    this.logger = logger ?? ((arg: string) => arg);
    this.timeoutMillis = timeoutMillis;
  }

  /**
   * Generic fetch method for any API endpoint.
   * @param apiPath Path to URL endpoint under API
   * @param query URL query params. Will be used to create a URLSearchParams object.
   * @param applyParseInt Apply casting of integers in hex format and '\d+' to bigint
   * @param exclusionFields Which fields should be omitted for casting
   * @returns A response from the API.
   */
  public async get<T>(
    apiPath: string,
    query: object = {},
    applyParseInt = true,
    exclusionFields: string[] = [],
    preApplyParser?: (o: any) => any,
  ): Promise<T> {
    const qs = this.objectToSearchParams(query);
    const url = `${this.apiBaseUrl}${apiPath}${qs.length > 0 ? "?" + qs : ""}`;
    return (await this._fetch(
      url,
      applyParseInt,
      exclusionFields,
      undefined,
      undefined,
      preApplyParser,
    )) as T;
  }

  /**
   * Generic post method for any API endpoint.
   * @param apiPath Path to URL endpoint under API
   * @param body Data to send
   * @param applyParseInt Apply casting of integers in hex format and '\d+' to bigint
   * @param exclusionFields Fields to exclude from casting
   * @param opts Options like headers
   * @param preApplyParser
   * @returns A response from the API.
   */
  public async post<T>(
    apiPath: string,
    body: object,
    applyParseInt = true,
    exclusionFields: string[] = [],
    opts?: object,
    preApplyParser?: (o: any) => any,
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${apiPath}`;
    return (await this._fetch(
      url,
      applyParseInt,
      exclusionFields,
      opts,
      body,
      preApplyParser,
    )) as T;
  }

  protected async _fetch(
    url: string,
    applyParseInt = true,
    exclusionFields: string[] = [],
    headers?: object,
    body?: object,
    preApplyParser?: (o: any) => any,
  ) {
    const req = new ethers.FetchRequest(url);
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        req.setHeader(key, value);
      }
    }
    if (body) {
      req.body = toUtf8Bytes(JSON.stringify(body, bigIntReplacer));
      req.setHeader("content-type", "application/json");
    }
    req.timeout = this.timeoutMillis;
    req.retryFunc = async (_req, resp, attempt) => {
      this.logger(
        `Fetch attempt ${attempt} failed with status ${resp.statusCode}`,
      );
      await stall(1000);
      return true;
    };

    this.logger(
      `Sending request: ${url}, ${JSON.stringify({ headers, body })}`,
    );

    try {
      const response = await req.send();
      if (!response.ok()) {
        const error = response.bodyJson?.error;
        return error
          ? { code: response.statusCode, message: error }
          : { code: response.statusCode, message: response.bodyText };
      }

      if (response.bodyJson.result === undefined) return response.bodyJson;
      let data = preApplyParser
        ? preApplyParser(response.bodyJson["result"])
        : response.bodyJson["result"];
      return {
        result: applyParseInt
          ? convertToBigintRecursively(data, exclusionFields)
          : data,
      };
    } catch (e: any) {
      return { code: "NETWORK_ERROR", exception: e };
    }
  }

  protected objectToSearchParams(params: object = {}) {
    const urlSearchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => item && urlSearchParams.append(key, item));
      } else {
        urlSearchParams.append(key, value);
      }
    });
    return urlSearchParams.toString();
  }
}
