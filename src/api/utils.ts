import {Signature, WeierstrassSignatureType} from "starknet";


export function stall(duration: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, duration);
    });
}


export function castToApiSignature(s: Signature): [string, string] {
    let sign = (<WeierstrassSignatureType>s)
    return [sign.r.toString(), sign.s.toString()]
}