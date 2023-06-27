import * as bsv from './bsv'
import { Redeem } from './redeem'
import { Digest32 } from './fields/digest32'

// Input represents an input that redeems a boost job, as opposed to Redeem,
// which is merely a script and optionally an input. Whereas the parameters
// txid, vin, spentTxid, and spentVout are optional in Redeem, they are required
// here, either given explicitly in the constructor or having been given in the
// Redeem class.
export class Input {
  script: Redeem
  _txid?: Digest32 | undefined
  _vin?: number | undefined
  _spentTxid?: Digest32 | undefined
  _spentVout?: number | undefined

  constructor(script: Redeem, txid?: Digest32, vin?: number, spentTxid?: Digest32, spentVout?: number) {
    this.script = script
    if (txid !== undefined) this._txid = txid
    else if (script.txid === undefined) throw "invalid output: missing parameter txid"
    if (vin !== undefined) this._vin = vin
    else if (script.vin === undefined) throw "invalid output: missing parameter vout"
    if (spentTxid !== undefined) this._txid = txid
    else if (script.txid === undefined) throw "invalid output: missing parameter txid"
    if (spentVout !== undefined) this._vin = vin
    else if (script.vin === undefined) throw "invalid output: missing parameter vout"
  }

  static fromTransaction(tx: bsv.Transaction | Buffer, vin: number): Input | undefined {
    let j = Redeem.fromTransaction(tx, vin)
    if (j) return new Input(j)
  }

  get txid(): Digest32 {
    if (this.script.txid) return Digest32.fromHex(this.script.txid)
    return <Digest32>this._txid
  }

  get vin(): number {
    if (this.script.vin) return this.script.vin
    return <number>this._vin
  }

  get spentTxid(): Digest32 {
    if (this.script.spentTxid) return Digest32.fromHex(this.script.spentTxid)
    return <Digest32>this._spentTxid
  }

  get spentVout(): number {
    if (this.script.spentVout) return this.script.spentVout
    return <number>this._spentVout
  }
}
