import {Address} from "../general_types";
import {BigNumberish, ethers} from "ethers";
import {LayerAkiraConfig, SignData, Result, TokenAddressMap} from "./types";
import {stall} from "./utils";
import {
    CancelRequest,
    ERC20Token,
    ExtendedOrder,
    IncreaseNonce,
    Order,
    ReducedOrder,
    Withdraw
} from "@/request_types.ts";
import {BBO, Snapshot, UserInfo} from "@/response_types.ts";


/**
 * The API class for the LayerAkira SDK.
 * @category Main Classes
 */
export class LayerAkiraHttpAPI {
    /**
     * Base url for the API
     */
    public readonly apiBaseUrl: string;
    private readonly erc20ToAddress: TokenAddressMap;
    private jwtToken: string | undefined;
    private tradingAccount: Address | undefined

    /**
     * Logger function to use when debugging
     */
    public logger: (arg: string) => void;

    constructor(config: LayerAkiraConfig, erc20ToAddress: TokenAddressMap, logger?: (arg: string) => void) {
        this.apiBaseUrl = config.apiBaseUrl;
        this.erc20ToAddress = erc20ToAddress
        this.jwtToken = config.jwt
        this.tradingAccount = config.tradingAccount
        this.logger = logger ?? ((arg: string) => arg);
    }

    /**
     * @param signer - public key that is responsible for signing action on behalf of account
     * @param account - trading account
     * Retrieves data that client need to sign via private key of @signer to show that he is real owner of account
     * @returns A Promise that resolves with the result of SignData
     */
    public async getSignData(signer: Address, account: Address): Promise<Result<SignData>> {
        return await this.get<Result<SignData>>(
            `/sign/request_sign_data?user=${signer}&account=${account}`
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
    public async auth(msg: BigNumberish, signature: [string, string]): Promise<Result<string>> {
        return await this.post('/sign/auth', {'msg': msg, 'signature': signature})
    }

    /**
     * Set jwt token and trading account for this instance so client can reach endpoints which requires authorization
     */
    public setCredentials(jwtToken: string, tradingAccount: Address) {
        this.jwtToken = jwtToken;
        this.tradingAccount = tradingAccount;
    }

    /**
     * Retrieves gas price that client would need to specify with some premium when sending some trading actions to LayerAkira
     * which would require onchain fingerprint
     * @returns A Promise that resolves with the gas price result
     */
    public async queryGasPrice(): Promise<Result<BigNumberish>> {
        return await this.get('/gas/price')
    }

    /**
     * Retrieves the Best Bid and Offer (BBO) from the specified trading pair
     * @param base - The base ERC20 symbol.
     * @param quote - The quote ERC20 symbol.
     * @param to_ecosystem_book - Indicates whether to retrieve BBO from the ecosystem book or router book
     * @returns A Promise that resolves with the BBO result.
     */
    public async getBBO(base: ERC20Token, quote: ERC20Token, to_ecosystem_book: boolean): Promise<Result<BBO>> {
        return await this.get('/book/bbo',
            {
                base: this.erc20ToAddress[base],
                quote: this.erc20ToAddress[quote], to_ecosystem_book: +to_ecosystem_book
            })
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
    public async getSnapshot(base: ERC20Token, quote: ERC20Token, to_ecosystem_book: boolean, levels: number = -1): Promise<Result<Snapshot>> {
        return await this.get('/book/snapshot', {
            base: this.erc20ToAddress[base],
            quote: this.erc20ToAddress[quote], to_ecosystem_book: +to_ecosystem_book, levels: levels
        })
    }

    /**
     * Retrieves the listen key to be able to subscribe to market data streams over websockets
     * @returns A Promise that resolves with the result of listen token
     */
    public async getListenKey(): Promise<Result<string>> {
        return await this.get('/user/listen_key')
    }

    /**
     * Retrieves the order information with hash @order_hash  of trading account that associated with that class instance
     * @param order_hash - The quote ERC20 symbol.*
     * @param mode - either will return ReducedOrder with mode == 2 or full info with mode = 1
     * @returns A Promise that resolves with the result Order or ReducedOrder
     */
    public async getOrder(order_hash: string, mode: number = 1): Promise<Result<ExtendedOrder | ReducedOrder>> {
        return await this.get<Result<ExtendedOrder | ReducedOrder>>('/user/order', {
            mode,
            trading_account: this.tradingAccount,
            order_hash
        })
    }

    /**
     * Retrieves the order information with hash @order_hash  of trading account that associated with that class instance
     * @param mode - either will return ReducedOrder with mode == 2 or full info with mode = 1
     * @param limit - how many orders to retrieve in request, max is set to 20
     * @param offset -- offset from beginning
     * @returns A Promise that resolves with the result Order[] or ReducedOrder[]
     */
    public async getOrders(mode: number = 1, limit = 20, offset = 0): Promise<Result<ExtendedOrder[] | ReducedOrder[]>> {
        return await this.get('/user/orders', {mode, trading_account: this.tradingAccount, limit, offset})
    }

    // finish that endpoints
    //  on exchange side update hash

    public async cancelOrder(req: CancelRequest, sign: [string, string]): Promise<Result<string>> {
        return await this.post('/cancel_order', {...req, sign})
    }

    /**
     * Sending request to exchange to cancel specific order on exchange
     * req -- specific request that user signs by his private key to authorize action
     * @returns A Promise that resolves with the result hash of the req that was signed,
     * no errors would indicate that exchange accepted user request and put in processing queue, further details
     * one can obtain by listening on execution stream
     */
    public async cancelAll(req: CancelRequest, sign: [string, string]): Promise<Result<string>> {
        return await this.post('/cancel_all', {
            'maker': req.maker, 'sign': sign, 'order_hash': 0, 'salt': req.salt
        })
    }

    /**
     * Sending request to exchange to withdraw specific token with specified amount to specified receiver
     * req -- specific request that user signs by his private key to authorize action
     * @returns A Promise that resolves with the result hash of the req that was signed,
     * no errors would indicate that exchange accepted user request and put in processing queue, further details
     * one can obtain by listening on execution stream
     */
    public async withdraw(req: Withdraw, sign: [string, string]): Promise<Result<string>> {
        const {token, gas_fee, ...rest} = req;
        const requestBody = {
            ...rest, token: this.erc20ToAddress[token], sign, gas_fee: {
                ...gas_fee, fee_token: this.erc20ToAddress[gas_fee.fee_token]
            },
        }
        return await this.post('/withdraw', requestBody)
    }

    /**
     * Sending request to exchange to increase nonce onchain effectively invalidating all orders with nonce less
     * @returns A Promise that resolves with the result hash of the req that was signed,
     * no errors would indicate that exchange accepted user request and put in processing queue, further details
     * one can obtain by listening on execution stream
     */
    public async increaseNonce(req: IncreaseNonce, sign: [string, string]): Promise<Result<string>> {
        const requestBody = {
            ...req, sign, gas_fee: {...req.gas_fee, fee_token: this.erc20ToAddress[req.gas_fee.fee_token]}
        }
        return await this.post('/increase_nonce', requestBody)
    }


    /**
     * Sending request to exchange to place order
     * req -- specific request that user signs by his private key to authorize action
     * @returns A Promise that resolves with the result hash of the req that was signed,
     * no errors would indicate that exchange accepted user request and put in processing queue, further details
     * one can obtain by listening on execution stream
     */
    public async placeOrder(order: Order, sign: [string, string], router_sign: [string, string] = ['0', '0']): Promise<Result<string>> {
        const requestBody = {
            ...order, ticker: [this.erc20ToAddress[order.ticker.base], this.erc20ToAddress[order.ticker.quote]],
            sign, router_sign, fee: {
                ...order.fee,
                gas_fee: {...order.fee.gas_fee, fee_token: this.erc20ToAddress[order.fee.gas_fee.fee_token]},
            }
        }
        return await this.post('/place_order', requestBody)
    }


    public async getUserInfo(): Promise<Result<UserInfo>> {
        return await this.get('/user/user_info', {trading_account: this.tradingAccount});
    }

    public async retrieveOldOrders() {
        // Not supported yet
        throw new Error("Not implemented");
    }

    /**
     * Generic fetch method for any API endpoint
     * @param apiPath Path to URL endpoint under API
     * @param query URL query params. Will be used to create a URLSearchParams object.
     * @returns @typeParam T The response from the API.
     */
    public async get<T>(apiPath: string, query: object = {}): Promise<T> {
        const qs = this.objectToSearchParams(query);
        const url = `${this.apiBaseUrl}${apiPath}${qs.length > 0 ? ("?" + qs) : qs}`;
        // console.log(qs)
        return await this._fetch(url);
    }

    /**
     * Generic post method for any API endpoint.
     * @param apiPath Path to URL endpoint under API
     * @param body Data to send.
     * @param opts ethers ConnectionInfo, similar to Fetch API.
     * @returns @typeParam T The response from the API.
     */
    public async post<T>(
        apiPath: string,
        body?: object,
        opts?: object,
    ): Promise<T> {
        const url = `${this.apiBaseUrl}${apiPath}`;
        return await this._fetch(url, opts, body);
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

    private async _fetch(url: string, headers?: object, body?: object) {

        const req = new ethers.FetchRequest(url);
        // Set the headers
        headers = {
            ...(this.jwtToken ? {"Authorization": this.jwtToken} : {}),
            ...headers,
        };
        for (const [key, value] of Object.entries(headers)) {
            req.setHeader(key, value);
        }
        if (body) {
            req.body = body;
        }
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
                body: req.body
            })}`,
        );
        const response = await req.send();
        if (!response.ok()) {
            // If an errors array is returned, throw with the error messages.
            const error = response.bodyJson?.error;
            if (error !== undefined) {
                return response.bodyJson
            } else {
                // Otherwise, let ethers throw a SERVER_ERROR since it will include
                // more context about the request and response.
                response.assertOk();
            }
        }
        return response.bodyJson;
    }
}