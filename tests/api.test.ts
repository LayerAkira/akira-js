
import {Signer} from "starknet";
import {castToApiSignature} from "../src/api/utils";
import {BigNumberish} from "ethers";
import * as SDK from "../src"

const TESTING_BASE_NET = "http://localhost:4431"
const SN_SEPOLIA: BigNumberish = "0x534e5f5345504f4c4941"

const test_acc = {
    account_address: '0x033e29bc9B537BAe4e370559331E2bf35b434b566f41a64601b37f410f46a580',
    signer: '0x03e56dd52f96df3bc130f7a0b241dfed26b4a280d28a199e1e857f6d8acbb666',
    private_key: "place own"
}

const signer = new Signer(test_acc.private_key)

let api: SDK.LayerAkiraHttpAPI; // Declare a variable to store the API instance
api = new SDK.LayerAkiraHttpAPI({apiBaseUrl: TESTING_BASE_NET}, SDK.SEPOLIA_TOKEN_MAPPING,
    // (arg) => console.log(arg)
);

describe('auth', () => {
    it('should give data but fails to auth', async () => {
        let res = await api.getSignData(test_acc.signer, test_acc.account_address)
        expect(res.code).toBeUndefined(), expect(res.error).toBeUndefined(), expect(res.result).toBeDefined()
        let jwtResult = await api.auth(res.result, ['32478365843657432765', '4367563478256734285'])
        expect(jwtResult).toEqual({code: 500, error: 'Invalid signature'})
    });

    it('should not give data', async () => {
        let res = await api.getSignData(test_acc.signer, 'incorrect')
        expect(res).toEqual({code: 500, error: 'Wrong account'})
    });

    it('should auth and issue jwt', async () => {
        let res = await api.getSignData(test_acc.signer, test_acc.account_address)
        let signData = SDK.getTypedDataForJWT(res.result, SDK.getDomain(SN_SEPOLIA))
        let signature = await signer.signMessage(signData, test_acc.account_address)
        let jwtResult = await api.auth(res.result, castToApiSignature(signature))
        console.log(res);
        expect(jwtResult.result).toBeDefined()
        //TODO: IS it ok practice given we execute tests sequentially?
        api.setCredentials(jwtResult.result, test_acc.account_address)
    });
});

describe('query market data info', () => {
    it('should query gas', async () => {
        let data: SDK.Result<BigNumberish> = await api.queryGasPrice()
        expect(data.result).toBeDefined()
        console.log(data)
    })

    it('should return bbo', async () => {
        let data = await api.getBBO('ETH', 'STRK', false)
        expect(data.result).toBeDefined()
        console.log(data)
    })

    it('should return snapshot', async () => {
        let data = await api.getSnapshot('ETH', 'STRK', false)
        expect(data.result).toBeDefined()
        console.log(data.result.levels.asks)
        console.log(data)
    })
})

describe('query private data info', () => {

    it('should retrieve full orders', async () => {
        let data: SDK.Result<SDK.ExtendedOrder[]> = await api.getOrders(1) as SDK.Result<SDK.ExtendedOrder[]>
        expect(data.result).toBeDefined()
        console.log(data.result[0])
    })

    it('should retrieve reduced orders', async () => {
        let data: SDK.Result<SDK.ReducedOrder[]> = await api.getOrders(2) as SDK.Result<SDK.ReducedOrder[]>
        expect(data.result).toBeDefined()
        console.log(data.result[0])
    })

    it('should retrieve order', async () => {
        let orderHash = '1912959760723670115257370535391265296717133877252273262982767247879172384442'
        let data: SDK.Result<SDK.ReducedOrder> = await api.getOrder(orderHash, 2) as SDK.Result<SDK.ReducedOrder>
        // expect(data.result).toBeDefined()
        console.log(data.result)
    })
    it('should not found retrieve order', async () => {
        let orderHash = '32424'
        let data: SDK.Result<SDK.ReducedOrder> = await api.getOrder(orderHash, 2) as SDK.Result<SDK.ReducedOrder>
        // expect(data.result).toBeDefined()
        expect(data.code).toEqual(404)
        console.log(data)
    })

    it('should return balances info', async () => {
        let data = await api.getUserInfo()
        expect(data.result).toBeDefined()
        console.log(data.result.fees)
        console.log(data.result.balances)
    })
})

describe('query websocket key', () => {
    it('should get listen key for websockets', async () => {
        let data = await api.getListenKey()
        expect(data.result).toBeDefined()
        console.log(data)
    })
})

describe('sign check', () => {
    it('should not fail on sign check withdraw', async () => {
        let gasPriceResult = await api.queryGasPrice()
        let withdraw: SDK.Withdraw = {
            maker: test_acc.account_address,
            token: 'STRK', amount: 1000, salt: '23432423', gas_fee: {
                gas_per_action: 150, fee_token: 'STRK', max_gas_price: gasPriceResult.result,
                conversion_rate: [1, 1],
            }, receiver: test_acc.account_address,
        }
        let typedData = SDK.getWithdrawSignData(withdraw, SDK.getDomain(SN_SEPOLIA), SDK.SEPOLIA_TOKEN_MAPPING)
        let signature = await signer.signMessage(typedData, test_acc.account_address)
        let withdrawRes = await api.withdraw(withdraw, castToApiSignature(signature))
        console.log(withdrawRes)
    });

    it('should not fail on sign check place order', async () => {
        let maker: BigNumberish = '0x1'
        let order: SDK.Order = {
            maker: test_acc.account_address, price: 1000_00000000000000000,
            qty: {base_qty: 100000000000000000, quote_qty: 0, base_asset: 1000000000000000000},
            flags: {
                best_level_only: true, external_funds: false, full_fill_only: true, is_market_order: false,
                is_sell_side: true, post_only: false, to_ecosystem_book: true
            },
            version: 0, salt: 43,
            constraints: {
                created_at: 4242, duration_valid: 120, min_receive_amount: 0,
                nonce: 0, number_of_swaps_allowed: 2, router_signer: '0x0', stp: 1
            },
            fee: {
                gas_fee: {conversion_rate: ['1', '1'], fee_token: 'STRK', gas_per_action: 150, max_gas_price: 25},
                router_fee: {maker_pbips: 100, recipient: maker, taker_pbips: 200},
                trade_fee: {maker_pbips: 0, recipient: maker, taker_pbips: 0}
            },
            ticker: {base: 'ETH', quote: 'STRK'},
        }
        let typedData = SDK.getOrderSignData(order, SDK.getDomain(SN_SEPOLIA), SDK.SEPOLIA_TOKEN_MAPPING)
        let signature = await signer.signMessage(typedData, test_acc.account_address)
        let res = await api.placeOrder(order, castToApiSignature(signature))
        console.log(res)
    });

    it('should not fail on sign check cancel order', async () => {
        let cancel: SDK.CancelRequest = {maker: test_acc.account_address, order_hash: '1', salt: 42}
        let typedData = SDK.getCancelOrderSignData(cancel, SDK.getDomain(SN_SEPOLIA))
        let signature = await signer.signMessage(typedData, test_acc.account_address)
        let res = await api.cancelOrder(cancel, castToApiSignature(signature))
        console.log(res)
    });

    it('should not fail on sign check cancel all orders', async () => {
        let cancel: SDK.CancelRequest = {maker: test_acc.account_address, order_hash: null, salt: 42}
        let typedData = SDK.getCancelOrderSignData(cancel, SDK.getDomain(SN_SEPOLIA))
        let signature = await signer.signMessage(typedData, test_acc.account_address)
        let res = await api.cancelAll(cancel, castToApiSignature(signature))
        console.log(res)
    });

    it('should not fail on sign check cancel all onchain orders', async () => {
        let cancelAll: SDK.IncreaseNonce = {
            maker: test_acc.account_address, gas_fee: {
                gas_per_action: 150, fee_token: 'STRK', max_gas_price: 10000,
                conversion_rate: [1, 1],
            }, new_nonce: 1, salt: 42
        }
        let typedData = SDK.getCancelAllOnchainOrderSignData(cancelAll, SDK.getDomain(SN_SEPOLIA), SDK.SEPOLIA_TOKEN_MAPPING)
        let signature = await signer.signMessage(typedData, test_acc.account_address)
        let res = await api.increaseNonce(cancelAll, castToApiSignature(signature))
        console.log(res)
    });

})



