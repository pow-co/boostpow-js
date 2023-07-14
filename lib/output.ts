import * as bsv from 'bsv'
import { Job } from './job'
import { Digest32 } from './fields/digest32'

// the Job class may represent a complete output in the blockchain but
// it may just be a script without other parameters. Output definitely has
// the satoshi value and outpoint set, which are both necessary for actually
// redeeming a Boost output.
export class Output {
  script: Job
  _value: number | undefined
  _txid: Digest32 | undefined
  _vout: number | undefined

  constructor(job: Job, value?: number, txid?: Digest32, vout?: number) {
    this.script = job
    if (value !== undefined) this._value = value
    else if (job.value === undefined) throw "invalid output: missing parameter value"
    if (txid !== undefined) this._txid = txid
    else if (job.txid === undefined) throw "invalid output: missing parameter txid"
    if (vout !== undefined) this._vout = vout
    else if (job.vout === undefined) throw "invalid output: missing parameter vout"
  }

  /**
   * 
   * @deprecated
   * @param tx 
   * @param vout 
   * @returns 
   */
  static fromTransaction(tx: bsv.Transaction | Buffer, vout: number): Output | undefined {
    let j = Job.fromTransaction(tx, vout)
    if (j) return new Output(j)
  }

  get value(): number {
    if (this.script.value) return this.script.value
    return <number>this._value
  }

  get txid(): Digest32 {
    if (this.script.txid) return Digest32.fromHex(this.script.txid)
    return <Digest32>this._txid
  }

  get vout(): number {
    if (this.script.vout) return this.script.vout
    return <number>this._vout
  }
}
