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
  let size = 8 + var_int_size(x.outputs.length) + var_int_size(x.inputs.length)
  for (let input of x.inputs) size += 40 + var_int_size(input.scriptSize) + input.scriptSize
  for (let output of x.outputs) size += 8 + var_int_size(output.script.length) + output.script.length
  return size
}

export function serialized_transaction_size(x: transaction): number {
  let size = 8 + var_int_size(x.outputs.length) + var_int_size(x.inputs.length)
  for (let input of x.inputs) size += 40 + var_int_size(input.script.length) + input.script.length
  for (let output of x.outputs) size += 8 + var_int_size(output.script.length) + output.script.length
  return size
}

class Writer {
  buf: Buffer
  position: number
  constructor(size: number) {
    position = 0
    buf = Buffer.alloc(size)
  }

  write_buffer(b: Buffer) {
    b.copy(buf, position)
    position += b.length
  }

  write_var_int(n: bsv.BN) {}

  write_input(i: input) {
    write_buffer(i.txid.buffer)
    write_buffer(i.index.buffer)
    write_var_int(i.script.length)
    write_buffer(i.script)
    write_buffer(i.sequence.buffer)
  }

  write_output(o: output) {
    buf.writeUInt64LEBN(o.value)
    position += 8
    write_var_int(o.script.length)
    write_buffer(o.script)
  }

  write_transaction(tx: transaction) {
    write_buffer(tx.version.buffer)
    write_var_int(tx.inputs.length)
    for (let input of tx.inputs) write_input(input)
    write_var_int(x.outputs.length)
    for (let output of tx.outputs) write_output(output)
    write_buffer(tx.locktime.buffer)
  }
}

export function write_transaction(tx: transaction): Buffer {
  let w = new Writer(transaction_serialized_size(x))
  write_transaction(tx)
  return w.buf
}

export function write_incomplete_transaction(tx: transaction): Buffer {
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
