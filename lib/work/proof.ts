import * as bsv from '../bsv'
import { Int32Little } from '../fields/int32Little'
import { UInt32Little } from '../fields/uint32Little'
import { UInt32Big } from '../fields/uint32Big'
import { Digest32 } from '../fields/digest32'
import { Bytes } from '../fields/bytes'
import { Difficulty } from '../fields/difficulty'
import { Utils } from '../utils'
import { PowString } from './string'
export { PowString } from './string'

// TODO the puzzle also needs to contain a Merkle branch but for Boost that is empty.
export class Puzzle {
  constructor(
    public Category: Int32Little,
    public Content: Digest32,
    public Difficulty: Difficulty,
    public MetaBegin: Bytes,
    public MetaEnd: Bytes,
    public Mask?: Int32Little) {}
}

export class Solution {
  constructor(
    public Time: UInt32Little,
    public ExtraNonce1: UInt32Big,
    public ExtraNonce2: Bytes,
    public Nonce: UInt32Little,
    public GeneralPurposeBits?: Int32Little) {}

  toJSON() {
    let json = {
      share: {
        timestamp: this.Time.hex,
        nonce: this.Nonce.hex,
        extra_nonce_2: this.Nonce.hex
      },
      extra_nonce_1: this.ExtraNonce1.hex
    }

    if (this.GeneralPurposeBits) json.share["bits"] = this.GeneralPurposeBits.hex

    return json
  }

  static fromJSON(x): Solution | undefined {
    if (!x.share || !x.extra_nonce_1 ||
      !x.share.timestamp || !x.share.nonce || !x.share.extra_nonce_2 ||
      typeof x.extra_nonce_1 !== 'string' ||
      typeof x.share.timestamp !== 'string' ||
      typeof x.share.nonce !== 'string' ||
      typeof x.share.extra_nonce_2 !== 'string' ||
      (!!x.share.bits && typeof x.share.bits !== 'string')) return

    let time = UInt32Little.fromHex(x.share.timestamp)
    if (time === undefined) return

    let en1 = UInt32Big.fromHex(x.extra_nonce_1)
    if (en1 === undefined) return

    let en2 = Bytes.fromHex(x.share.extra_nonce_2)
    if (en2 === undefined) return

    let n = UInt32Little.fromHex(x.share.nonce)
    if (n === undefined) return

    let gpr: Int32Little | undefined
    if (!!x.share.bits) {
      gpr = Int32Little.fromHex(x.share.bits)
      if (gpr === undefined) return
    }

    return new Solution(time, en1, en2, n, gpr)
  }
}

export function meta(p: Puzzle, x: Solution): Bytes {
  return new Bytes(Buffer.concat([
    p.MetaBegin.buffer,
    x.ExtraNonce1.buffer,
    x.ExtraNonce2.buffer,
    p.MetaEnd.buffer
  ]))
}

export function pow_string(p: Puzzle, x: Solution): PowString | undefined {
  var category: Buffer
  if (p.Mask) {
    var generalPurposeBits = x.GeneralPurposeBits
    if (generalPurposeBits) {
      category = Utils.writeInt32LE(
        (p.Category.number & p.Mask.number) |
          (generalPurposeBits.number & ~p.Mask.number))
    } else {
      return
    }
  } else if (x.GeneralPurposeBits) {
      return
  } else {
    category = p.Category.buffer
  }

  const boostPowMetadataCoinbaseString = meta(p, x)

  return new PowString(bsv.BlockHeader.fromBuffer(Buffer.concat([
    category,
    p.Content.buffer,
    boostPowMetadataCoinbaseString.hash256.buffer,
    x.Time.buffer,
    p.Difficulty.buffer,
    x.Nonce.buffer,
  ])))
}

// TODO the puzzle also needs to contain a Merkle branch but for Boost that is empty.
export class Proof {
  constructor(
    public Puzzle: Puzzle,
    public Solution: Solution) {}

  metadata(): Bytes {
    return meta(this.Puzzle, this.Solution)
  }

  string(): PowString | undefined {
    return pow_string(this.Puzzle, this.Solution)
  }

  valid(): boolean {
    let x = this.string()
    if (x) {
      return x.valid()
    }

    return false
  }
}
