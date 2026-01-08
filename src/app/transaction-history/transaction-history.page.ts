import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Wallet } from '../services/wallet.service';
import { StorageService } from '../services/storage.service';
import { BitcoinApiService } from '../services/bitcoin-api.service';
import { AlertService } from '../services/alert.service';

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

@Component({
  selector: 'app-transaction-history',
  templateUrl: './transaction-history.page.html',
  styleUrls: ['./transaction-history.page.scss'],
  standalone: false,
})
export class TransactionHistoryPage implements OnInit {
  wallet: Wallet | null = null;
  transactions: Transaction[] = [];
  loading: boolean = true;
  btcPriceBRL: number = 0;
  btcPriceUSD: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService,
    private bitcoinApi: BitcoinApiService,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    const walletId = this.route.snapshot.paramMap.get('id');
    if (walletId) {
      this.loadWallet(walletId);
    }
  }

  ionViewWillEnter() {
    if (this.wallet) {
      this.loadTransactionHistory();
    }
  }

  loadWallet(walletId: string) {
    this.wallet = this.storageService.getWallet(walletId);
    if (this.wallet) {
      this.loadTransactionHistory();
    } else {
      this.router.navigate(['/home']);
    }
  }

  loadTransactionHistory() {
    if (!this.wallet) return;

    this.loading = true;
    this.bitcoinApi.getTransactionHistory(this.wallet.address, 50).subscribe(
      transactions => {
        this.transactions = transactions;
        this.loading = false;
      },
      error => {
        console.error('Erro ao carregar histórico:', error);
        this.loading = false;
      }
    );

    this.bitcoinApi.getBitcoinPriceBRL().subscribe(priceBRL => {
      this.btcPriceBRL = priceBRL;
    });

    this.bitcoinApi.getBitcoinPriceUSD().subscribe(priceUSD => {
      this.btcPriceUSD = priceUSD;
    });
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getAmountInBRL(amount: number): string {
    const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL();
    return (Math.abs(amount) * price).toFixed(2);
  }

  getAmountInUSD(amount: number): string {
    const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD();
    return (Math.abs(amount) * price).toFixed(2);
  }

  openInMempool(txid: string) {
    window.open(`https://mempool.space/tx/${txid}`, '_blank');
  }

  async copyTxId(txid: string) {
    try {
      await navigator.clipboard.writeText(txid);
      this.alertService.toastSuccess('TXID copiado!');
    } catch (error) {
      this.alertService.toastError('Erro ao copiar TXID');
    }
  }

  refresh() {
    this.loadTransactionHistory();
  }

  abs(value: number): number {
    return Math.abs(value);
  }
}

