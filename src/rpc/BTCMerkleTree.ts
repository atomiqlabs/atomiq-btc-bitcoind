import {createHash} from "crypto";

type BitcoindRawBlockTxDetails1 = {
    hash: string,
    confirmations: number,
    size: number,
    strippedsize: number,
    weight: number,
    height: number,
    version: number,
    versionHex: string,
    merkleroot: string,
    tx: string[],
    time: number,
    mediantime: number,
    nonce: number,
    bits: string,
    difficulty: number,
    nTx: number,
    previousblockhash: string,
    nextblockhash: string
}

const blockCache: Map<string, BitcoindRawBlockTxDetails1> = new Map();

export class BTCMerkleTree {

    static dblSha256(buffer: Buffer): Buffer {
        return createHash("sha256").update(
            createHash("sha256").update(buffer).digest()
        ).digest()
    }

    static calcTreeWidth(height: number, nTxs: number): number {
        return (nTxs+(1 << height)-1) >> height;
    }

    static computePartialHash(height: number, pos: number, txIds: Buffer[]): Buffer {

        if(height===0) {
            return txIds[pos];
        } else {
            const left = BTCMerkleTree.computePartialHash(height-1, pos*2, txIds);
            let right;
            if(pos*2+1 < BTCMerkleTree.calcTreeWidth(height-1, txIds.length)) {
                right = BTCMerkleTree.computePartialHash(height-1, pos*2+1, txIds);
            } else {
                right = left;
            }

            return BTCMerkleTree.dblSha256(Buffer.concat([
                left, right
            ]));
        }

    }

    static async getTransactionMerkle(txId: string, blockhash: string, btcRpc: any): Promise<{
        reversedTxId: Buffer,
        pos: number,
        merkle: Buffer[],
        blockheight: number
    } | null> {
        let block = blockCache.get(blockhash);
        if(block==null) {
            block = await new Promise<BitcoindRawBlockTxDetails1>((resolve, reject) => {
                btcRpc.getBlock(blockhash, 1, (err: any, res: { error: any; result: BitcoindRawBlockTxDetails1; }) => {
                    if(err || res.error) {
                        reject(err || res.error);
                        return;
                    }
                    resolve(res.result);
                })
            });
            blockCache.set(blockhash, block);
        }

        const position = block.tx.indexOf(txId);
        if(position===-1) return null;
        const txIds = block.tx.map(e => Buffer.from(e, "hex").reverse());

        const reversedMerkleRoot = Buffer.from(block.merkleroot, "hex").reverse();

        const proof = [];
        let n = position;
        while(true) {
            if(n%2===0) {
                //Left
                const treeWidth = BTCMerkleTree.calcTreeWidth(proof.length, txIds.length);
                if(treeWidth===1) {
                    break;
                } else if(treeWidth<=n+1) {
                    proof.push(BTCMerkleTree.computePartialHash(proof.length, n, txIds));
                } else {
                    proof.push(BTCMerkleTree.computePartialHash(proof.length, n+1, txIds));
                }
            } else {
                //Right
                proof.push(BTCMerkleTree.computePartialHash(proof.length, n-1, txIds));
            }
            n = Math.floor(n/2);
        }

        const blockHeight = block.height;

        return {
            reversedTxId: Buffer.from(txId, "hex").reverse(),
            pos: position,
            merkle: proof,
            blockheight: blockHeight
        }

    }
}