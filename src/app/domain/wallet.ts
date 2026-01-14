export interface Wallet {
    id: string;
    name: string;
    address: string;
    privateKey: string;
    seed: string[];
    createdAt: number;
}