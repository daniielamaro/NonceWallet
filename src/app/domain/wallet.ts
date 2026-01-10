export type AddressType = 'segwit' | 'taproot';

export interface Wallet {
    id: string;
    name: string;
    address: string;
    privateKey: string;
    seed: string[];
    addressType: AddressType;
    createdAt: number;
}