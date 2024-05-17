import {BigNumberish} from "ethers";
import {ERC20Token, TradedPair} from "@/request_types.ts";


export interface TableLevel {
    price: BigNumberish;
    volume: BigNumberish;
    orders: number;
}

export interface BBO {
    bid?: TableLevel | null;
    ask?: TableLevel | null;
    ts: number;
}


export interface Table {
    bids: [BigNumberish, BigNumberish, number][];
    asks: [BigNumberish, BigNumberish, number][];
}

export interface Snapshot {
    levels: Table
    msg_id: string
    time: number
}


interface Balance {
    token: ERC20Token;
    balance: BigNumberish;
    locked: BigNumberish;
}

interface UserFee extends TradedPair {
    fee: [BigNumberish, BigNumberish][] // maker and taker pbips
}

export interface UserInfo {
    nonce: number
    balances: Balance[]
    fees: UserFee[]
}