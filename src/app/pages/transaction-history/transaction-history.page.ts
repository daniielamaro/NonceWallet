import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { BitcoinApiService } from '../../services/bitcoin-api.service';
import { AlertService } from '../../services/alert.service';
import { Wallet } from 'src/app/domain/wallet';
import { Transaction } from 'src/app/domain/transaction';

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

  async loadTransactionHistory() {
    if (!this.wallet) return;

    this.loading = true;
    this.transactions = await this.bitcoinApi.getTransactionHistory(this.wallet.address, 50);
    this.loading = false;

    this.btcPriceBRL = await this.bitcoinApi.getBitcoinPriceBRL();

    this.btcPriceUSD = await this.bitcoinApi.getBitcoinPriceUSD();
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

