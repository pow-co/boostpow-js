import * as bsv from './bsv'
import * as work from './work/proof'
import { Job } from './job'
import { Output } from './output'
import { Input } from './input'
import { Digest32 } from './fields/digest32'
import { Bytes } from './fields/bytes'
import { Int32Little } from './fields/int32Little'
import { UInt32Little } from './fields/uint32Little'
import { UInt16Little } from './fields/uint16Little'
import { Difficulty } from './fields/difficulty'

// the Job class may represent a complete output in the blockchain but
// it may just be a script without other parameters. Output definitely has
// the satoshi value and outpoint set, which are both necessary for actually
// redeeming a Boost output.
export class Proof {
  lock: Output
  unlock: Input
  proof: work.Proof

  constructor(output: Output, input: Input) {
    this.lock = output
    this.unlock = input
    this.proof = Job.proof(output.script, input.script)
  }

  valid(): boolean {
    return this.lock.txid === this.unlock.spentTxid &&
      this.lock.vout == this.unlock.spentVout && this.proof.valid()
  }

  get content(): Digest32 {
    return this.lock.script.content
  }

  get difficulty(): number {
    return this.lock.script.difficulty
  }

  get time(): UInt32Little {
    return this.unlock.script.time
  }

  get topic(): Bytes {
    return this.lock.script.tag
  }

  get tag(): Bytes {
    return this.lock.script.tag
  }

  get data(): Bytes {
    return this.lock.script.additionalData
  }

  get category(): Int32Little {
    return this.proof.category
  }

  get magicNumber(): UInt16Little {
    return this.proof.magicNumber
  }

  get lockingTxid(): Digest32 {
    return this.lock.txid
  }

  get redeemingTxid(): Digest32 {
    return this.unlock.txid
  }

  get vout(): number {
    return this.lock.vout
  }

  get vin(): number {
    return this.unlock.vin
  }
}
