import { Address } from "../../types";
import { BigNumberish, ethers, toUtf8Bytes } from "ethers";
import { SignData, NetworkIssueCode } from "./types";
import { bigIntReplacer, convertToBigintRecursively, stall } from "./utils";
import {
  CancelRequest,
  ERC20Token,
  ExtendedOrder,
  IncreaseNonce,
  Order,
  ReducedOrder,
  TokenAddressMap,
  Withdraw,
} from "../../request_types";
import {
  BBO,
  Result,
  RouterSpecification,
  Snapshot,
  StepsConfiguration,
  TickerSpecification,
  UserInfo,
} from "../../response_types";

export interface LayerAkiraHttpConfig {
  jwt?: string;
  tradingAccount?: Address;
  signer?: Address;
  apiBaseUrl: string;
}

const AUTH_HEADER_INVALID_MSG = "Auth header invalid";

/**
 * The API class for the LayerAkira SDK.
 * @category Main Classes
 */
export class LayerAkiraHttpAPI {
  /**
   * Base url for the API
   */
  public readonly apiBaseUrl: string;
  public isJWTInvalid: boolean = false;
  private readonly erc20ToAddress: TokenAddressMap;
  private jwtToken: string | undefined;
  private tradingAccount: Address | undefined;
  private signer: Address | undefined;
  private timeoutMillis: number;

  /**
   * Logger function to use when debugging
   */
  public logger: (arg: string) => void;

  constructor(
    config: LayerAkiraHttpConfig,
    erc20ToAddress: TokenAddressMap,
    logger?: (arg: string) => void,
    timeoutMillis?: number,
  ) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.erc20ToAddress = erc20ToAddress;
    this.jwtToken = config.jwt;
    this.tradingAccount = config.tradingAccount;
    this.signer = config.signer;
    this.logger = logger ?? ((arg: string) => arg);
    this.timeoutMillis = timeoutMillis ?? 10 * 1000;
  }

  /**
   * @param signer - public key that is responsible for signing action on behalf of account
   * @param account - trading account
   * Retrieves data that client need to sign via private key of @signer to show that he is real owner of account
   * @returns A Promise that resolves with the result of SignData
   */
  public async getSignData(
    signer: Address,
    account: Address,
  ): Promise<Result<SignData>> {
    return await this.get<Result<SignData>>(
      `/sign/request_sign_data?user=${signer}&account=${account}`,
      undefined,
      true,
    );
  }

  /**
   * @param msg - a SignData from getSignData endpoint
   * @param signature - stringified [r,s] signature of typed message with message SignData by a private key
   * signer that associated with account for which data was requested
   * @returns A Promise that resolves with the result of JWT token
   * Note that signature can be obtained as follows:
   *     let signData = getTypedData(res.result.toString(), CHAIN_D)
   *     let signature = await signer.signMessage(signData, test_acc.account_address)
   *     let jwtResult = await api.auth(res.result, castToApiSignature(signature))
   *     where getTypedData and castToApiSignature part of SDK and signer is starknet-js Signer
   */
  public async auth(
    msg: BigNumberish,
    signature: [string, string],
  ): Promise<Result<string>> {
    return await this.post(
      "/sign/auth",
      { msg: msg, signature: signature },
      false,
    );
  }

  public getTradingAccount(): Address | undefined {
    return this.tradingAccount;
  }

  public getSigner(): Address | undefined {
    return this.signer;
  }

  /**
   * Set jwt token and trading account for this instance so client can reach endpoints which requires authorization
   */
  public setCredentials(
    jwtToken: string,
    tradingAccount: Address,
    signer: Address,
  ) {
    this.jwtToken = jwtToken;
    this.tradingAccount = tradingAccount;
    this.signer = signer;
  }

  /**
   * Retrieves gas price that client would need to specify with some premium when sending some trading actions to LayerAkira
   * which would require onchain fingerprint
   * @returns A Promise that resolves with the gas price result
   */
  public async queryGasPrice(): Promise<Result<bigint>> {
    return await this.get("/gas/price");
  }

  /**
   * Retrieves the Best Bid and Offer (BBO) from the specified trading pair
   * @param base - The base ERC20 symbol.
   * @param quote - The quote ERC20 symbol.
   * @param to_ecosystem_book - Indicates whether to retrieve BBO from the ecosystem book or router book
   * @returns A Promise that resolves with the BBO result.
   */
  public async getBBO(
    base: ERC20Token,
    quote: ERC20Token,
    to_ecosystem_book: boolean,
  ): Promise<Result<BBO>> {
    return await this.get("/book/bbo", {
      base: this.erc20ToAddress[base],
      quote: this.erc20ToAddress[quote],
      to_ecosystem_book: +to_ecosystem_book,
    });
  }

  /**
   * Retrieves the book snapshot from the specified trading pair
   *
   * @param base - The base ERC20 symbol.
   * @param quote - The quote ERC20 symbol.
   * @param levels - How many levels of book should be retrieved, -1 indicating all levels
   * @param to_ecosystem_book - Indicates whether to retrieve snapshot from the ecosystem book or router book
   * @returns A Promise that resolves with the book Snapshot result.
   */
  public async getSnapshot(
    base: ERC20Token,
    quote: ERC20Token,
    to_ecosystem_book: boolean,
    levels: number = -1,
  ): Promise<Result<Snapshot>> {
    return await this.get("/book/snapshot", {
      base: this.erc20ToAddress[base],
      quote: this.erc20ToAddress[quote],
      to_ecosystem_book: +to_ecosystem_book,
      levels: levels,
    });
  }

  /**
   * Retrieves the listen key to be able to subscribe to market data streams over websockets
   * @returns A Promise that resolves with the result of listen token
   */
  public async getListenKey(): Promise<Result<string>> {
    return await this.get("/user/listen_key", undefined, false);
  }

  /**
   * Retrieves the order information with hash @order_hash  of trading account that associated with that class instance
   * @param order_hash - The quote ERC20 symbol.*
   * @param mode - either will return ReducedOrder with mode == 2 or full info with mode = 1
   * @returns A Promise that resolves with the result Order or ReducedOrder
   */
  public async getOrder(
    order_hash: string,
    mode: number = 1,
  ): Promise<Result<ExtendedOrder | ReducedOrder>> {
    return await this.get<Result<ExtendedOrder | ReducedOrder>>(
      "/user/order",
      {
        mode,
        trading_account: this.tradingAccount,
        order_hash,
      },
      true,
      ["maker", "router_signer"],
    );
  }

  /**
   * Retrieves the order information with hash @order_hash  of trading account that associated with that class instance
   * @param mode - either will return ReducedOrder with mode == 2 or full info with mode = 1
   * @param limit - how many orders to retrieve in request, max is set to 20
   * @param offset -- offset from beginning
   * @returns A Promise that resolves with the result Order[] or ReducedOrder[]
   */
  public async getOrders(
    mode: number = 1,
    limit = 20,
    offset = 0,
  ): Promise<Result<ExtendedOrder[] | ReducedOrder[]>> {
    return await this.get(
      "/user/orders",
      {
        mode,
        trading_account: this.tradingAccount,
        limit,
        offset,
      },
      true,
      ["maker", "router_signer"],
    );
  }

  // finish that endpoints
  //  on exchange side update hash

  public async cancelOrder(
    req: CancelRequest,
    sign: [string, string],
  ): Promise<Result<string>> {
    return await this.post("/cancel_order", { ...req, sign }, false);
  }

  /**
   * Sending request to exchange to cancel specific order on exchange
   * req -- specific request that user signs by his private key to authorize action
   * @returns A Promise that resolves with the result hash of the req that was signed,
   * no errors would indicate that exchange accepted user request and put in processing queue, further details
   * one can obtain by listening on execution stream
   */
  public async cancelAll(
    req: CancelRequest,
    sign: [string, string],
  ): Promise<Result<string>> {
    return await this.post(
      "/cancel_all",
      {
        maker: req.maker,
        sign: sign,
        order_hash: 0,
        salt: req.salt,
      },
      false,
    );
  }

  /**
   * Sending request to exchange to withdraw specific token with specified amount to specified receiver
   * req -- specific request that user signs by his private key to authorize action
   * @returns A Promise that resolves with the result hash of the req that was signed,
   * no errors would indicate that exchange accepted user request and put in processing queue, further details
   * one can obtain by listening on execution stream
   */
  public async withdraw(
    req: Withdraw,
    sign: [string, string],
  ): Promise<Result<string>> {
    const { token, gas_fee, ...rest } = req;
    const requestBody = {
      ...rest,
      token: this.erc20ToAddress[token],
      sign,
      gas_fee: {
        ...gas_fee,
        fee_token: this.erc20ToAddress[gas_fee.fee_token],
      },
    };
    return await this.post("/withdraw", requestBody, false);
  }

  /**
   * Sending request to exchange to increase nonce onchain effectively invalidating all orders with nonce less
   * @returns A Promise that resolves with the result hash of the req that was signed,
   * no errors would indicate that exchange accepted user request and put in processing queue, further details
   * one can obtain by listening on execution stream
   */
  public async increaseNonce(
    req: IncreaseNonce,
    sign: [string, string],
  ): Promise<Result<string>> {
    const requestBody = {
      ...req,
      sign,
      gas_fee: {
        ...req.gas_fee,
        fee_token: this.erc20ToAddress[req.gas_fee.fee_token],
      },
    };
    return await this.post("/increase_nonce", requestBody, false);
  }

  /**
   * Sending request to exchange to place order
   * req -- specific request that user signs by his private key to authorize action
   * @returns A Promise that resolves with the result hash of the req that was signed,
   * no errors would indicate that exchange accepted user request and put in processing queue, further details
   * one can obtain by listening on execution stream
   */
  public async placeOrder(
    order: Order,
    sign: [string, string],
    router_sign: [string, string] = ["0", "0"],
  ): Promise<Result<string>> {
    const requestBody = {
      ...order,
      ticker: [
        this.erc20ToAddress[order.ticker.base],
        this.erc20ToAddress[order.ticker.quote],
      ],
      sign,
      router_sign,
      fee: {
        ...order.fee,
        gas_fee: {
          ...order.fee.gas_fee,
          fee_token: this.erc20ToAddress[order.fee.gas_fee.fee_token],
        },
      },
    };
    return await this.post("/place_order", requestBody, false);
  }
  /**
   * Fetches the user information from the API.
   *
   * @returns A promise that resolves to a Result object containing the UserInfo.
   */
  public async getUserInfo(): Promise<Result<UserInfo>> {
    return await this.get("/user/user_info", {
      trading_account: this.tradingAccount,
    });
  }

  /**
   * Fetches suggested conversion rate between tokens in case user need rate for order building
   *  @param token in what token we want to pay settlement
   * @returns A promise that resolves to a Result object containing the conversion rate
   */
  public async getConversionRate(
    token: ERC20Token,
  ): Promise<Result<[bigint, bigint]>> {
    return await this.get("/info/conversion_rate", {
      token,
    });
  }
  /**
   * Queries the steps specification from the API,steps would need to specify gas steps in order
   *
   * @returns A promise that resolves to a Result object containing the StepsConfiguration.
   */
  public async queryStepsSpecification(): Promise<Result<StepsConfiguration>> {
    return await this.get("/info/steps_specifications");
  }
  /**
   * Queries the ticker specifications from the API
   *
   * @returns A promise that resolves to a Result object containing an array of TickerSpecification.
   */
  public async queryTickerSpecification(): Promise<
    Result<TickerSpecification[]>
  > {
    return await this.get("/info/ticker_specifications");
  }

  /**
   * Queries the layerakira router specifications from the API
   *
   * @returns A promise that resolves to a Result object containing an array of RouterSpecification.
   */
  public async queryRouterSpecification(): Promise<
    Result<RouterSpecification>
  > {
    return await this.get("/info/router_details", undefined, false);
  }

  public async retrieveOldOrders() {
    // Not supported yet
    throw new Error("Not implemented");
  }

  /**
   * Generic fetch method for any API endpoint
   * @param apiPath Path to URL endpoint under API
   * @param query URL query params. Will be used to create a URLSearchParams object.
   * @param applyParseInt apply casting of integers in hex format and '\d+' to bigint
   * @param exclusionFields which fields should be omitted for casting
   * @returns @typeParam T The response from the API.
   */
  public async get<T>(
    apiPath: string,
    query: object = {},
    applyParseInt = true,
    exclusionFields: string[] = [],
  ): Promise<T> {
    const qs = this.objectToSearchParams(query);
    const url = `${this.apiBaseUrl}${apiPath}${qs.length > 0 ? "?" + qs : qs}`;
    return await this._fetch(url, applyParseInt, exclusionFields);
  }

  /**
   * Generic post method for any API endpoint.
   * @param apiPath Path to URL endpoint under API
   * @param body Data to send.
   * @param applyParseInt
   * @param exclusionFields
   * @param opts ethers ConnectionInfo, similar to Fetch API.
   * @returns @typeParam T The response from the API.
   */
  public async post<T>(
    apiPath: string,
    body: object,
    applyParseInt = true,
    exclusionFields: string[] = [],
    opts?: object,
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${apiPath}`;
    return await this._fetch(url, applyParseInt, exclusionFields, opts, body);
  }

  private objectToSearchParams(params: object = {}) {
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

  private async _fetch(
    url: string,
    applyParseInt = true,
    exclusionFields: string[] = [],
    headers?: object,
    body?: object,
  ) {
    const req = new ethers.FetchRequest(url);
    // Set the headers
    headers = {
      ...(this.jwtToken ? { Authorization: this.jwtToken } : {}),
      ...headers,
    };
    for (const [key, value] of Object.entries(headers)) {
      req.setHeader(key, value);
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
      `Sending request: ${url}, ${JSON.stringify({
        request: req,
        headers: req.headers,
        body: req.body,
      })}`,
    );
    try {
      const response = await req.send();
      if (!response.ok()) {
        // If an errors array is returned, throw with the error messages.
        const error = response.bodyJson?.error;
        if (error !== undefined) {
          this.isJWTInvalid =
            response.statusCode == 401 && error === AUTH_HEADER_INVALID_MSG;
          return response.bodyJson;
        } else {
          return { code: response.statusCode, message: response.bodyText };
        }
      }
      return applyParseInt
        ? convertToBigintRecursively(response.bodyJson, exclusionFields)
        : response.bodyJson;
    } catch (e: any) {
      return { code: NetworkIssueCode, exception: e };
    }
  }
}
