import { Signer, typedData } from "starknet";
import { bigIntReplacer, castToApiSignature } from "../src/api/http/utils";
import { BigNumberish } from "ethers";
import * as SDK from "../src";
import { SEPOLIA_TOKEN_MAPPING } from "../src";

jest.setTimeout(10000_000); // Disable timeout for all tests in this file

const TESTING_BASE_NET = "http://localhost:4435";
const TESTING_WS = "http://localhost:4436/ws";
const SN_SEPOLIA: BigNumberish = "0x534e5f5345504f4c4941";
const EXCHANGE_ADDRESS =
  "0x050cc69a427d0b7f0333d75106fffb69db389bdc750fc92479cf0beeff09a7e3";
const testAcc = {
  accountAddress:
    "0x033e29bc9B537BAe4e370559331E2bf35b434b566f41a64601b37f410f46a580",
  signer: "0x03e56dd52f96df3bc130f7a0b241dfed26b4a280d28a199e1e857f6d8acbb666",
  privateKey: process.env.PRIVATE_KEY,
};

const signer = new Signer(testAcc.privateKey);

let api: SDK.LayerAkiraHttpAPI; // Declare a variable to store the API instance
api = new SDK.LayerAkiraHttpAPI(
  { apiBaseUrl: TESTING_BASE_NET },
  { ETH: 18, AETH: 18, AUSDC: 6, AUSDT: 6, STRK: 18, USDC: 6, USDT: 6 },
  "STRK",
  (arg) => console.log(arg),
);

let orderBuilder = new SDK.OrderConstructor(
  testAcc.accountAddress,
  1,
  new SDK.TickerFeeMap([1000, 10000]),
  "0x42",
  42,
  4242,
  "STRK",
);

const withdrawBuilder = new SDK.WithdrawConstructor(
  testAcc.accountAddress,
  "0x42",
  150,
  "STRK",
);

describe("auth", () => {
  it("should give data but fails to auth", async () => {
    let res = await api.getSignData(testAcc.signer, testAcc.accountAddress);
    expect(res.code).toBeUndefined(),
      expect(res.error).toBeUndefined(),
      expect(res.result).toBeDefined();
    let jwtResult = await api.auth(res.result!, [
      "32478365843657432765",
      "4367563478256734285",
    ]);
    expect(jwtResult.code).toEqual(500);
  });

  it("should not give data", async () => {
    let res = await api.getSignData(testAcc.signer, "incorrect");
    expect(res).toEqual({ code: 500, error: "Wrong account" });
  });

  it("should auth and issue jwt", async () => {
    let res = await api.getSignData(testAcc.signer, testAcc.accountAddress);
    let signData = SDK.getTypedDataForJWT(
      res.result!,
      SDK.getDomain(SN_SEPOLIA),
    );
    let signature = await signer.signMessage(signData, testAcc.accountAddress);
    let jwtResult = await api.auth(res.result!, castToApiSignature(signature));
    console.log(res);
    expect(jwtResult.result).toBeDefined();
    //TODO: IS it ok practice given we execute tests sequentially?
    api.setCredentials(
      jwtResult.result!,
      testAcc.accountAddress,
      testAcc.signer,
    );
  });
});

describe("query market data info", () => {
  it("should query gas", async () => {
    let data: SDK.Result<BigNumberish> = await api.queryGasPrice();
    expect(data.result).toBeDefined();
    console.log(data);
  });

  it("should query ticker specification", async () => {
    let data = await api.queryTickerSpecification();
    expect(data.result).toBeDefined();
    console.log(data);
  });

  it("should query steps specification", async () => {
    let data = await api.queryStepsSpecification();
    expect(data.result).toBeDefined();
    console.log(data);
  });

  it("should query router specification", async () => {
    let data = await api.queryRouterSpecification();
    expect(data.result).toBeDefined();
    console.log(data);
    orderBuilder = new SDK.OrderConstructor(
      testAcc.accountAddress,
      1,
      new SDK.TickerFeeMap([1000, 1000]),
      data.result!.routerFeeRecipient,
      42,
      4242,
      "STRK",
      "layerakira",
      new SDK.TickerFeeMap([
        data.result!.routerMakerPbips,
        data.result!.routerTakerPbips,
      ]),
      data.result!.routerSigner,
      data.result!.routerFeeRecipient,
    );
  });

  it("should return bbo", async () => {
    let data = await api.getBBO("ETH", "STRK", false);
    expect(data.result).toBeDefined();
    console.log(data);
  });

  it("should return snapshot", async () => {
    let data = await api.getSnapshot("ETH", "STRK", false);
    expect(data.result).toBeDefined();
    console.log(data.result!.levels.asks);
  });
});

describe("query private data info", () => {
  it("should retrieve full orders", async () => {
    let data: SDK.ExtendedOrder[] = (await api.getOrders(1))?.result
      ?.data as SDK.ExtendedOrder[];
    expect(data).toBeDefined();
    console.log(data![0]);
  });

  it("should retrieve reduced orders", async () => {
    let data: SDK.ReducedOrder[] = (await api.getOrders(2))?.result
      ?.data as SDK.ReducedOrder[];
    expect(data).toBeDefined();
    console.log(data![0]);
  });

  it("should retrieve order", async () => {
    let orderHash =
      "1912959760723670115257370535391265296717133877252273262982767247879172384442";
    let data: SDK.Result<SDK.ReducedOrder> = (await api.getOrder(
      orderHash,
      2,
    )) as SDK.Result<SDK.ReducedOrder>;
    // expect(data.result).toBeDefined()
    console.log(data.result);
  });
  it("should not found retrieve order", async () => {
    let orderHash = "32424";
    let data: SDK.Result<SDK.ReducedOrder> = (await api.getOrder(
      orderHash,
      2,
    )) as SDK.Result<SDK.ReducedOrder>;
    // expect(data.result).toBeDefined()
    expect(data.code).toEqual(404);
    console.log(data);
  });

  it("should return balances info", async () => {
    let data = await api.getUserInfo();
    expect(data.result).toBeDefined();
    console.log(data.result!.fees);
    console.log(data.result!.balances);
  });
});

describe("query websocket key", () => {
  it("should get listen key for websockets", async () => {
    let data = await api.getListenKey();
    expect(data.result).toBeDefined();
    console.log(data);
  });
});

describe("sign check", () => {
  it("should not fail on sign check withdraw", async () => {
    let gasPriceResult = await api.queryGasPrice();
    const withdraw = withdrawBuilder.buildWithdraw(
      "STRK",
      1000n,
      gasPriceResult.result!,
    );

    let typedData = SDK.getWithdrawSignData(
      withdraw,
      SDK.getDomain(SN_SEPOLIA),
      SDK.SEPOLIA_TOKEN_MAPPING,
      EXCHANGE_ADDRESS,
    );
    console.log("f", typedData);
    let signature = await signer.signMessage(typedData, testAcc.accountAddress);
    let withdrawRes = await api.withdraw(
      withdraw,
      castToApiSignature(signature),
    );
    console.log(withdrawRes);
  });

  it("should not fail on sign check place order", async () => {
    let order = orderBuilder.buildSimpleRestingOrder(
      { pair: { base: "ETH", quote: "STRK" }, isEcosystemBook: false },
      1000_00000000000000000n,
      {
        base_qty: 100000000000000000n,
        quote_qty: 0n,
        base_asset: 1000000000000000000n,
      },
      SDK.OrderSide.SELL,
    );

    let typedData = SDK.getOrderSignData(
      order,
      SDK.getDomain(SN_SEPOLIA),
      SDK.SEPOLIA_TOKEN_MAPPING,
      EXCHANGE_ADDRESS,
    );
    let signature = await signer.signMessage(typedData, testAcc.accountAddress);
    let res = await api.placeOrder(order, castToApiSignature(signature));
    console.log(res);
  });

  it("should not fail on sign check place router order", async () => {
    let order = orderBuilder.buildSimpleRouterSwap(
      { base: "ETH", quote: "STRK" },
      1000_00000000000000000n,
      {
        base_qty: 100000000000000000n,
        quote_qty: 0n,
        base_asset: 1000000000000000000n,
      },
      10,
      SDK.OrderSide.SELL,
      10000n,
      true,
      100000n,
    );

    let typedData = SDK.getOrderSignData(
      order,
      SDK.getDomain(SN_SEPOLIA),
      SDK.SEPOLIA_TOKEN_MAPPING,
      EXCHANGE_ADDRESS,
    );
    let signature = await signer.signMessage(typedData, testAcc.accountAddress);
    let res = await api.placeOrder(order, castToApiSignature(signature));
    console.log(res);
    console.log("HERE");
  });

  it("should not fail on sign check cancel order", async () => {
    let cancel: SDK.CancelRequest = {
      maker: testAcc.accountAddress,
      order_hash: "1",
      salt: 42n,
    };
    let typedData = SDK.getCancelOrderSignData(
      cancel,
      SDK.getDomain(SN_SEPOLIA),
    );
    let signature = await signer.signMessage(typedData, testAcc.accountAddress);
    let res = await api.cancelOrder(
      cancel,
      castToApiSignature(signature) as [string, string],
    );
    console.log(res);
  });

  it("should not fail on sign check cancel all orders", async () => {
    let cancel: SDK.CancelRequest = {
      maker: testAcc.accountAddress,
      order_hash: null,
      salt: 42n,
      ticker: {
        pair: { base: "ETH", quote: "STRK" },
        isEcosystemBook: false,
      },
    };
    let typedData = SDK.getCancelOrderSignData(
      cancel,
      SDK.getDomain(SN_SEPOLIA),
      SEPOLIA_TOKEN_MAPPING,
    );
    let signature = await signer.signMessage(typedData, testAcc.accountAddress);
    let res = await api.cancelAll(cancel, castToApiSignature(signature));
    console.log(res);
  });

  it("should not fail on sign check cancel all onchain orders", async () => {
    let cancelAll: SDK.IncreaseNonce = {
      maker: testAcc.accountAddress,
      gas_fee: {
        gas_per_action: 150,
        fee_token: "STRK",
        max_gas_price: 10000n,
        conversion_rate: [1n, 1n],
      },
      new_nonce: 1,
      salt: 42n,
    };
    let ttypedData = SDK.getCancelAllOnchainOrderSignData(
      cancelAll,
      SDK.getDomain(SN_SEPOLIA),
      SDK.SEPOLIA_TOKEN_MAPPING,
    );
    console.log(
      `hash type ${typedData.getTypeHash(ttypedData.types, ttypedData.primaryType)}`,
    );
    let signature = await signer.signMessage(
      ttypedData,
      testAcc.accountAddress,
    );
    let res = await api.increaseNonce(cancelAll, castToApiSignature(signature));
    console.log(res);
  });
});

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("websockets", () => {
  it("connect and data consume example", async () => {
    const wsClient = new SDK.LayerAkiraWSSAPI(
      TESTING_WS,
      api,
      true,
      (arg) => {
        console.log(arg);
      },
      1000,
    );
    wsClient.connect();
    await timeout(1000);

    async function handler(evt: any) {
      console.log(`Consume received ${JSON.stringify(evt, bigIntReplacer)}`);
    }

    const ticker = {
      pair: { base: "ETH", quote: "USDC" },
      isEcosystemBook: false,
    };
    let result = await wsClient.subscribeOnMarketData(
      handler,
      SDK.SocketEvent.BOOK_DELTA,
      ticker,
      5000,
    );
    console.log(result);

    result = await wsClient.subscribeOnMarketData(
      handler,
      SDK.SocketEvent.BBO,
      ticker,
    );
    console.log(result);

    result = await wsClient.subscribeOnMarketData(
      handler,
      SDK.SocketEvent.TRADE,
      ticker,
    );
    console.log(result);

    result = await wsClient.subscribeOnExecReport(handler);
    console.log(result);
    await timeout(3 * 1000);

    console.log(await wsClient.unSubscribeFromExecReport());
    console.log(
      await wsClient.unSubscribeFromMarketData(
        SDK.SocketEvent.BOOK_DELTA,
        ticker,
      ),
    );
    console.log(
      await wsClient.unSubscribeFromMarketData(
        SDK.SocketEvent.BOOK_DELTA,
        ticker,
      ),
    );
    console.log(
      await wsClient.unSubscribeFromMarketData(SDK.SocketEvent.BBO, ticker),
    );
    console.log(
      await wsClient.unSubscribeFromMarketData(SDK.SocketEvent.TRADE, ticker),
    );

    await timeout(5 * 1000);
    wsClient.close();
    await timeout(2 * 1000);
  });

  it("run and test the changes in depthbook", async () => {
    const wsClient = new SDK.LayerAkiraWSSAPI(
      TESTING_WS,
      api,
      true,
      (arg) => {
        console.log(arg);
      },
      1000,
    );
    wsClient.connect();
    await timeout(1000);

    const ticker = {
      pair: { base: "ETH", quote: "USDC" },
      isEcosystemBook: false,
    };

    const depthBook = new SDK.DepthBook(api, wsClient, [ticker], (arg) => {
      console.log(arg);
    });

    await depthBook.run();
    let interval = setInterval(() => {
      console.log("table: ", depthBook.getBook(ticker.pair));
    }, 1000);

    await timeout(10 * 1000);
    clearInterval(interval);
    wsClient.close();
    await timeout(3 * 1000);
  });
});
