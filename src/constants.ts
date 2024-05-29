import { Address } from "./types";
import { TokenAddressMap } from "./request_types";

export const NULL_ADDRESS: Address =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
export const SEPOLIA_TOKEN_MAPPING: TokenAddressMap = {
  ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
};

export const NATIVE_GAS_TOKEN = "STRK";
