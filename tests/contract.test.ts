import * as STARKNETJS from "starknet";
import { BigNumberish } from "ethers";

import * as SDK from "../src";

export const TEST_EXCHANGE_ADDRESS: SDK.Address =
  "0x046dbba96f861e1dfb7084e7b7dfc98ed38a682e43cbcd9a7c4c3876e1495922";
const trader =
  "0x033e29bc9B537BAe4e370559331E2bf35b434b566f41a64601b37f410f46a580";
const SN_SEPOLIA: BigNumberish = "0x534e5f5345504f4c4941";

let akira: SDK.LayerAkiraContract;

beforeAll(async () => {
  const rpc = new STARKNETJS.RpcProvider({
    nodeUrl: "https://free-rpc.nethermind.io/sepolia-juno/v0_7",
  });
  let abi = await SDK.getContractAbi(TEST_EXCHANGE_ADDRESS, rpc);
  akira = new SDK.LayerAkiraContract(TEST_EXCHANGE_ADDRESS, abi.result!, rpc);
});

describe("Layer akira contract", () => {
  it("It should query trade event", async () => {
    const events = await akira.getTradeEventsFor(trader, 68180, 68180);
    expect(events.result).toBeDefined();
    expect(events.result!.events.length).toEqual(1);
    console.log(events.result!.events[0]);
  });

  it("It should query withdrawal event", async () => {
    const events = await akira.getWithdrawEventsFor(trader, 68443, 68443);
    expect(events.result).toBeDefined();
    expect(events.result!.events.length).toEqual(1);
    console.log(events.result!.events[0]);
    console.log(
      SDK.getWithdrawHashByEvent(
        events.result!.events[0],
        SDK.getDomain(SN_SEPOLIA),
      ),
    );
  });

  it("It should query deposit event", async () => {
    const events = await akira.getDepositEventsFor(trader, 68443, 68445);
    expect(events.result).toBeDefined();
    expect(events.result!.events.length).toEqual(1);
    console.log(events.result!.events[0]);
  });
});
