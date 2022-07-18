import * as bsv from './bsv'

export interface output {
  satoshis: bsv.BN,
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
  locktime: number
}
