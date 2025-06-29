import { TypedData, typedData, uint256 } from "starknet";
import {
  CancelRequest,
  IncreaseNonce,
  Order,
  TokenAddressMap,
  Withdraw,
} from "../../request_types";
import { SignData } from "../http/types";
import { Address } from "../../types";

/**
 * @fileoverview Provides a set of functions to create typed data for exchange
 * entities that user need to sign to perform trading activity
 * @version 1.0.0
 * @author Nikita Mishin
 */

export type StarknetDomain = {
  name: string;
  version: string;
  chainId: string;
};

const domainType = {
  StarkNetDomain: [
    { name: "name", type: "felt" },
    { name: "version", type: "felt" },
    { name: "chainId", type: "felt" },
  ],
};

const u256Type = {
  u256: [
    { name: "low", type: "felt" },
    { name: "high", type: "felt" },
  ],
};

const gasFeeType = {
  GasFee: [
    { name: "gas_per_action", type: "felt" },
    { name: "fee_token", type: "felt" },
    { name: "max_gas_price", type: "u256" },
    { name: "r0", type: "u256" }, //conversion rate
    { name: "r1", type: "u256" }, // conversion rate
  ],
};

const withdrawType = {
  ...domainType,
  Withdraw: [
    { name: "maker", type: "felt" },
    { name: "token", type: "felt" },
    { name: "amount", type: "u256" },
    { name: "salt", type: "felt" },
    { name: "gas_fee", type: "GasFee" },
    { name: "receiver", type: "felt" },
    { name: "exchange", type: "felt" },
    { name: "sign_scheme", type: "felt" },
  ],
  ...u256Type,
  ...gasFeeType,
};

const fixedFeeType = {
  FixedFee: [
    { name: "recipient", type: "felt" },
    { name: "maker_pbips", type: "felt" },
    { name: "taker_pbips", type: "felt" },
  ],
};

const orderFeeType = {
  OrderFee: [
    { name: "trade_fee", type: "FixedFee" },
    { name: "router_fee", type: "FixedFee" },
    { name: "integrator_fee", type: "FixedFee" },
    { name: "apply_to_receipt_amount", type: "bool" },
    { name: "gas_fee", type: "GasFee" },
  ],
};

const orderFlagsType = {
  OrderFlags: [
    { name: "full_fill_only", type: "bool" },
    { name: "best_level_only", type: "bool" },
    { name: "post_only", type: "bool" },
    { name: "is_sell_side", type: "bool" },
    { name: "is_market_order", type: "bool" },
    { name: "to_ecosystem_book", type: "bool" },
    { name: "external_funds", type: "bool" },
  ],
};

const quantityType = {
  Quantity: [
    { name: "base_qty", type: "u256" },
    { name: "quote_qty", type: "u256" },
    { name: "base_asset", type: "u256" },
  ],
};

const constraintsType = {
  Constraints: [
    { name: "number_of_swaps_allowed", type: "felt" },
    { name: "duration_valid", type: "felt" },
    { name: "created_at", type: "felt" },
    { name: "stp", type: "felt" },
    { name: "nonce", type: "felt" },
    { name: "min_receive_amount", type: "u256" },
    { name: "router_signer", type: "felt" },
  ],
};

const orderType = {
  ...domainType,
  Order: [
    { name: "maker", type: "felt" },
    { name: "price", type: "u256" },
    { name: "qty", type: "Quantity" },
    { name: "base", type: "felt" },
    { name: "quote", type: "felt" },
    { name: "fee", type: "OrderFee" },
    { name: "constraints", type: "Constraints" },
    { name: "salt", type: "felt" },
    { name: "flags", type: "OrderFlags" },
    { name: "exchange", type: "felt" },
    { name: "source", type: "felt" },
    { name: "sign_scheme", type: "felt" },
  ],
  ...u256Type,
  ...fixedFeeType,
  ...constraintsType,
  ...quantityType,
  ...gasFeeType,
  ...orderFeeType,
  ...orderFlagsType,
};

const cancelType = {
  ...domainType,
  CancelOrder: [
    { name: "maker", type: "felt" },
    { name: "order_hash", type: "felt" },
    { name: "salt", type: "felt" },
    { name: "sign_scheme", type: "felt" },
  ],
};

const cancelAllType = {
  ...domainType,
  CancelAllOrders: [
    { name: "maker", type: "felt" },
    { name: "salt", type: "felt" },
    { name: "ticker", type: "Ticker" },
    { name: "sign_scheme", type: "felt" },
  ],
  Ticker: [
    { name: "base", type: "felt" },
    { name: "quote", type: "felt" },
    { name: "to_ecosystem_book", type: "bool" },
  ],
};

const cancelAllOnchainType = {
  ...domainType,
  OnchainCancelAll: [
    { name: "maker", type: "felt" },
    { name: "new_nonce", type: "felt" },
    { name: "gas_fee", type: "GasFee" },
    { name: "sign_scheme", type: "felt" },
  ],
  ...u256Type,
  ...gasFeeType,
};

function _prepareGas(gasFee: any, tokenMapping?: TokenAddressMap) {
  const { conversion_rate, ...restGas } = gasFee;
  return {
    ...restGas,
    fee_token: tokenMapping
      ? tokenMapping[restGas.fee_token]
      : restGas.fee_token,
    max_gas_price: uint256.bnToUint256(restGas.max_gas_price),
    r0: uint256.bnToUint256(conversion_rate[0]),
    r1: uint256.bnToUint256(conversion_rate[1]),
  };
}

export function getDomain(
  chainId: string,
  name = "LayerAkira Exchange",
  version = "0.0.1",
) {
  return {
    name: name,
    version: version,
    chainId,
  };
}

/**
 * Builds snip revision 0 typed data that user needs to sign via his private key associated with maker account
 * @returns order Typed data that user needs to sign
 * @param order - order that user wants to sign
 * @param domain - starknet domain where exchange name and version and chain specified
 * @param tokenMapping -  maps ERC20Token to address onchain
 * @param executorAddress - address of LayerAkiraExecutor
 */
export function getOrderSignData(
  order: Order,
  domain: StarknetDomain,
  tokenMapping: TokenAddressMap,
  executorAddress: Address,
): TypedData {
  const { ticker, snip9_call, ...restOrder } = order;
  return {
    types: orderType,
    primaryType: "Order",
    domain: domain,
    message: {
      ...restOrder,
      price: uint256.bnToUint256(order.price),
      qty: {
        base_qty: uint256.bnToUint256(order.qty.base_qty),
        quote_qty: uint256.bnToUint256(order.qty.quote_qty),
        base_asset: uint256.bnToUint256(order.qty.base_asset),
      },
      base: tokenMapping[ticker.base],
      quote: tokenMapping[ticker.quote],
      fee: {
        ...restOrder.fee,
        gas_fee: _prepareGas(order.fee.gas_fee, tokenMapping),
      },
      constraints: {
        ...restOrder.constraints,
        min_receive_amount: uint256.bnToUint256(
          restOrder.constraints.min_receive_amount,
        ),
      },
      exchange: executorAddress,
      source: order.source,
      sign_scheme: order.sign_scheme,
    },
  };
}

/**
 * Builds snip revision 0 typed data that user needs to sign via his private key associated with maker account
 * @returns withdraw Typed data that user needs to sign
 * @param withdraw - withdraw that user wants to sign
 * @param domain - starknet domain where exchange name and version and chain specified
 * @param tokenMapping -  maps ERC20Token to address onchain
 * @param coreAddress - address of an LayerAkira Core
 */
export function getWithdrawSignData(
  withdraw: Withdraw,
  domain: StarknetDomain,
  tokenMapping?: TokenAddressMap,
  coreAddress?: Address,
): TypedData {
  return {
    types: withdrawType,
    primaryType: "Withdraw",
    domain: domain,
    message: {
      ...withdraw,
      token: tokenMapping ? tokenMapping[withdraw.token] : withdraw.token,
      amount: uint256.bnToUint256(withdraw.amount),
      gas_fee: _prepareGas(withdraw.gas_fee, tokenMapping),
      exchange: coreAddress,
      sign_scheme: withdraw.sign_scheme,
    },
  };
}

/**
 * Generates typed data for a message to issue JWT that user needs to sign
 * @param message - The message data to be signed
 * @param domain - starknet domain where exchange name and version and chain specified
 * @returns The generated typed data.
 */
export function getTypedDataForJWT(
  message: SignData,
  domain: StarknetDomain,
): TypedData {
  return {
    domain: domain,
    types: {
      ...domainType,
      Message: [
        { name: "welcome", type: "string" },
        { name: "to", type: "string" },
        {
          name: "exchange",
          type: "string",
        },
      ],
    },
    primaryType: "Message",
    message: {
      welcome: "Sign in to LayerAkira",
      to: "\tChallenge:",
      exchange: message,
    },
  };
}

/**
 * Builds snip revision 0 typed data that user needs to sign via his private key associated with maker account
 * for cancellation request, if order_hash specified it targets to cancel that order else cancel all
 * @returns order Typed data that user needs to sign
 * @param cancel - cancel request that user wants to sign
 * @param domain - starknet domain where exchange name and version and chain specified
 * @param tokenMapping
 */
export function getCancelOrderSignData(
  cancel: CancelRequest,
  domain: StarknetDomain,
  tokenMapping?: TokenAddressMap,
): TypedData {
  return {
    types: cancel.order_hash !== null ? cancelType : cancelAllType,
    primaryType: cancel.order_hash !== null ? "CancelOrder" : "CancelAllOrders",
    domain: domain,
    message:
      cancel.order_hash !== null
        ? { ...cancel, salt: "0x" + cancel.salt.toString(16) }
        : {
            maker: cancel.maker,
            salt: "0x" + cancel.salt.toString(16),
            ticker: {
              base: tokenMapping
                ? tokenMapping[cancel.ticker!.pair.base]
                : cancel.ticker!.pair.base,
              quote: tokenMapping
                ? tokenMapping[cancel.ticker!.pair.quote]
                : cancel.ticker!.pair.quote,
              to_ecosystem_book: cancel.ticker?.isEcosystemBook,
            },
            sign_scheme: cancel.sign_scheme,
          },
  };
}

/**
 * Builds snip revision 0 typed data that user needs to sign via his private key associated with maker account
 * for onchain cancellation request
 * @returns order Typed data that user needs to sign
 * @param req - cancel onchain request that user wants to sign
 * @param domain - starknet domain where exchange name and version and chain specified
 * @param tokenMapping -  maps ERC20Token to address onchain
 */
export function getCancelAllOnchainOrderSignData(
  req: IncreaseNonce,
  domain: StarknetDomain,
  tokenMapping: TokenAddressMap,
): TypedData {
  return {
    types: cancelAllOnchainType,
    primaryType: "OnchainCancelAll",
    domain: domain,
    message: { ...req, gas_fee: _prepareGas(req.gas_fee, tokenMapping) },
  };
}

export function getSignDataHash(data: TypedData, account: Address) {
  return typedData.getMessageHash(data, account);
}
