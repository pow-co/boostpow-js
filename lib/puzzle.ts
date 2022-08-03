import * as bsv from './bsv'
import * as work from './work/proof'
import { Job } from './job'
import { Output } from './output'
import { Redeem } from './redeem'
import { Digest32 } from './fields/digest32'
import { Digest20 } from './fields/digest20'
import { Bytes } from './fields/bytes'
import * as tx_build from './transaction'

// Puzzle represents a Boost output that has had a private key assigned to it.
// This may have happened before or after the output was created, depending on
// whether it has a contract or bounty format.
export class Puzzle {
  output: Output
  key: bsv.PrivateKey
  pubkey: Bytes
  _address: Digest20 | undefined

  constructor(output: Output, k: bsv.PrivateKey | string) {
    let key = new bsv.PrivateKey(k)
    let pub = key.toPublicKey()
    let address: Digest20 = new Digest20(Buffer.from(bsv.Address.fromPublicKey(pub, key.network).toObject().hash, 'hex'))
    if (output.script.minerPubKeyHash) {
      if (!address.equals(output.script.minerPubKeyHash)) throw "invalid parameters"
    } else this._address = address
    this.output = output
    this.key = key
    this.pubkey = new Bytes(pub.toBuffer())
  }

  get address(): Digest20 {
    if (this._address) return this._address
    return <Digest20>this.output.script.minerPubKeyHash
  }

  get workPuzzle(): work.Puzzle {
    return Job.puzzle(this.output.script, this._address)
  }

  // create a redeem script for this output.
  redeem(
    solution: work.Solution,
    // the incomplete tx that will be signed (the input scripts are missing)
    incomplete_transaction: Buffer | bsv.Transaction | tx_build.incomplete_transaction,
    // the index of the input script that we are creating.
    input_index: number,
    sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID,
    flags = bsv.Script.Interpreter.SCRIPT_VERIFY_MINIMALDATA |
      bsv.Script.Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID |
      bsv.Script.Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES |
      bsv.Script.Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES): Redeem {
    if (!new work.Proof(this.workPuzzle, solution).valid()) throw new Error('invalid solution')

    return Redeem.fromSolution(
      new Bytes(tx_build.sign(this.key, {
        satoshis: this.output.value,
        scriptCode: this.output.script.toScript(),
        inputIndex: input_index,
        incompleteTransaction: incomplete_transaction
      }, sigtype, flags)), this.pubkey, solution, this._address)
  }

  expectedRedeemScriptSize(): number {
    return Redeem.expectedSize(
      this.output.script.isBounty(),
      this.output.script.scriptVersion == 2,
      this.key.compressed)
  }

  createRedeemTransaction(
    solution: work.Solution,
    receiveAddress: string,
    sats_per_byte: number,
    op_return: string[]=[
      'boostpow',
      'proof'
    ]): Buffer {

    // step 1. create incomplete transaction.
    let tx = {
      version: 1,
      inputs: [
        {
          prevTxId: this.output.txid.buffer,
          outputIndex: this.output.vout,
          scriptSize: this.expectedRedeemScriptSize()
        }
      ],
      outputs: [
        {
          satoshis: 0,
          script: bsv.Script(new bsv.Address(receiveAddress)).toBuffer()
        },
        {
          satoshis: 0,
          script: bsv.Script.buildSafeDataOut(op_return).toBuffer()
        }
      ]
    }

    // steps 2 - 3: get fee
    let fee = Math.ceil(tx_build.estimateTransactionSize(tx) * sats_per_byte)
    if (fee > this.output.value) throw "not enough sats to be worth it"
    tx.outputs[0].satoshis = this.output.value - fee

    // steps 4 - 6
    return tx_build.writeTransaction({
      version: 1,
      inputs: [
        {
          prevTxId: this.output.txid.buffer,
          outputIndex: this.output.vout,
          script: this.redeem(solution, tx, 0).toBuffer()
        }
      ],
      outputs: tx.outputs
    })
  }
}
