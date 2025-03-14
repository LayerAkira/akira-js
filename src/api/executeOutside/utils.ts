import {
  cairo,
  CairoCustomEnum,
  Call,
  Contract,
  OutsideExecutionOptions,
  OutsideExecutionVersion,
  OutsideTransaction,
  WalletAccount,
} from "starknet";
import {
  ERC20Token,
  Order,
  OrderFee,
  OutsideCall,
  STPMode,
} from "../../request_types";
import { Address } from "../../types";
import { castToApiSignature } from "../http/utils";

function prepareFees(
  order_fee: OrderFee,
  ercToAddress: { [x: ERC20Token]: Address },
) {
  return {
    trade_fee: {
      recipient: order_fee.trade_fee.recipient,
      maker_pbips: order_fee.trade_fee.maker_pbips,
      taker_pbips: order_fee.trade_fee.taker_pbips,
      apply_to_receipt_amount: order_fee.trade_fee.apply_to_receipt_amount,
    },
    router_fee: {
      recipient: order_fee.router_fee.recipient,
      maker_pbips: order_fee.router_fee.maker_pbips,
      taker_pbips: order_fee.router_fee.taker_pbips,
      apply_to_receipt_amount: order_fee.router_fee.apply_to_receipt_amount,
    },
    gas_fee: {
      gas_per_action: order_fee.gas_fee.gas_per_action,
      fee_token: ercToAddress[order_fee.gas_fee.fee_token],
      max_gas_price: cairo.uint256(order_fee.gas_fee.max_gas_price),
      conversion_rate: {
        0: cairo.uint256(order_fee.gas_fee.conversion_rate[0]),
        1: cairo.uint256(order_fee.gas_fee.conversion_rate[1]),
      },
    },
  };
}

/**
 * Builds the primitives required to build an "outside" transaction on StarkNet to submit order via snip9.
 *
 * @param placeOnchainCall place onchain call
 * @param exchange - The StarkNet exchange contract instance.
 * @param ercToAddress - A mapping of ERC20 tokens to their corresponding StarkNet addresses.
 * @param approvals - Array of tuples specifying ERC20 tokens and the amounts to approve.
 * @param rollupPusher - The address responsible for pushing the transaction onto the rollup.
 * @param validSinceNowSeconds - (Optional) Number of seconds before the current time when the transaction becomes valid (default: 60).
 * @param validUntilNowSeconds - (Optional) Number of seconds after the current time when the transaction expires (default: 300).
 * @param include_execute_approval - should "grant_access_to_executor" be incuded in client multicall
 * @param core_address - must be specified if include_execute_approval
 * @returns A tuple containing:
 *   - `OutsideExecutionOptions`: Execution metadata (caller, valid times, etc.).
 *   - `Call[]`: An array of StarkNet `Call` objects for the transaction.
 *   - `OutsideCall[]`: API-compatible representations of the calls.
 */
export function buildBaseExecuteOutsidePrimitives(
  placeOnchainCall: Call,
  exchange: Contract,
  ercToAddress: { [x: ERC20Token]: Address },
  approvals: [[ERC20Token, bigint]],
  rollupPusher: Address,
  validSinceNowSeconds: number = 60,
  validUntilNowSeconds: number = 60 * 5,
  include_execute_approval: boolean = false,
  core_address: Address | undefined = undefined,
): [OutsideExecutionOptions, Call[], OutsideCall[]] {
  const clientExecuteOutsideCalls: Call[] = [];
  if (include_execute_approval) {
    if (core_address === undefined)
      throw new Error(
        "If include execute approval enabled need to specify core contract",
      );
    clientExecuteOutsideCalls.push({
      contractAddress: core_address,
      entrypoint: "grant_access_to_executor",
      calldata: [],
    });
  }
  approvals.forEach((item) => {
    clientExecuteOutsideCalls.push({
      contractAddress: ercToAddress[item[0]],
      entrypoint: "approve",
      calldata: {
        recipient: exchange.address,
        amount: cairo.uint256(item[1]),
      },
    });
  });

  clientExecuteOutsideCalls.push(placeOnchainCall);

  const callOptions: OutsideExecutionOptions = {
    caller: rollupPusher,
    execute_after: Math.floor(Date.now() / 1000) - validSinceNowSeconds,
    execute_before: Math.floor(Date.now() / 1000) + validUntilNowSeconds,
  };
  let apiCalls: Array<OutsideCall> = approvals.map((item) => {
    return {
      to: ercToAddress[item[0]],
      selector: "approve",
      kwargs: {
        recipient: exchange.address.toString(),
        amount: item[1].toString(),
      },
    };
  });
  if (include_execute_approval) {
    apiCalls = [
      { to: core_address!, selector: "grant_access_to_executor", kwargs: {} },
      ...apiCalls,
    ];
  }

  return [callOptions, clientExecuteOutsideCalls, apiCalls];
}

/**
 * Builds the primitives required to build an place order "outside" transaction on StarkNet to submit order via snip9.
 *
 * @param exchange - The StarkNet exchange contract instance.
 * @param order - The order details, including maker, price, quantity, fees, and constraints.
 * @param ercToAddress - A mapping of ERC20 tokens to their corresponding StarkNet addresses.
 * @param routerSignature - A tuple representing the router signature for the order.
 * @param approvals - Array of tuples specifying ERC20 tokens and the amounts to approve.
 * @param rollupPusher - The address responsible for pushing the transaction onto the rollup.
 * @param validSinceNowSeconds - (Optional) Number of seconds before the current time when the transaction becomes valid (default: 60).
 * @param validUntilNowSeconds - (Optional) Number of seconds after the current time when the transaction expires (default: 300).
 * @param include_execute_approval - should "grant_access_to_executor" be incuded in client multicall
 * @param core_address - must be specified if include_execute_approval
 * @returns A tuple containing:
 *   - `OutsideExecutionOptions`: Execution metadata (caller, valid times, etc.).
 *   - `Call[]`: An array of StarkNet `Call` objects for the transaction.
 *   - `OutsideCall[]`: API-compatible representations of the calls.
 */
export function buildExecuteOutsidePrimitives(
  exchange: Contract,
  order: Order,
  ercToAddress: { [x: ERC20Token]: Address },
  routerSignature: [string, string],
  approvals: [[ERC20Token, bigint]],
  rollupPusher: Address,
  validSinceNowSeconds: number = 60,
  validUntilNowSeconds: number = 60 * 5,
  include_execute_approval: boolean = false,
  core_address: Address | undefined = undefined,
): [OutsideExecutionOptions, Call[], OutsideCall[]] {
  const orderCalldata = {
    maker: order.maker,
    price: cairo.uint256(order.price),
    qty: {
      base_qty: cairo.uint256(order.qty.base_qty),
      quote_qty: cairo.uint256(order.qty.quote_qty),
      base_asset: cairo.uint256(order.qty.base_asset),
    },
    ticker: {
      0: ercToAddress[order.ticker.base],
      1: ercToAddress[order.ticker.quote],
    },
    fee: prepareFees(order.fee, ercToAddress),
    constraints: {
      number_of_swaps_allowed: order.constraints.number_of_swaps_allowed,
      duration_valid: order.constraints.duration_valid,
      created_at: order.constraints.created_at,
      stp: new CairoCustomEnum({
        NONE: order.constraints.stp == STPMode.NONE ? {} : undefined,
        EXPIRE_TAKER:
          order.constraints.stp == STPMode.EXPIRE_TAKER ? {} : undefined,
        EXPIRE_MAKER:
          order.constraints.stp == STPMode.EXPIRE_MAKER ? {} : undefined,
        EXPIRE_BOTH:
          order.constraints.stp == STPMode.EXPIRE_BOTH ? {} : undefined,
      }),
      nonce: order.constraints.nonce,
      min_receive_amount: cairo.uint256(order.constraints.min_receive_amount),
      router_signer: order.constraints.router_signer,
    },
    salt: order.salt,
    flags: {
      full_fill_only: order.flags.full_fill_only,
      best_level_only: order.flags.best_level_only,
      post_only: order.flags.post_only,
      is_sell_side: order.flags.is_sell_side,
      is_market_order: order.flags.is_market_order,
      to_ecosystem_book: order.flags.to_ecosystem_book,
      external_funds: order.flags.external_funds,
    },
    source: order.source,
    sign_scheme: order.sign_scheme,
  };
  const routerSignCalldata = {
    0: BigInt(routerSignature[0]),
    1: BigInt(routerSignature[1]),
  };

  const placeOnchainCall = exchange.populate("placeTakerOrder", [
    orderCalldata,
    routerSignCalldata,
  ]);

  return buildBaseExecuteOutsidePrimitives(
    placeOnchainCall,
    exchange,
    ercToAddress,
    approvals,
    rollupPusher,
    validSinceNowSeconds,
    validUntilNowSeconds,
    include_execute_approval,
    core_address,
  );
}

/**
 * Builds the primitives required to build an sor place order "outside" transaction on StarkNet to submit order via snip9.
 *
 * @param exchange - The StarkNet exchange contract instance.
 * @param order - The order details, including maker, price, quantity, fees, and constraints.
 * @param ercToAddress - A mapping of ERC20 tokens to their corresponding StarkNet addresses.
 * @param routerSignature - A tuple representing the router signature for the order.
 * @param approvals - Array of tuples specifying ERC20 tokens and the amounts to approve.
 * @param rollupPusher - The address responsible for pushing the transaction onto the rollup.
 * @param validSinceNowSeconds - (Optional) Number of seconds before the current time when the transaction becomes valid (default: 60).
 * @param validUntilNowSeconds - (Optional) Number of seconds after the current time when the transaction expires (default: 300).
 * @param include_execute_approval - should "grant_access_to_executor" be incuded in client multicall
 * @param core_address - must be specified if include_execute_approval
 * @returns A tuple containing:
 *   - `OutsideExecutionOptions`: Execution metadata (caller, valid times, etc.).
 *   - `Call[]`: An array of StarkNet `Call` objects for the transaction.
 *   - `OutsideCall[]`: API-compatible representations of the calls.
 */
export function buildExecuteOutsideSORPrimitives(
  exchange: Contract,
  order: Order,
  ercToAddress: { [x: ERC20Token]: Address },
  routerSignature: [string, string],
  approvals: [[ERC20Token, bigint]],
  rollupPusher: Address,
  validSinceNowSeconds: number = 60,
  validUntilNowSeconds: number = 60 * 5,
  include_execute_approval: boolean = false,
  core_address: Address | undefined = undefined,
): [OutsideExecutionOptions, Call[], OutsideCall[]] {
  const orchestrate_order = {
    price: cairo.uint256(order.price),
    base_asset: order.qty.base_asset,
    ticker: {
      0: ercToAddress[order.ticker.base],
      1: ercToAddress[order.ticker.quote],
    },
    is_sell_side: order.flags.is_sell_side,
  };
  const path = order.sor!.path.map((order) => {
    return {
      price: cairo.uint256(order.price),
      base_asset: order.base_asset,
      ticker: {
        0: ercToAddress[order.ticker.base],
        1: ercToAddress[order.ticker.quote],
      },
      is_sell_side: order.is_sell_side,
    };
  });
  const details = {
    lead_qty: {
      base_qty: cairo.uint256(order.qty.base_qty),
      quote_qty: cairo.uint256(order.qty.quote_qty),
      base_asset: cairo.uint256(order.qty.base_asset),
    },
    last_qty: {
      base_qty: cairo.uint256(order.sor!.last_base_qty ?? 0n),
      quote_qty: cairo.uint256(order.sor!.last_quote_qty ?? 0n),
      base_asset: cairo.uint256(
        order.sor!.path[order.sor!.path.length - 1].base_asset,
      ),
    },
    ...prepareFees(order.sor!.order_fee, ercToAddress),
    created_at: order.constraints.created_at,
    source: order.source,
    allow_non_atomic: order.sor?.allow_non_atomic,
    to_ecosystem_book: order.flags.to_ecosystem_book,
    duration_valid: order.constraints.duration_valid,
    nonce: order.constraints.nonce,
    external_funds: order.flags.external_funds,
    router_signer: order.constraints.router_signer,
    salt: order.salt,
    sign_scheme: order.sign_scheme,
    number_of_swaps_allowed: order.constraints.number_of_swaps_allowed,
    min_receive_amount: cairo.uint256(order.sor!.min_receive_amount ?? 0n),
    max_spend_amount: cairo.uint256(order.sor!.max_spend_amount ?? 0n),
  };
  const routerSignCalldata = {
    0: BigInt(routerSignature[0]),
    1: BigInt(routerSignature[1]),
  };

  const placeOnchainCall = exchange.populate("placeSORTakerOrder", [
    orchestrate_order,
    path,
    routerSignCalldata,
    details,
  ]);

  return buildBaseExecuteOutsidePrimitives(
    placeOnchainCall,
    exchange,
    ercToAddress,
    approvals,
    rollupPusher,
    validSinceNowSeconds,
    validUntilNowSeconds,
    include_execute_approval,
    core_address,
  );
}

/**
 * Builds "outside" execution transaction and signs it using the wallet account.
 *
 * @param walletAccount - The wallet instance used to sign the transaction.
 * @param callOptions - Execution metadata such as valid times and caller.
 * @param clientExecuteOutsideCalls - The array of StarkNet `Call` objects generated by `buildExecuteOutsidePrimitives`.
 * @param apiCalls - API-compatible representations of the transaction calls excluding place just an approvals basically.
 * @param version
 * @returns A formatted transaction object ready to be submitted.
 */
export async function buildOutsideExecuteTransaction(
  walletAccount: WalletAccount,
  callOptions: OutsideExecutionOptions,
  clientExecuteOutsideCalls: Call[],
  apiCalls: OutsideCall[],
  version: OutsideExecutionVersion,
) {
  const outsideTx: OutsideTransaction =
    await walletAccount.getOutsideTransaction(
      callOptions,
      clientExecuteOutsideCalls,
      version,
    );

  return {
    caller: outsideTx.outsideExecution.caller,
    calls: apiCalls,
    execute_after: Number(outsideTx.outsideExecution.execute_after),
    execute_before: Number(outsideTx.outsideExecution.execute_before),
    nonce: outsideTx.outsideExecution.nonce.toString(),
    signer_address: walletAccount.address.toString(),
    version: outsideTx.version,
    signature: castToApiSignature(outsideTx.signature),
  };
}
