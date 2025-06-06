import { AbiEntry, CallData, FunctionAbi } from "starknet";
import executorAbi from "../api/contract/abi/executor.json";
import { Address } from "../types";
import { FixedFee, GasFee, SignScheme, STPMode } from "../request_types";
import { normalize } from "../api/websocket/utils";
import {
  getOrderSignData,
  getSignDataHash,
  StarknetDomain,
} from "../api/signing/snip12";

/**
 * Interface representing the details of a Rollup order with addresses instead of symbols.
 */
export interface RollupOrderDetails {
  maker: Address;
  price: bigint;
  qty: {
    base_qty: bigint;
    quote_qty: bigint;
    base_asset: bigint;
  };
  ticker: { base: Address; quote: Address };
  fee: {
    trade_fee: {
      recipient: Address;
      maker_pbips: number;
      taker_pbips: number;
      apply_to_receipt_amount: boolean;
    };
    router_fee: {
      recipient: Address;
      maker_pbips: number;
      taker_pbips: number;
      apply_to_receipt_amount: boolean;
    };
    gas_fee: {
      gas_per_action: number;
      fee_token: Address;
      max_gas_price: bigint;
      conversion_rate: [bigint, bigint];
    };
  };
  constraints: {
    number_of_swaps_allowed: number;
    duration_valid: number;
    created_at: number;
    stp: STPMode;
    nonce: number;
    min_receive_amount: bigint;
    router_signer: Address;
  };
  salt: bigint;
  flags: {
    full_fill_only: boolean;
    best_level_only: boolean;
    post_only: boolean;
    is_sell_side: boolean;
    is_market_order: boolean;
    to_ecosystem_book: boolean;
    external_funds: boolean;
  };
  source: string;
  sign_scheme: SignScheme;
  orderHash: string;
}

/**
 * Interface representing the parsed calldata for the `apply_steps` function.
 */
export interface ApplyStepsCalldata {
  nonce_steps: number;
  withdraw_steps: number;
  router_steps: number;
  ecosystem_steps: number;
  gas_price: bigint;
  takerOrders: Array<RollupOrderDetails>;
}

/**
 * Utility function to convert a byte string to a readable string.
 *
 * @param {string} byteString - The byte string in hexadecimal format.
 * @returns {string} - The decoded string.
 */
export function byteStringToString(byteString: string): string {
  // Assuming the byte string is in hexadecimal format
  const hexArray = byteString.match(/.{1,2}/g) || [];
  const byteArray = new Uint8Array(hexArray.map((byte) => parseInt(byte, 16)));

  // Convert the byte array to a string
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(byteArray);
}

/**
 * Casts raw order data to the `RollupOrderDetails` type, normalizing addresses and other fields.
 *
 * @param {any} orderRaw - The raw order data.
 * @returns {RollupOrderDetails} - The casted and normalized order details.
 */
export function castToType(orderRaw: any): RollupOrderDetails {
  const trade_fee = orderRaw.fee.trade_fee;
  const router_fee = orderRaw.fee.router_fee;
  const gas_fee = orderRaw.fee.gas_fee;
  const constraints = orderRaw.constraints;
  return {
    ...orderRaw,
    maker: normalize(orderRaw.maker),

    ticker: {
      base: normalize(orderRaw.ticker["0"]),
      quote: normalize(orderRaw.ticker["1"]),
    },
    source: byteStringToString(orderRaw.source.toString(16)),
    fee: {
      ...orderRaw.fee,
      trade_fee: {
        ...trade_fee,
        recipient: normalize(trade_fee.recipient),
        maker_pbips: Number(trade_fee.maker_pbips),
        taker_pbips: Number(trade_fee.taker_pbips),
      },
      router_fee: {
        ...router_fee,
        recipient: normalize(router_fee.recipient),
        maker_pbips: Number(router_fee.maker_pbips),
        taker_pbips: Number(router_fee.taker_pbips),
      },
      gas_fee: {
        ...gas_fee,
        gas_per_action: Number(gas_fee.gas_per_action),
        fee_token: normalize(gas_fee.fee_token),
        conversion_rate: [
          orderRaw.fee.gas_fee.conversion_rate["0"],
          orderRaw.fee.gas_fee.conversion_rate["1"],
        ],
      },
    },
    constraints: {
      ...constraints,
      number_of_swaps_allowed: Number(constraints.number_of_swaps_allowed),
      duration_valid: Number(constraints.duration_valid),
      created_at: Number(constraints.created_at),
      stp: STPMode.NONE, // TODO not all NONE
      nonce: Number(constraints.nonce),
      router_signer: normalize(constraints.router_signer),
    },
    sign_scheme: orderRaw.sign_scheme,
  };
}

const abiCallData = new CallData(executorAbi);

/**
 * Class for parsing rollup input data for the `apply_steps` function
 * and placeTakerOrder
 */
export class AkiraRollupInputParser {
  private readonly appDomain: StarknetDomain;
  private readonly trader: Address;
  private readonly exchange: Address;

  constructor(appDomain: StarknetDomain, trader: Address, exchange: Address) {
    this.appDomain = appDomain;
    this.trader = trader;
    this.exchange = exchange;
  }

  /**
   * Parses the calldata for the `apply_steps` function.
   *
   * @param {Array<string>} calldata - The calldata array to be parsed.
   * @returns {ApplyStepsCalldata} - The parsed calldata in a structured format.
   */
  public parse(calldata: Array<string>): ApplyStepsCalldata {
    const applyStepsId =
      "0x26aa0b68d8a1885b38c8315a9e0ea92c503e22131f33728c097caef1f5e0e22";
    const placeOrderId =
      "0xbb3dd10d3b0070a8bc931f1104806bf5e2d717c6e961d8d258bed8a7a108ab";
    const fulfillTakerOrder =
      "0x1dd17820e08f4d8954aab4c295c5e1f017b4ca82f39b6d0b601d17fd42d2e02";
    let result: ApplyStepsCalldata | null = null;
    let requireFullfill = false;
    let calldataPlaceOrder: string[] = [];
    for (let i = 0; i < calldata.length; ) {
      if (requireFullfill) {
        if (calldata[i] != fulfillTakerOrder) {
          i++;
          continue;
        }
        const elems = Number(calldata[i + 1]);
        let calldataFullfillOrder = calldata.slice(i + 2, i + 2 + elems);

        requireFullfill = false;
        const parsed = this.parseCalldataExecuteOutside(
          calldataPlaceOrder,
          calldataFullfillOrder,
        );
        if (!result) {
          result = parsed;
        } else {
          result.takerOrders.push(...parsed.takerOrders);
          result.gas_price = parsed.gas_price;
          // TODO for router steps not the same in multicall long term
          result.router_steps = parsed.router_steps;
        }
        continue;
      }
      if (calldata[i] == applyStepsId) {
        const elems = Number(calldata[i + 1]);
        const parsed = this.parseCalldataApplySteps(
          calldata.slice(i + 2, i + 2 + elems),
        );
        i += elems;
        if (!result) {
          result = parsed;
        } else {
          result.takerOrders.push(...parsed.takerOrders);
          result.ecosystem_steps = parsed.ecosystem_steps;
          result.nonce_steps = parsed.nonce_steps;
          result.withdraw_steps = parsed.withdraw_steps;
          result.gas_price = parsed.gas_price;
          result.router_steps = parsed.router_steps;
        }
        continue;
      }
      if (calldata[i] == placeOrderId) {
        const elems = Number(calldata[i + 1]);
        calldataPlaceOrder = calldata.slice(i + 2, i + 2 + elems);
        requireFullfill = true;
        continue;
      }
      i++;
    }

    result?.takerOrders.forEach((e) => {
      const signData = getOrderSignData(
        e as any,
        this.appDomain,
        {
          [e.ticker.base.toString()]: e.ticker.base,
          [e.ticker.quote.toString()]: e.ticker.quote,
          [e.fee.gas_fee.fee_token.toString()]: e.fee.gas_fee.fee_token,
        } as any,
        this.exchange,
      );
      e.orderHash = normalize(getSignDataHash(signData, this.trader));
    });

    return result!;
  }

  private parseCalldataApplySteps(calldata: Array<string>): ApplyStepsCalldata {
    const inputsTypes = AkiraRollupInputParser.fnNameData("apply_steps");
    let res = abiCallData.decodeParameters(inputsTypes, calldata) as any[];

    let takerOrders: Array<RollupOrderDetails> = [];

    res.at(0)!.forEach((step: any) => {
      let variant = step["variant"];
      let key = Object.keys(variant).filter((e) => variant[e] !== undefined)[0];
      switch (key) {
        case "SingleExecutionStep":
          takerOrders.push(castToType(variant[key]["0"]["0"]["order"]));
          break;
        default:
          console.error(`Not supported for ${calldata}`);
          break;
      }
    });

    return {
      nonce_steps: Number(res.at(1)),
      withdraw_steps: Number(res.at(2)),
      router_steps: Number(res.at(3)),
      ecosystem_steps: Number(res.at(4)),
      gas_price: res.at(5)!,
      takerOrders: takerOrders,
    };
  }

  private parseCalldataExecuteOutside(
    calldataPlace: Array<string>,
    calldataFulfill: Array<string>,
  ): ApplyStepsCalldata {
    const placeParsed = abiCallData.decodeParameters(
      AkiraRollupInputParser.fnNameData("placeTakerOrder"),
      calldataPlace,
    ) as any[];
    const takerOrder = castToType(placeParsed[0]);

    const fullfillParsed = abiCallData.decodeParameters(
      AkiraRollupInputParser.fnNameData("fullfillTakerOrder"),
      calldataFulfill,
    ) as any[];
    // @ts-ignore
    const makers = fullfillParsed[0];
    // @ts-ignore
    const takerMatched = fullfillParsed[1];

    return {
      ecosystem_steps: 0,
      gas_price: fullfillParsed[3],
      nonce_steps: 0,
      router_steps: fullfillParsed[2],
      takerOrders: [takerOrder],
      withdraw_steps: 0,
    };
  }
  /**
   * Retrieves the input parameter types for the `fnName` function from the ABI.
   * @returns {Array<string>} - An array of input parameter types.
   */
  private static fnNameData(fnName: string) {
    const { inputs } = abiCallData.parser
      .getLegacyFormat()
      .find((abiItem: AbiEntry) => abiItem.name === fnName) as FunctionAbi;
    return inputs.map((inp: any) => {
      return inp.type as string;
    });
  }
}

/**
 * Calculates the feeable quantity based on the provided fee structure and quantity.
 *
 * @param {FixedFee} fixedFee - The fixed fee structure.
 * @param {bigint} feeableQty - The quantity subject to the fee.
 * @param {boolean} isMaker - Flag indicating if the fee applies to the maker.
 * @returns {bigint} - The calculated feeable quantity.
 */
export function getFeeableQty(
  fixedFee: FixedFee,
  feeableQty: bigint,
  isMaker: boolean,
): bigint {
  const pbips = isMaker ? fixedFee.maker_pbips : fixedFee.taker_pbips;
  if (pbips === 0) {
    return BigInt(0);
  }
  return (
    (feeableQty * BigInt(pbips) - BigInt(1)) / BigInt(1_000_000) + BigInt(1)
  );
}

/**
 * Calculates the gas fee and returns the fee amount along with the fee token address.
 *
 * @param {GasFee} gasFee - The gas fee structure.
 * @param {bigint} curGasPrice - The current gas price.
 * @param {Address} nativeToken - The native token address.
 * @param {number} curGasPerAction - The current gas per action.
 * @returns {[bigint, Address]} - A tuple containing the gas fee amount and the token address.
 */
export function getGasFeeAndCoin(
  gasFee: GasFee,
  curGasPrice: bigint,
  nativeToken: Address,
  curGasPerAction: number,
): [bigint, Address] {
  if (curGasPrice === BigInt(0)) return [BigInt(0), nativeToken];

  if (gasFee.gas_per_action === 0) return [BigInt(0), nativeToken];

  const spendNative = BigInt(curGasPerAction) * curGasPrice;

  if (gasFee.fee_token === nativeToken) return [spendNative, nativeToken];
  const [r0, r1] = gasFee.conversion_rate;
  const spendConverted = (spendNative * r1) / r0;
  return [spendConverted, gasFee.fee_token];
}
