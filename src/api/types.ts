import {BigNumberish} from "ethers";
import {Address} from "../general_types";
import {ERC20Token} from "@/request_types";

export type SignData = BigNumberish

export interface Result<T> {
    result: T;
    code?: number;
    error?: string;
}

export interface LayerAkiraConfig {
    jwt?: string;
    tradingAccount?: Address
    apiBaseUrl: string;
}

export type TokenAddressMap = {
    [token: ERC20Token]: string;
};