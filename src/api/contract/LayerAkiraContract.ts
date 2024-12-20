import { Address } from "../../types";
import {
  AbiEnums,
  AbiEvents,
  AbiStructs,
  CallData,
  CallOptions,
  Contract,
  events,
  hash,
  num,
  RpcProvider,
} from "starknet";
import { ExceptionIssueCode } from "../http/types";
import { Result } from "../../response_types";
import { bigintToHex, callContractMethod, hexToAscii } from "./utils";
import { BigNumberish } from "ethers";
import {
  DepositEvent,
  OrderTradeInfo,
  TradeEvent,
  WithdrawalEvent,
} from "./types";

import routerAbi from "./abi/router.json";
import executorAbi from "./abi/executor.json";
import coreAbi from "./abi/core.json";

/**
 * Class representing the LayerAkira exchange contract.
 */
export class LayerAkiraContract {
  public coreAddress: Address;
  public executorAddress: Address;
  public routerAddress: Address;

  private readonly provider: RpcProvider;
  private readonly abiEnums: Record<Address, AbiEnums>;
  private readonly abiEvents: Record<Address, AbiEvents>;
  private readonly abiStructs: Record<Address, AbiStructs>;
  private readonly withdrawComponentKey: string;
  private readonly executorComponentKey: string;
  private readonly depositComponentKey: string;
  private readonly coreContract: Contract;
  private readonly routerContract: Contract;
  private readonly executorContract: Contract;

  /**
   * Creates an instance of LayerAkira.
   * @param coreAddress
   * @param executorAddress
   * @param routerAddress
   * @param provider The RPC provider to interact with the contract.
   * @param withdrawComponentKey The component key for withdrawals.
   * @param executorComponentKey The component key for the balancer.
   * @param depositComponentKey The component key for deposits.
   */
  constructor(
    coreAddress: Address,
    executorAddress: Address,
    routerAddress: Address,
    provider: RpcProvider,
    withdrawComponentKey?: string,
    executorComponentKey?: string,
    depositComponentKey?: string,
  ) {
    this.coreAddress = coreAddress;
    this.executorAddress = executorAddress;
    this.routerAddress = routerAddress;
    this.provider = provider;
    this.coreContract = new Contract(coreAbi, coreAddress, provider);
    this.routerContract = new Contract(routerAbi, routerAddress, provider);
    this.executorContract = new Contract(
      executorAbi,
      executorAddress,
      provider,
    );

    this.abiEvents = {
      [this.coreAddress]: events.getAbiEvents(coreAbi),
      [this.executorAddress]: events.getAbiEvents(executorAbi),
      [this.routerAddress]: events.getAbiEvents(routerAbi),
    };
    this.abiStructs = {
      [this.coreAddress]: CallData.getAbiStruct(coreAbi),
      [this.executorAddress]: CallData.getAbiStruct(executorAbi),
      [this.routerAddress]: CallData.getAbiStruct(routerAbi),
    };
    this.abiEnums = {
      [this.coreAddress]: CallData.getAbiEnum(coreAbi),
      [this.executorAddress]: CallData.getAbiEnum(executorAbi),
      [this.routerAddress]: CallData.getAbiEnum(routerAbi),
    };
    this.withdrawComponentKey =
      withdrawComponentKey ??
      "0x263bb99782710eacf6e143ab001ce64dadd4fb8e0d913bac9c7997f01cb9402";
    this.depositComponentKey =
      depositComponentKey ??
      "0xa1db419bdf20c7726cf74c30394c4300e5645db4e3cacaf897da05faabae03";
    this.executorComponentKey =
      executorComponentKey ??
      "0x02e47a55f75db3665729a0ab9fc02ef7227c697e1427cff3dc65c8ada44a2c31";
  }

  /**
   * Fetches the balance of a specific token for a trader on LayerAkira exchange.
   * @param traderAddress The address of the trader.
   * @param tokenAddress The address of the token.
   * @param callOptions
   * @returns A promise that resolves to the balance of the token for the trader.
   */
  public async balanceOf(
    traderAddress: BigNumberish,
    tokenAddress: BigNumberish,
    callOptions?: CallOptions,
  ): Promise<Result<bigint>> {
    return await callContractMethod(
      this.coreContract,
      "balanceOf",
      CallData.compile([traderAddress, tokenAddress]),
      callOptions ?? { blockIdentifier: "pending" },
    );
  }

  /**
   * Fetches the nonce for a specific trader on LayerAkira exchange.
   * @param traderAddress The address of the trader.
   * @param callOptions
   * @returns A promise that resolves to the nonce of the trader.
   */
  public async nonce(
    traderAddress: BigNumberish,
    callOptions?: CallOptions,
  ): Promise<Result<bigint>> {
    return await callContractMethod(
      this.coreContract,
      "get_nonce",
      CallData.compile([traderAddress]),
      callOptions ?? { blockIdentifier: "pending" },
    );
  }

  /**
   * Fetches the balances of specific tokens for a trader on LayerAkira exchange.
   * @param traderAddress The address of the trader.
   * @param tokenAddresses The addresses of the tokens.
   * @param callOptions
   * @returns A promise that resolves to an array of balances for the tokens.
   */
  public async balancesOf(
    traderAddress: BigNumberish,
    tokenAddresses: BigNumberish[],
    callOptions?: CallOptions,
  ): Promise<Result<bigint[]>> {
    const result = await callContractMethod(
      this.coreContract,
      "balancesOf",
      CallData.compile([[traderAddress], tokenAddresses]),
      callOptions ?? { blockIdentifier: "pending" },
    );
    if (result.result !== undefined) result.result = result.result[0];
    return result;
  }

  /**
   * Fetches the native gas fee token address set in LayerAkira contract.
   * @returns A promise that resolves to the address of the native gas fee token.
   */
  public async nativeGasFeeToken(
    callOptions?: CallOptions,
  ): Promise<Result<Address>> {
    const result = await callContractMethod(
      this.coreContract,
      "get_wrapped_native_token",
      CallData.compile([]),
      callOptions ?? { blockIdentifier: "pending" },
    );
    if (result.result !== undefined) result.result = bigintToHex(result.result);
    return result;
  }

  /**
   * Fetches the address of the exchange fee recipient for tradeFee.
   * @returns A promise that resolves to the address of the exchange fee recipient.
   */
  public async exchangeFeeRecipient(
    callOptions?: CallOptions,
  ): Promise<Result<Address>> {
    const result = await callContractMethod(
      this.coreContract,
      "get_fee_recipient",
      CallData.compile([]),
      callOptions ?? { blockIdentifier: "pending" },
    );
    if (result.result !== undefined) result.result = bigintToHex(result.result);
    return result;
  }

  /**
   * Fetches trade information (fills) for a specific order hash.
   * @param orderHash The hash of the order.
   * @param callOptions
   * @returns A promise that resolves to the trade information of the order.
   */
  public async getFillInfo(
    orderHash: BigNumberish,
    callOptions?: CallOptions,
  ): Promise<Result<OrderTradeInfo>> {
    return await callContractMethod(
      this.executorContract,
      "get_ecosystem_trade_info",
      CallData.compile([orderHash]),
      callOptions ?? { blockIdentifier: "pending" },
    );
  }

  /**
   * Fetches trade events for a given trader within a specified block range.
   * Allows filtering by whether the trader is a maker or taker.
   * @param trader The address of the trader to filter events for.
   * @param fromBlock The block number to start fetching events from.
   * @param toBlock The block number to stop fetching events at.
   * @param isMaker Optional boolean to filter events where the trader is the maker.
   * @param continuationToken Optional token to continue fetching events from where the last request left off.
   * @param chunkSize Optional number of events to fetch per request (default is 10).
   * @returns A promise that resolves to a Result object containing an array of trade events and an optional continuation token.
   */
  public async getTradeEventsFor(
    trader: Address,
    fromBlock: number | "latest" | "pending",
    toBlock: number | "latest" | "pending",
    isMaker: boolean = false,
    continuationToken?: string,
    chunkSize = 10,
  ): Promise<
    Result<{
      events: TradeEvent[];
      continuationToken?: string;
    }>
  > {
    let tradeEvents = (await this.getEvents(
      this.executorAddress,
      this.executorComponentKey,
      "Trade",
      [isMaker ? [trader] : [], isMaker ? [] : [trader]],
      fromBlock,
      toBlock,
      (evt: any) => {
        evt.maker = bigintToHex(evt.maker as bigint);
        evt.taker = bigintToHex(evt.taker as bigint);
        evt.ticker = {
          baseAddress: bigintToHex((evt.ticker as bigint[])[0]),
          quoteAddress: bigintToHex((evt.ticker as bigint[])[1]),
        };
        evt.maker_hash = bigintToHex(evt.maker_hash as bigint);
        evt.taker_hash = bigintToHex(evt.taker_hash as bigint);
        evt.maker_source = hexToAscii(bigintToHex(evt.maker_source as bigint));
        evt.taker_source = hexToAscii(bigintToHex(evt.taker_source as bigint));

        return evt;
      },
      continuationToken,
      chunkSize,
      undefined,
      "BaseTradeComponent::base_trade_component",
    )) as Result<{ events: TradeEvent[]; continuationToken?: string }>;
    // https://github.com/NethermindEth/juno/issues/1922 due this need additional filtering for false positive
    if (tradeEvents.result)
      tradeEvents.result!.events = tradeEvents.result.events.filter(
        (e) =>
          (BigInt(e.taker) === BigInt(trader) && !isMaker) ||
          (BigInt(e.maker) === BigInt(trader) && isMaker),
      );
    return tradeEvents;
  }

  /**
   * Fetches withdrawal events for a given trader within a specified block range.
   * @param trader The address of the trader to filter events for.
   * @param fromBlock The block number to start fetching events from.
   * @param toBlock The block number to stop fetching events at.
   * @param continuationToken Optional token to continue fetching events from where the last request left off.
   * @param chunkSize Optional number of events to fetch per request (default is 10).
   * @returns A promise that resolves to a Result object containing an array of withdrawal events and an optional continuation token.
   */
  public async getWithdrawEventsFor(
    trader: Address,
    fromBlock: number | "latest" | "pending",
    toBlock: number | "latest" | "pending",
    continuationToken?: string,
    chunkSize = 10,
  ): Promise<
    Result<{
      events: WithdrawalEvent[];
      continuationToken?: string;
    }>
  > {
    let events = (await this.getEvents(
      this.coreAddress,
      this.withdrawComponentKey,
      "Withdrawal",
      [[trader]],
      fromBlock,
      toBlock,
      (evt: any) => {
        evt.maker = bigintToHex(evt.maker as bigint);
        evt.token = bigintToHex(evt.token as bigint);
        evt.receiver = bigintToHex(evt.receiver as bigint);
        evt.gas_fee = {
          ...evt.gas_fee,
          fee_token: bigintToHex(evt.gas_fee.fee_token),
          conversion_rate: [
            evt.gas_fee.conversion_rate["0"],
            evt.gas_fee.conversion_rate["1"],
          ],
        };
        return evt;
      },
      continuationToken,
      chunkSize,
      undefined,
      "WithdrawComponent::withdraw_component",
    )) as Result<{ events: WithdrawalEvent[]; continuationToken?: string }>;
    if (events.result)
      events.result!.events = events.result.events.filter(
        (e) => BigInt(e.maker) === BigInt(trader),
      );

    return events;
  }

  /**
   * Fetches deposit events for a given trader within a specified block range.
   * @param trader The address of the trader to filter events for (funder).
   * @param fromBlock The block number to start fetching events from.
   * @param toBlock The block number to stop fetching events at.
   * @param continuationToken Optional token to continue fetching events from where the last request left off.
   * @param chunkSize Optional number of events to fetch per request (default is 10).
   * @returns A promise that resolves to a Result object containing an array of deposit events and an optional continuation token.
   */
  public async getDepositEventsFor(
    trader: Address,
    fromBlock: number | "latest" | "pending",
    toBlock: number | "latest" | "pending",
    continuationToken?: string,
    chunkSize = 10,
  ): Promise<
    Result<{
      events: DepositEvent[];
      continuationToken?: string;
    }>
  > {
    let events = (await this.getEvents(
      this.coreAddress,
      this.depositComponentKey,
      "Deposit",
      [[trader]],
      fromBlock,
      toBlock,
      (evt: any) => {
        evt.receiver = bigintToHex(evt.receiver as bigint);
        evt.token = bigintToHex(evt.token as bigint);
        evt.funder = bigintToHex(evt.funder as bigint);
        return evt;
      },
      continuationToken,
      chunkSize,
      undefined,
      "DepositComponent::deposit_component",
    )) as Result<{ events: DepositEvent[] }>;
    if (events.result)
      events.result!.events = events.result.events.filter(
        (e) => BigInt(e.funder) === BigInt(trader),
      );
    return events;
  }

  /**
   * Fetches events for a given event in component within a specified block range.
   * Allows custom parsing of events based on the provided event name and parsing function.
   * @template T - The type of the parsed event.
   * @param address
   * @param componentKey - The key of the component to fetch events for.
   * @param eventName - The name of the event to fetch.
   * @param restKeys - Additional keys to filter events.
   * @param fromBlock - The block number to start fetching events from.
   * @param toBlock - The block number to stop fetching events at.
   * @param parseEvent - A function to parse raw events into the desired format.
   * @param continuationToken - Optional token to continue fetching events from where the last request left off.
   * @param chunkSize - Optional number of events to fetch per request (default is 10).
   * @param abiEvents - Optional ABI events to use for parsing.
   * @param componentName
   * @returns A promise that resolves to a Result object containing an array of parsed events and an optional continuation token.
   */
  private async getEvents<T>(
    address: Address,
    componentKey: string,
    eventName: string,
    restKeys: string[][],
    fromBlock: number | "latest" | "pending",
    toBlock: number | "latest" | "pending",
    parseEvent: (t: any) => T,
    continuationToken?: string,
    chunkSize = 10,
    abiEvents?: AbiEvents,
    componentName?: string,
  ): Promise<
    Result<{
      events: T[];
      continuationToken?: string;
    }>
  > {
    try {
      const result = await this.provider.getEvents({
        address,
        from_block:
          fromBlock == "latest" || fromBlock == "pending"
            ? fromBlock
            : { block_number: fromBlock },
        to_block:
          toBlock == "latest" || toBlock == "pending"
            ? toBlock
            : { block_number: toBlock },
        keys: [
          [componentKey],
          [num.toHex(hash.starknetKeccak(eventName))],
          ...restKeys,
        ],
        chunk_size: chunkSize,
        continuation_token: continuationToken,
      });

      const parsedEvents = events.parseEvents(
        result.events,
        abiEvents ?? this.abiEvents[address],
        this.abiStructs[address],
        this.abiEnums[address],
      );
      const evts = parsedEvents.map((parsedEvt: any, index) =>
        parseEvent({
          ...parsedEvt[`kurosawa_akira::${componentName}::${eventName}`],
          transaction_hash: result.events[index].transaction_hash,
          block_number: result.events[index].block_number,
        }),
      );
      return {
        result: { events: evts, continuationToken: result.continuation_token },
      };
    } catch (e: any) {
      console.log(this.abiStructs);
      return { code: ExceptionIssueCode, exception: e };
    }
  }
}
