import * as bsv from './bsv'
import { Digest32 } from './fields/digest32'
import { Int32Little } from './fields/int32Little'
import { UInt32Little } from './fields/uint32Little'

// How to create a transaction:
//
//  1. Create the INCOMPLETE TRANSACTION. This means that all input scripts
//     are blank. The incomplete_input interface has a field for script_size
//     that you need to fill in from your inputs. You don't know these values
//     exactly because the signatures are variable size and they aren't created
//     yet. The max signature size is 73, so use that value to estimate input
//     script sizes.
//
//  2. Estimate the SIZE of the complete transaction using
//     estimate_transaction_size().
//
//  3. Calculate the FEE to be paid for a transaction of this size and adjust
//     values in outputs as needed.
//
//  4. Generate all SIGNATURES.
//
//  5. Generate all INPUT SCRIPTS.
//
//  6. Insert input scripts in the FINAL TRANSACTION.

// (step 1) the incomplete transaction
export interface incomplete_input {
  // if it's a string, it's assumed to be the backwards hex version of the hash,
  // in accordance with a horribly stupid convention that we have in Bitcoin.
  prevTxId: Buffer | string | Digest32,

  outputIndex: number | UInt32Little,

  // you are required to correctly estimate the script size here. Signatures
  // should be estimated to have size 73, which is the maximum signature size.
  scriptSize: number | bigint,

  // default is 0xffffffff, which indicates that the input is finalized, insofar
  // as no higher number is possible.
  sequenceNumber?: number | UInt32Little
}

export interface output {
  satoshis: bigint,
  script: Buffer | string
}

export interface incomplete_transaction {
  version: number | Int32Little,
  inputs: incomplete_input[],
  outputs: output[],
  locktime?: number | UInt32Little
}

function var_int_size(n: bigint): bigint {
  if (n < 253n) return 1n
  if (n < 0x10000n) return 3n
  if (n < 0x100000000n) return 5n
  if (n > 0xffffffffffffffffn) throw "too big"
  return 9n
}

// (step 2) given an incomplete transaction, we determine the expected size here.
// this is used to determine the fee.
export function estimate_transaction_size(x: incomplete_transaction): bigint {
  let size = 8n + var_int_size(BigInt(x.outputs.length)) + var_int_size(BigInt(x.inputs.length))
  for (let input of x.inputs) size += 40n + var_int_size(BigInt(input.scriptSize)) + BigInt(input.scriptSize)
  for (let output of x.outputs) size += 8n + var_int_size(BigInt(output.script.length)) + BigInt(output.script.length)
  return size
}

export interface input {
  prevTxId: Buffer | string | Digest32,
  outputIndex: number | UInt32Little,
  script: Buffer | string,
  sequenceNumber?: number | UInt32Little
}

export interface transaction {
  version: number | Int32Little,
  inputs: input[],
  outputs: output[],
  locktime?: number | UInt32Little
}

export function serialized_size(x: transaction): BigInt {
  let size = 8n + var_int_size(BigInt(x.outputs.length)) + var_int_size(BigInt(x.inputs.length))
  for (let input of x.inputs) size += 40n + var_int_size(BigInt(input.script.length)) + BigInt(input.script.length)
  for (let output of x.outputs) size += 8n + var_int_size(BigInt(output.script.length)) + BigInt(output.script.length)
  return size
}

class Writer {
  buf: Buffer
  position: number

  constructor(size: BigInt) {
    this.position = 0
    this.buf = Buffer.alloc(Number(size))
  }

  write_buffer(b: Buffer) {
    b.copy(this.buf, this.position)
    this.position += b.length
  }

  write_var_int(n: BigInt) {}

  write_input(i: input) {
    this.write_buffer(i.prevTxId instanceof Buffer ?
      i.prevTxId : (i.prevTxId instanceof Digest32 ?
        i.prevTxId : Digest32.fromHex(i.prevTxId)).buffer)

    this.write_buffer((i.outputIndex instanceof UInt32Little ?
      i.outputIndex : UInt32Little.fromNumber(i.outputIndex)).buffer)

    let script: Buffer = i.script instanceof Buffer ? i.script : Buffer.from(i.script, 'hex')
    this.write_var_int(BigInt(script.length))
    this.write_buffer(script)

    this.write_buffer((i.outputIndex instanceof UInt32Little ?
      i.outputIndex : UInt32Little.fromNumber((!i.outputIndex) ?
        0xffffffff : i.outputIndex)).buffer)
  }

  write_output(o: output) {
    this.buf.writeBigUInt64LE(o.satoshis)
    this.position += 8

    let script: Buffer = o.script instanceof Buffer ? o.script : Buffer.from(o.script, 'hex')
    this.write_var_int(BigInt(script.length))
    this.write_buffer(script)
  }

  write_transaction(tx: transaction) {
    this.write_buffer((tx.version instanceof Int32Little ?
      tx.version : UInt32Little.fromNumber(tx.version)).buffer)

    this.write_var_int(BigInt(tx.inputs.length))
    for (let input of tx.inputs) this.write_input(input)

    this.write_var_int(BigInt(tx.outputs.length))
    for (let output of tx.outputs) this.write_output(output)

    this.write_buffer((tx.locktime instanceof UInt32Little ?
      tx.locktime : UInt32Little.fromNumber((!tx.locktime) ?
        0 : tx.locktime)).buffer)
  }
}

// write a transaction in the format given above to a buffer
export function write_transaction(tx: transaction): Buffer {
  let w = new Writer(serialized_size(tx))
  w.write_transaction(tx)
  return w.buf
}

// (step 4) write incomplete transaction for signing.
export function write_incomplete_transaction(tx: incomplete_transaction): Buffer {
  let inputs: input[] = []
  for (let input of tx.inputs) inputs.push({
    prevTxId: input.prevTxId,
    outputIndex: input.outputIndex,
    script: Buffer.alloc(0),
    sequenceNumber: input.sequenceNumber
  })

  return write_transaction({
    version: tx.version,
    inputs: inputs,
    outputs: tx.outputs,
    locktime: tx.locktime
  })
}

/*
class Writer {
  buf: Buffer
  position: number
  constructor(size: number) {
    position = 0
    buf = Buffer.alloc(size)
  }

  read_var_int(): BigInt | undefined {

  }

  read(n: number): Buffer | undefined {
    let b = Buffer.alloc(n)
    buf.copy(b, 0, position, position + n)
    position += n
    return b
  }

  read_output(): output | undefined {
    let value = buf.readBigInt64LE(position)
    position += 8
    if (value === undefined) return
    let script_size = read_var_int()
    if (script_size === undefined) return
    let script = read(script_size)
    if (script === undefined) return

    return {
      value: value,
      script: script
    }
  }

  read_input(): input | undefined {
    let txid = read(32)
    if (txid === undefined) return
    let index = read(4)
    if (index === undefined) return
    let script_size = read_var_int()
    if (script_size === undefined) return
    let script = read(script_size)
    if (script === undefined) return
    let sequence = read(4)
    if (sequence === undefined) return

    return {
      txid: new Digest32(txid),
      index: new UInt32Little(index),
      script: script,
      sequence: new UInt32Little(sequenceoo)
    }
  }

  read_inputs(): input[] | undefined {
    let num_inputs = read_var_int()
    if (num_inputs === undefined) return
    let ins : input[] = []
    for (let i = 0; i < num_inputs; i++) {
      let in = read_input()
      if (in === undfined) return
      ins[i] = in
    }
    return ins
  }

  read_outputs(): output[] | undefined {
    let num_outputs = read_var_int()
    if (num_outputs === undefined) return
    let outs : output[] = []
    for (let i = 0; i < num_outputs; i++) {
      let out = read_output()
      if (out === undfined) return
      outs[i] = out
    }
    return outs
  }

  read_transaction(): transaction | undefined {
    let version = read(4)
    if (version === undefined) return
    let inputs = read_inputs()
    if (inputs === undefined) return
    let outputs = read_outputs()
    if (outputs === undefined) return
    let locktime = read(4)

    return {
      version: new Int32Little(version),
      inputs: inputs,
      outputs: outputs,
      locktime: new UInt32Little(locktime)
    }
  }
}

export function read_transaction(x: Buffer): transaction | undefined {
  return new Writer(x).read_transaction()
}*/
