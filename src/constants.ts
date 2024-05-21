import { Address } from "./types.ts";
import { TokenAddressMap } from "@/request_types.ts";

export const API_BASE_MAINNET = "http://localhost:4431";
export const API_BASE_TESTNET = "http://localhost:4431";

export const EXCHANGE_ADDRESS: Address =
  "0x02b3329b6d574d4089f98f8b3b7db90475646760d1dbdb881fd87e6954193c6e";

export const SEPOLIA_TOKEN_MAPPING: TokenAddressMap = {
  ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
};
