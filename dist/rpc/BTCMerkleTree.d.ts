/// <reference types="node" />
export declare class BTCMerkleTree {
    static dblSha256(buffer: Buffer): Buffer;
    static calcTreeWidth(height: number, nTxs: number): number;
    static computePartialHash(height: number, pos: number, txIds: Buffer[]): Buffer;
    static getTransactionMerkle(txId: string, blockhash: string, btcRpc: any): Promise<{
        reversedTxId: Buffer;
        pos: number;
        merkle: Buffer[];
        blockheight: number;
    }>;
}
