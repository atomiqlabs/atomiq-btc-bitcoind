/// <reference types="node" />
import { BtcBlock } from "@atomiqlabs/base";
export type BitcoindBlockType = {
    hash: string;
    confirmations: number;
    height: number;
    version: number;
    versionHex: string;
    merkleroot: string;
    time: number;
    mediantime: number;
    nonce: number;
    bits: string;
    difficulty: number;
    chainwork: string;
    nTx: number;
    previousblockhash: string;
    nextblockhash: string;
};
export declare class BitcoindBlock implements BtcBlock {
    hash: string;
    confirmations: number;
    height: number;
    version: number;
    versionHex: string;
    merkleroot: string;
    time: number;
    mediantime: number;
    nonce: number;
    bits: string;
    difficulty: number;
    chainwork: string;
    nTx: number;
    previousblockhash: string;
    nextblockhash: string;
    constructor(obj: BitcoindBlockType);
    getHeight(): number;
    getHash(): string;
    getMerkleRoot(): string;
    getNbits(): number;
    getNonce(): number;
    getPrevBlockhash(): string;
    getTimestamp(): number;
    getVersion(): number;
    getChainWork(): Buffer;
}
