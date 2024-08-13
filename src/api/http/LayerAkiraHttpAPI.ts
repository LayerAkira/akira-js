import { Address } from "../../types";
import { BigNumberish, ethers, toUtf8Bytes } from "ethers";
import { SignData, NetworkIssueCode } from "./types";
import {
  bigIntReplacer,
  convertFieldsRecursively,
  convertToBigintRecursively,
  stall,
} from "./utils";
import {
  CancelRequest,
  ERC20Token,
  ERCToDecimalsMap,
  ExtendedOrder,
  IncreaseNonce,
  Order,
  ReducedOrder,
  TraderSignature,
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
import {
  bigIntToFormattedDecimal,
  formattedDecimalToBigInt,
  parseTableLvl,
} from "../utils";

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
  public readonly erc20ToDecimals: ERCToDecimalsMap;
  public isJWTInvalid: boolean = false;
  private jwtToken: string | undefined;
  private tradingAccount: Address | undefined;
  private signer: Address | undefined;
  private timeoutMillis: number;
  private baseFeeToken: ERC20Token;

  /**
   * Logger function to use when debugging
   */
  public logger: (arg: string) => void;

  constructor(
    config: LayerAkiraHttpConfig,
    erc20ToDecimals: ERCToDecimalsMap,
    baseFeeToken: ERC20Token,
    logger?: (arg: string) => void,
    timeoutMillis?: number,
  ) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.jwtToken = config.jwt;
    this.tradingAccount = config.tradingAccount;
    this.signer = config.signer;
    this.logger = logger ?? ((arg: string) => arg);
    this.timeoutMillis = timeoutMillis ?? 10 * 1000;
    this.erc20ToDecimals = erc20ToDecimals;
    this.baseFeeToken = baseFeeToken;
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
    signature: TraderSignature,
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
    return await this.get(
      "/book/bbo",
      {
        base: base,
        quote: quote,
        to_ecosystem_book: +to_ecosystem_book,
      },
      true,
      [],
      (o: any) => {
        const b = this.erc20ToDecimals[base];
        const q = this.erc20ToDecimals[quote];
        if (o.bid) o.bid = parseTableLvl(o.bid, b, q);
        if (o.ask) o.ask = parseTableLvl(o.ask, b, q);
        return o;
      },
    );
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
    return await this.get(
      "/book/snapshot",
      {
        base: base,
        quote: quote,
        to_ecosystem_book: +to_ecosystem_book,
        levels: levels,
      },
      true,
      [],
      (o: any) => {
        o.levels.bids = o.levels.bids.map((lst: any) =>
          parseTableLvl(
            lst,
            this.erc20ToDecimals[base],
            this.erc20ToDecimals[quote],
          ),
        );
        o.levels.asks = o.levels.asks.map((lst: any) =>
          parseTableLvl(
            lst,
            this.erc20ToDecimals[base],
            this.erc20ToDecimals[quote],
          ),
        );
        return o;
      },
    );
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
      (o: any) => this.parseOrder(o),
    );
  }

  /**
   * Retrieves the order information with hash @order_hash  of trading account that associated with that class instance
   * @param mode - either will return ReducedOrder with mode == 2 or full info with mode = 1
   * @param limit - how many orders to retrieve in request, max is set to 20
   * @param offset -- offset from beginning
   * @param active -- active parameter indicates whether to return only active or inactive orders.
   * @param cursor -- cursor
   * @returns A Promise that resolves with the result {}data: Order[] or ReducedOrder[], cursor}
   */
  public async getOrders(
    mode: number = 1,
    limit = 20,
    offset = 0,
    active = false,
    cursor?: string,
  ): Promise<
    Result<{ data: ExtendedOrder[] | ReducedOrder[]; cursor: string | null }>
  > {
    return await this.get(
      "/user/orders",
      {
        mode,
        trading_account: this.tradingAccount,
        limit,
        offset,
        active,
        cursor,
      },
      true,
      ["maker", "router_signer"],
      (o: any) => o.map((e: any) => this.parseOrder(e)),
    );
  }

  public async cancelOrder(
    req: CancelRequest,
    sign: [string, string],
  ): Promise<Result<string>> {
    return await this.post(
      "/cancel_order",
      {
        ...req,
        ticker: { base: "0x0", quote: "0x0", to_ecosystem_book: false },
        sign,
      },
      false,
    );
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
    sign: TraderSignature,
  ): Promise<Result<string>> {
    return await this.post(
      "/cancel_all",
      {
        maker: req.maker,
        sign: sign,
        order_hash: 0,
        salt: req.salt,
        ticker: {
          base: req.ticker!.pair.base,
          quote: req.ticker!.pair.quote,
          to_ecosystem_book: req.ticker!.isEcosystemBook,
        },
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
    sign: TraderSignature,
  ): Promise<Result<string>> {
    const { token, gas_fee, ...rest } = req;
    const requestBody = {
      ...rest,
      token: token,
      amount: bigIntToFormattedDecimal(req.amount, this.erc20ToDecimals[token]),
      sign,
      gas_fee: {
        ...gas_fee,
        fee_token: gas_fee.fee_token,
        max_gas_price: bigIntToFormattedDecimal(
          req.gas_fee.max_gas_price,
          this.erc20ToDecimals[this.baseFeeToken],
        ),
        conversion_rate: [
          bigIntToFormattedDecimal(
            req.gas_fee.conversion_rate[0],
            this.erc20ToDecimals[this.baseFeeToken],
          ),
          bigIntToFormattedDecimal(
            req.gas_fee.conversion_rate[1],
            this.erc20ToDecimals[req.gas_fee.fee_token],
          ),
        ],
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
    sign: TraderSignature,
  ): Promise<Result<string>> {
    const requestBody = {
      ...req,
      sign,
      gas_fee: {
        ...req.gas_fee,
        fee_token: req.gas_fee.fee_token,
        max_gas_price: bigIntToFormattedDecimal(
          req.gas_fee.max_gas_price,
          this.erc20ToDecimals[this.baseFeeToken],
        ),
        conversion_rate: [
          bigIntToFormattedDecimal(
            req.gas_fee.conversion_rate[0],
            this.erc20ToDecimals[this.baseFeeToken],
          ),
          bigIntToFormattedDecimal(
            req.gas_fee.conversion_rate[1],
            this.erc20ToDecimals[req.gas_fee.fee_token],
          ),
        ],
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
    sign: TraderSignature,
    router_sign: [string, string] = ["0", "0"],
  ): Promise<Result<string>> {
    const minReceive = order.constraints.min_receive_amount;
    const requestBody = {
      ...order,
      ticker: [order.ticker.base, order.ticker.quote],
      sign,
      router_sign,
      price: bigIntToFormattedDecimal(
        order.price,
        this.erc20ToDecimals[order.ticker.quote],
      ),
      qty: {
        base_qty: bigIntToFormattedDecimal(
          order.qty.base_qty,
          this.erc20ToDecimals[order.ticker.base],
        ),
        quote_qty: bigIntToFormattedDecimal(
          order.qty.quote_qty,
          this.erc20ToDecimals[order.ticker.quote],
        ),
      },
      fee: {
        ...order.fee,
        gas_fee: {
          ...order.fee.gas_fee,
          fee_token: order.fee.gas_fee.fee_token,
          max_gas_price: bigIntToFormattedDecimal(
            order.fee.gas_fee.max_gas_price,
            this.erc20ToDecimals[this.baseFeeToken],
          ),
          conversion_rate: [
            bigIntToFormattedDecimal(
              order.fee.gas_fee.conversion_rate[0],
              this.erc20ToDecimals[this.baseFeeToken],
            ),
            bigIntToFormattedDecimal(
              order.fee.gas_fee.conversion_rate[1],
              this.erc20ToDecimals[order.fee.gas_fee.fee_token],
            ),
          ],
        },
      },
      constraints: {
        ...order.constraints,
        min_receive_amount: bigIntToFormattedDecimal(
          minReceive,
          this.erc20ToDecimals[
            order.flags.is_sell_side ? order.ticker.quote : order.ticker.base
          ],
        ),
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
    return await this.get(
      "/user/user_info",
      {
        trading_account: this.tradingAccount,
      },
      true,
      [],
      (o: any) => {
        o.balances = o.balances.map((e: any) => {
          return {
            token: e.token,
            balance: formattedDecimalToBigInt(
              e.balance,
              this.erc20ToDecimals[e.token],
            ),
            locked: e.locked[this.erc20ToDecimals[e.token]],
          };
        });
        return o;
      },
    );
  }

  /**
   * Fetches suggested conversion rate between tokens in case user need rate for order building
   *  @param token in what token we want to pay settlement
   * @returns A promise that resolves to a Result object containing the conversion rate
   */
  public async getConversionRate(
    token: ERC20Token,
  ): Promise<Result<[bigint, bigint]>> {
    console.log("HEY");
    return await this.get(
      "/info/conversion_rate",
      {
        token,
      },
      false,
      [],
      (e: any) => {
        console.log("DAMn");
        if (e.length == 0) return e;
        e[0] = formattedDecimalToBigInt(
          e[0],
          this.erc20ToDecimals[this.baseFeeToken],
        );
        e[1] = formattedDecimalToBigInt(e[1], this.erc20ToDecimals[token]);
        return e;
      },
    );
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
    preApplyParser?: (o: any) => any,
  ): Promise<T> {
    const qs = this.objectToSearchParams(query);
    const url = `${this.apiBaseUrl}${apiPath}${qs.length > 0 ? "?" + qs : qs}`;
    return await this._fetch(
      url,
      applyParseInt,
      exclusionFields,
      undefined,
      undefined,
      preApplyParser,
    );
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
    preApplyParser?: (o: any) => any,
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${apiPath}`;
    return await this._fetch(
      url,
      applyParseInt,
      exclusionFields,
      opts,
      body,
      preApplyParser,
    );
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
    preApplyParser?: (o: any) => any,
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
      return { code: NetworkIssueCode, exception: e };
    }
  }

  private parseOrder(o: any) {
    o = convertFieldsRecursively(
      o,
      new Set([
        "limit_price",
        "price",
        "filled_quote_amount",
        "quote_qty",
        "failed_quote_amount",
        "",
      ]),
      (e) =>
        e !== undefined && e !== null
          ? formattedDecimalToBigInt(e, this.erc20ToDecimals[o.ticker.quote])
          : e,
    );
    o = convertFieldsRecursively(
      o,
      new Set(["filled_base_amount", "base_qty", "failed_base_amount"]),
      (e) =>
        e !== undefined && e !== null
          ? formattedDecimalToBigInt(e, this.erc20ToDecimals[o.ticker.quote])
          : e,
    );
    if (o.fee)
      o.fee.gas_fee.max_gas_price = formattedDecimalToBigInt(
        o.fee.gas_fee.max_gas_price,
        this.erc20ToDecimals[this.baseFeeToken],
      );
    if (o?.state?.reimbursement)
      o!.state!.reimbursement = BigInt(o?.state?.reimbursement);
    if (o?.state?.gas_paid) o!.state!.gas_paid = BigInt(o?.state?.gas_paid);
    if (o?.state?.paid_fee_as_maker)
      o!.state!.paid_fee_as_maker = BigInt(o?.state?.paid_fee_as_maker);
    if (o?.state?.paid_fee_as_taker)
      o!.state!.paid_fee_as_taker = BigInt(o?.state?.paid_fee_as_taker);
    return o;
  }
}
