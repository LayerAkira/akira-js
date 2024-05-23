import { LayerAkiraSDK } from "./sdk";

/**
 * @example
 * // Example Setup
 * ```ts
 * import { ethers } from 'ethers'
 * ```
 */
export {
  // Main SDK export
  LayerAkiraSDK,
};

export * from "./types.ts";
export * from "./api/http/types.ts";
export * from "./api/signing/snip12.ts";
export * from "./constants.ts";
export * from "./request_types.ts";
export * from "./response_types.ts";
export * from "./api/websocket/types.ts";
export * from "./api/contract/types.ts";
export * from "./utils/utils.ts";
export * from "./utils/OrderConstructor.ts";
export * from "./utils/WithdrawConstructor.ts";
export * from "./utils/swap.ts";
export * from "./utils/TickerFeeMap.ts";
export { ERC20Contract } from "./api/contract/ERC20Contract.ts";
export {
  getContractAbi,
  getWithdrawHashByEvent,
  bigintToHex,
  callContractMethod,
} from "./api/contract/utils.ts";
export { LayerAkiraHttpAPI } from "./api/http/LayerAkiraHttpAPI.ts";
export { LayerAkiraWSSAPI } from "./api/websocket/LayerAkiraWSSAPI.ts";
export { LayerAkiraContract } from "./api/contract/LayerAkiraContract.ts";
