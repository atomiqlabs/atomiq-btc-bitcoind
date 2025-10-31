/// <reference types="node" />
import { BitcoindBlock } from "./BitcoindBlock";
import { BitcoinRpc, BtcBlockWithTxs, BtcSyncInfo, BtcTx } from "@atomiqlabs/base";
import { Buffer } from "buffer";
export type BitcoindVout = {
    value: number;
    n: number;
    scriptPubKey: {
        asm: string;
        hex: string;
        reqSigs: number;
        type: string;
        addresses: string[];
    };
};
export type BitcoindVin = {
    txid: string;
    vout: number;
    scriptSig: {
        asm: string;
        hex: string;
    };
    sequence: number;
    txinwitness: string[];
};
export type BitcoindTransaction = {
    hex: string;
    txid: string;
    hash: string;
    size: number;
    vsize: number;
    weight: number;
    version: number;
    locktime: number;
    vin: BitcoindVin[];
    vout: BitcoindVout[];
    blockhash: string;
    confirmations: number;
    blocktime: number;
    time: number;
};
export declare class BitcoindRpc implements BitcoinRpc<BitcoindBlock> {
    rpc: any;
    constructor(protocol: string, user: string, pass: string, host: string, port: number, timeout?: number);
    getTipHeight(): Promise<number>;
    getBlockHeader(blockhash: string): Promise<BitcoindBlock | null>;
    isInMainChain(blockhash: string): Promise<boolean>;
    getMerkleProof(txId: string, blockhash: string): Promise<{
        reversedTxId: Buffer;
        pos: number;
        merkle: Buffer[];
        blockheight: number;
    } | null>;
    getTransaction(txId: string): Promise<BtcTx | null>;
    getBlockhash(height: number): Promise<string | null>;
    getBlockWithTransactions(blockhash: string): Promise<BtcBlockWithTxs | null>;
    getSyncInfo(): Promise<BtcSyncInfo>;
    sendRawPackage(rawTxs: string[]): Promise<string[]>;
    sendRawTransaction(rawTx: string): Promise<string>;
    parseTransaction(rawTx: string): Promise<BtcTx>;
    isSpent(utxo: string): Promise<boolean>;
    private getFeeRate;
    getEffectiveFeeRate(btcTx: BtcTx): Promise<{
        fee: number;
        vsize: number;
        feeRate: number;
    }>;
}
