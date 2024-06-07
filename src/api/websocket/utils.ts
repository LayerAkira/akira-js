import { BigNumberish, hexlify } from "ethers";
import { ExchangeTicker, SocketEvent } from "./types";

export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function normalize(val: BigNumberish): string {
  if (typeof val === "string") {
    if (val.startsWith("0x")) {
      val = "0x" + val.slice(2).padStart(64, "0");
      return hexlify(val).toLowerCase();
    }
  }
  return hexlify("0x" + BigInt(val).toString(16).padStart(64, "0"));
}
export function getEpochSeconds(): number {
  return Math.round(Date.now() / 1000);
}
export const stringHash = (str: string): number => {
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    result = (result * 31 + str.charCodeAt(i)) | 0;
  }
  return result;
};

export function getHashCode(obj: ExchangeTicker, event: SocketEvent): number {
  const pairHash = stringHash(obj.pair.base) ^ stringHash(obj.pair.quote);
  const isEcosystemBookHash = obj.isEcosystemBook ? 1 : 0;
  return pairHash ^ isEcosystemBookHash ^ stringHash(event);
}
