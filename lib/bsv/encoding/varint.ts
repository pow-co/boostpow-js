'use strict'

import {BufferWriter} from './bufferwriter'
import {BufferReader} from './bufferreader'
import {BN} from '../crypto/bn'

export class Varint {
  buf: Buffer
  constructor(buf: Buffer | number | BN | {buf: Buffer}) {
    if (Buffer.isBuffer(buf)) {
      this.buf = buf
    } else if (typeof buf === 'number') {
      this.buf = new BufferWriter().writeVarintNum(buf).concat()
    } else if (buf instanceof BN) {
      this.buf = new BufferWriter().writeVarintBN(buf).concat()
    } else {
      this.buf = buf.buf
    }
  }

  fromBuffer(buf: Buffer): Varint {
    this.buf = buf
    return this
  }

  set(obj: {buf: Buffer}): Varint {
    return this.fromBuffer(obj.buf)
  }

  fromString(str): Varint {
    this.set({
      buf: Buffer.from(str, 'hex')
    })
    return this
  }

  toString(): string {
    return this.buf.toString('hex')
  }

  fromBufferReader(br: BufferReader): Varint {
    this.buf = br.readVarintBuf()
    return this
  }

  fromBN(bn: BN): Varint {
    this.buf = new BufferWriter().writeVarintBN(bn).concat()
    return this
  }

  fromNumber(num: number): Varint {
    this.buf = new BufferWriter().writeVarintNum(num).concat()
    return this
  }

  toBuffer() : Buffer{
    return this.buf
  }

  toBN(): BN {
    return new BufferReader(this.buf).readVarintBN()
  }

  toNumber(): number {
    return new BufferReader(this.buf).readVarintNum()
  }
}
