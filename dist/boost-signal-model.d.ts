import { Int32Little } from './fields/int32Little';
import { UInt32Little } from './fields/uint32Little';
import { Digest32 } from './fields/digest32';
import { Digest20 } from './fields/digest20';
import { BoostPowStringModel } from './boost-pow-string-model';
import { BoostPowMetadataModel } from './boost-pow-metadata-model';
export declare class BoostSignalModel {
    private boostPowString;
    private boostPowMetadata;
    private boostJobId?;
    private boostJobProofId?;
    private constructor();
    getBoostJobId(): string | undefined;
    getBoostJobProofId(): string | undefined;
    getBoostPowString(): BoostPowStringModel;
    getBoostMetadata(): BoostPowMetadataModel;
    hash(): Digest32;
    difficulty(): number;
    energy(): number;
    content(): Digest32;
    category(): Int32Little;
    metadataHash(): Digest32;
    time(): UInt32Little;
    nonce(): UInt32Little;
    tag(hex?: boolean): string | null;
    userNonce(): UInt32Little | null;
    additionalData(hex?: boolean): string | null;
    minerPubKeyHash(): Digest20 | null;
    toString(): string;
    toObject(): any;
}
