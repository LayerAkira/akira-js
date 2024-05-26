import * as STARKNETJS from "starknet";
import { BigNumberish } from "ethers";

import * as SDK from "../src";

export const TEST_EXCHANGE_ADDRESS: SDK.Address =
  "0x07981ea76ca241100a3e1cd4083a15a73a068b6d6a946d36042cbfc9b531baa2";
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
    const events = await akira.getTradeEventsFor(trader, 69198, 69198);
    expect(events.result).toBeDefined();
    expect(events.result!.events.length).toEqual(1);
    console.log(events.result!.events[0]);
  });

  it("It should query withdrawal event", async () => {
    const events = await akira.getWithdrawEventsFor(trader, 69198, 69198);
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
    const events = await akira.getDepositEventsFor(trader, 69198, 69198);
    expect(events.result).toBeDefined();
    expect(events.result!.events.length).toEqual(1);
    console.log(events.result!.events[0]);
  });
});
