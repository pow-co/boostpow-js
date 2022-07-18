import * as bsv from './bsv'

// How to create a transaction:
//
//  1. Create the INCOMPLETE TRANSACTION. This means that all input scripts
//     are blank. The incomplete_input interface has a field for script_size
//     that you need to fill in from your inputs. You don't know these values
//     exactly because the signatures are variable size and they aren't created
//     yet. The max signature size is 73, so use that value to estimate input
//     script sizes.
//
//  2. Estimate the size of the complete transaction using
//     estimate_transaction_size().
//
//  3. Calculate the fee to be paid for a transaction of this size and adjust
//     values in outputs as needed.
//
//  4. Generate all signatures.
//
//  5. Generate all input scripts.
//
//  6. Insert input scripts in the final tx.

export interface output {
  satoshis: BigInt,
  script: Buffer | string
}

export interface input {
  prevTxId: Buffer | string,
  outputIndex: number,
  script: Buffer | string,
  sequenceNumber?: number
}

export interface transaction {
  version: number,
  inputs: input[],
  outputs: output[],
  locktime?: number
}

export interface incomplete_input {
  prevTxId: Buffer | string,
  outputIndex: number,
  scriptSize: number,
  sequenceNumber?: number
}

export interface incomplete_transaction {
  version: number,
  inputs: incomplete_input[],
  outputs: output[],
  locktime?: number
}

function var_int_size(n: BigInt): number {
  if (n < 253n) return 1
  if (n < 0x10000n) return 3
  if (n < 0x100000000n) return 5
  if (n > 0xffffffffffffffffn) throw "too big"
  return 9
}

export function estimate_transaction_size(x: incomplete_transaction): number {
  let size = 8 + var_int_size(BigInt(x.outputs.length)) + var_int_size(BigInt(x.inputs.length))
  for (let input of x.inputs) size += 40 + var_int_size(BigInt(input.scriptSize)) + input.scriptSize
  for (let output of x.outputs) size += 8 + var_int_size(BigInt(output.script.length)) + output.script.length
  return size
}

export function serialized_transaction_size(x: transaction): number {
  let size = 8 + var_int_size(BigInt(x.outputs.length)) + var_int_size(BigInt(x.inputs.length))
  for (let input of x.inputs) size += 40 + var_int_size(BigInt(input.script.length)) + input.script.length
  for (let output of x.outputs) size += 8 + var_int_size(BigInt(output.script.length)) + output.script.length
  return size
}

class Writer {
  buf: Buffer
  position: number
  constructor(size: number) {
    this.position = 0
    this.buf = Buffer.alloc(size)
  }

  write_buffer(b: Buffer) {
    b.copy(this.buf, this.position)
    this.position += b.length
  }

  write_var_int(n: bigint) {}

  write_input(i: input) {
    this.write_buffer(i.txid.buffer)
    this.write_buffer(i.index.buffer)
    this.write_var_int(i.script.length)
    this.write_buffer(i.script)
    this.write_buffer(i.sequence.buffer)
  }

  write_output(o: output) {
    buf.writeUInt64LEBN(o.value)
    this.position += 8
    this.write_var_int(o.script.length)
    this.write_buffer(o.script)
  }

  write_transaction(tx: transaction) {
    this.write_buffer(tx.version.buffer)
    this.write_var_int(tx.inputs.length)
    for (let input of tx.inputs) this.write_input(input)
    this.write_var_int(tx.outputs.length)
    for (let output of tx.outputs) this.write_output(output)
    this.write_buffer(tx.locktime.buffer)
  }
}

export function write_transaction(tx: transaction): Buffer {
  let w = new Writer(serialized_transaction_size(tx))
  w.write_transaction(tx)
  return w.buf
}

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
