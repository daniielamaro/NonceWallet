import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Wallet } from '../services/wallet.service';
import { StorageService } from '../services/storage.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  wallets: Wallet[] = [];
  private hasNavigated = false;

  constructor(
    private storageService: StorageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadWallets();
    this.checkAutoNavigate();
  }

  ionViewWillEnter() {
    this.loadWallets();
    if (!this.hasNavigated) {
      this.checkAutoNavigate();
    }
  }

  loadWallets() {
    this.wallets = this.storageService.getWallets();
  }

  checkAutoNavigate() {
    if (this.wallets.length === 1 && !this.hasNavigated) {
      this.hasNavigated = true;
      this.router.navigate(['/wallet-details', this.wallets[0].id]);
    }
  }

  addWallet() {
    this.router.navigate(['/create-wallet']);
  }

  openWallet(wallet: Wallet) {
    this.router.navigate(['/wallet-details', wallet.id]);
  }

  deleteWallet(event: Event, wallet: Wallet) {
    event.stopPropagation();
    if (confirm(`Tem certeza que deseja excluir a carteira "${wallet.name}"?`)) {
      this.storageService.deleteWallet(wallet.id);
      this.loadWallets();
    }
  }
}
