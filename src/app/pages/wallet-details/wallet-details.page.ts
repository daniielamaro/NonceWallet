import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, RefresherCustomEvent } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { BitcoinApiService } from '../../services/bitcoin-api.service';
import { AlertService } from '../../services/alert.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Wallet } from 'src/app/domain/wallet';

@Component({
  selector: 'app-wallet-details',
  templateUrl: './wallet-details.page.html',
  styleUrls: ['./wallet-details.page.scss'],
  standalone: false,
})
export class WalletDetailsPage implements OnInit {
  
  wallet: Wallet | null = null;
  balance: number = 0;
  pendingReceive: number = 0;
  pendingSend: number = 0;
  loading: boolean = true;
  btcPriceBRL: number = 0;
  btcPriceUSD: number = 0;
  balanceUnit: 'btc' | 'satoshi' | 'brl' = 'btc';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService,
    private bitcoinApi: BitcoinApiService,
    private actionSheetController: ActionSheetController,
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
      this.loadBalance();
    }
  }

  loadWallet(walletId: string) {
    this.wallet = this.storageService.getWallet(walletId);
    if (this.wallet) {
      this.loadBalance();
    } else {
      this.router.navigate(['/home']);
    }
  }

  async loadBalance() {
    if (!this.wallet) return;

    this.loading = true;
    this.balance = await this.bitcoinApi.getBalance(this.wallet.address);
    this.loading = false;

    this.pendingSend = await this.bitcoinApi.getPendingSent(this.wallet.address);

    this.pendingReceive = await this.bitcoinApi.getPendingBalance(this.wallet.address);

    this.btcPriceBRL = await this.bitcoinApi.getBitcoinPriceBRL();

    this.btcPriceUSD = await this.bitcoinApi.getBitcoinPriceUSD();
  }

  async doRefresh(event: RefresherCustomEvent) {
    if (!this.wallet) {
      event.target.complete();
      return;
    }

    let [balance, pendingSend, pendingReceive, priceBRL, priceUSD] = await Promise.all([
      this.bitcoinApi.getBalance(this.wallet.address),
      this.bitcoinApi.getPendingSent(this.wallet.address),
      this.bitcoinApi.getPendingBalance(this.wallet.address),
      this.bitcoinApi.getBitcoinPriceBRL(),
      this.bitcoinApi.getBitcoinPriceUSD()
    ]);
    
    this.balance = balance;
    this.pendingSend = pendingSend;
    this.pendingReceive = pendingReceive;
    this.btcPriceBRL = priceBRL;
    this.btcPriceUSD = priceUSD;

    this.loading = false;
    event.target.complete();
  }


  getAvailableBalance(): number {
    return this.balance;
  }

  getBalanceInBRL(): string {
    const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL();
    return (this.getAvailableBalance() * price).toFixed(2);
  }

  getBalanceInUSD(): string {
    const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD();
    return (this.getAvailableBalance() * price).toFixed(2);
  }

  getPendingReceiveInBRL(): string {
    const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL();
    return (this.pendingReceive * price).toFixed(2);
  }

  getPendingReceiveInUSD(): string {
    const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD();
    return (this.pendingReceive * price).toFixed(2);
  }

  getPendingSendInBRL(): string {
    const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL();
    return (this.pendingSend * price).toFixed(2);
  }

  getPendingSendInUSD(): string {
    const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD();
    return (this.pendingSend * price).toFixed(2);
  }

  getTotalBalance(): number {
    const total = this.balance + this.pendingReceive;
    return Math.max(0, total);
  }

  getTotalBalanceInBRL(): string {
    const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL();
    return (this.getTotalBalance() * price).toFixed(2);
  }

  getTotalBalanceInUSD(): string {
    const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD();
    return (this.getTotalBalance() * price).toFixed(2);
  }

  sendBitcoin() {
    if (this.wallet) {
      this.router.navigate(['/send-bitcoin', this.wallet.id]);
    }
  }

  receiveBitcoin() {
    if (this.wallet) {
      this.router.navigate(['/receive-bitcoin', this.wallet.id]);
    }
  }

  async copyAddress() {
    if (this.wallet) {
      try {
        await navigator.clipboard.writeText(this.wallet.address);
        this.alertService.toastSuccess('Endereço copiado!');
      } catch (error) {
        this.alertService.toastError('Erro ao copiar endereço');
      }
    }
  }

  viewHistory() {
    if (this.wallet) {
      this.router.navigate(['/transaction-history', this.wallet.id]);
    }
  }

  getDisplayBalance(): string {
    if (this.loading) return '0';

    const availableBalance = this.getAvailableBalance();

    switch (this.balanceUnit) {
      case 'btc':
        return availableBalance.toFixed(8);
      case 'satoshi':
        return Math.floor(availableBalance * 100000000).toLocaleString('pt-BR');
      case 'brl':
        const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL();
        return (availableBalance * price).toFixed(2);
      default:
        return availableBalance.toFixed(8);
    }
  }

  getBalanceUnitLabel(): string {
    switch (this.balanceUnit) {
      case 'btc':
        return 'BTC';
      case 'satoshi':
        return 'sat';
      case 'brl':
        return 'R$';
      default:
        return 'BTC';
    }
  }

  getSecondaryBalance(): string {
    if (this.loading) return '';

    const availableBalance = this.getAvailableBalance();

    switch (this.balanceUnit) {
      case 'btc':
        const priceBRL = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL();
        const priceUSD = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD();
        return `R$ ${(availableBalance * priceBRL).toFixed(2)} / $${(availableBalance * priceUSD).toFixed(2)}`;
      case 'satoshi':
        return `${availableBalance.toFixed(8)} BTC`;
      case 'brl':
        return `${availableBalance.toFixed(8)} BTC`;
      default:
        return '';
    }
  }

  toggleBalanceUnit() {
    switch (this.balanceUnit) {
      case 'btc':
        this.balanceUnit = 'satoshi';
        break;
      case 'satoshi':
        this.balanceUnit = 'brl';
        break;
      case 'brl':
        this.balanceUnit = 'btc';
        break;
    }
  }

  refresh() {
    if (this.wallet && !this.loading) {
      this.loadBalance();
    }
  }

  async openMenu() {
    const wallets = this.storageService.getWallets();
    const buttons: any[] = [];

    if (wallets.length > 1) {
      buttons.push({
        text: 'Gerenciar Carteiras',
        icon: 'wallet-outline',
        handler: () => {
          this.router.navigate(['/home']);
        }
      });
    }

    buttons.push(
      {
        text: 'Adicionar Nova Carteira',
        icon: 'add-outline',
        handler: () => {
          this.router.navigate(['/create-wallet']);
        }
      },
      {
        text: 'Cancelar',
        icon: 'close-outline',
        role: 'cancel'
      }
    );

    const actionSheet = await this.actionSheetController.create({
      header: 'Menu',
      buttons: buttons
    });

    await actionSheet.present();
  }
}

