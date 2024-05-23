import { Address } from "./types.ts";
import { TokenAddressMap } from "@/request_types.ts";

export const API_BASE_MAINNET = "http://localhost:4431";
export const API_BASE_TESTNET = "http://localhost:4431";

export const EXCHANGE_ADDRESS: Address =
  "0x046dbba96f861e1dfb7084e7b7dfc98ed38a682e43cbcd9a7c4c3876e1495922";

export const NULL_ADDRESS: Address =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
export const SEPOLIA_TOKEN_MAPPING: TokenAddressMap = {
  ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
};
