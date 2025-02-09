"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BTCMerkleTree = void 0;
const crypto_1 = require("crypto");
class BTCMerkleTree {
    static dblSha256(buffer) {
        return (0, crypto_1.createHash)("sha256").update((0, crypto_1.createHash)("sha256").update(buffer).digest()).digest();
    }
    static calcTreeWidth(height, nTxs) {
        return (nTxs + (1 << height) - 1) >> height;
    }
    static computePartialHash(height, pos, txIds) {
        if (height === 0) {
            return txIds[pos];
        }
        else {
            const left = BTCMerkleTree.computePartialHash(height - 1, pos * 2, txIds);
            let right;
            if (pos * 2 + 1 < BTCMerkleTree.calcTreeWidth(height - 1, txIds.length)) {
                right = BTCMerkleTree.computePartialHash(height - 1, pos * 2 + 1, txIds);
            }
            else {
                right = left;
            }
            return BTCMerkleTree.dblSha256(Buffer.concat([
                left, right
            ]));
        }
    }
    static getTransactionMerkle(txId, blockhash, btcRpc) {
        return __awaiter(this, void 0, void 0, function* () {
            const block = yield new Promise((resolve, reject) => {
                btcRpc.getBlock(blockhash, 1, (err, res) => {
                    if (err || res.error) {
                        reject(err || res.error);
                        return;
                    }
                    resolve(res.result);
                });
            });
            const position = block.tx.indexOf(txId);
            const txIds = block.tx.map(e => Buffer.from(e, "hex").reverse());
            const reversedMerkleRoot = Buffer.from(block.merkleroot, "hex").reverse();
            const proof = [];
            let n = position;
            while (true) {
                if (n % 2 === 0) {
                    //Left
                    const treeWidth = BTCMerkleTree.calcTreeWidth(proof.length, txIds.length);
                    if (treeWidth === 1) {
                        break;
                    }
                    else if (treeWidth <= n + 1) {
                        proof.push(BTCMerkleTree.computePartialHash(proof.length, n, txIds));
                    }
                    else {
                        proof.push(BTCMerkleTree.computePartialHash(proof.length, n + 1, txIds));
                    }
                }
                else {
                    //Right
                    proof.push(BTCMerkleTree.computePartialHash(proof.length, n - 1, txIds));
                }
                n = Math.floor(n / 2);
            }
            const blockHeight = block.height;
            return {
                reversedTxId: Buffer.from(txId, "hex").reverse(),
                pos: position,
                merkle: proof,
                blockheight: blockHeight
            };
        });
    }
}
exports.BTCMerkleTree = BTCMerkleTree;
