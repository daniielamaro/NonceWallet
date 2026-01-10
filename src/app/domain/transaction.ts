export interface Transaction {
    txid: string;
    type: 'sent' | 'received' | 'self';
    amount: number;
    amountSatoshis: number;
    confirmed: boolean;
    blockHeight?: number;
    blockTime: number;
    fee: number;
    inputs: number;
    outputs: number;
}