import { LayerAkiraSDK, SDKConfiguration } from "./sdk";
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
export type { SDKConfiguration };

export * from "./types";
export * from "./api/http/types";
export * from "./api/signing/snip12";
export * from "./constants";
export * from "./request_types";
export * from "./response_types";
export * from "./api/websocket/types";
export * from "./api/contract/types";
export * from "./utils/utils";
export * from "./utils/OrderConstructor";
export * from "./utils/WithdrawConstructor";
export * from "./utils/swap";
export * from "./utils/TickerFeeMap";
export { ERC20Contract } from "./api/contract/ERC20Contract";
export {
  getContractAbi,
  getWithdrawHashByEvent,
  bigintToHex,
  callContractMethod,
} from "./api/contract/utils";
export { LayerAkiraHttpAPI } from "./api/http/LayerAkiraHttpAPI";
export type { LayerAkiraHttpConfig } from "./api/http/LayerAkiraHttpAPI";
export { type ILayerAkiraWSSAPI } from "./api/websocket/LayerAkiraWSSAPI";
export { LayerAkiraWSSAPI } from "./api/websocket/LayerAkiraWSSAPI";
export { LayerAkiraContract } from "./api/contract/LayerAkiraContract";

export { normalize } from "./api/websocket/utils";
export { castToApiSignature } from "./api";
