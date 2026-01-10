import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { AlertService } from 'src/app/services/alert.service';
import { Wallet } from 'src/app/domain/wallet';

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
    private router: Router,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    this.loadWallets();
    this.checkAutoNavigate();
  }

  loadWallets() {
    this.wallets = this.storageService.getWallets();
  }

  ionViewWillEnter() {
    this.loadWallets();
    if (!this.hasNavigated) {
      this.checkAutoNavigate();
    }
  }

  checkAutoNavigate() {
    if (this.wallets.length === 1 && !this.hasNavigated) {
      this.hasNavigated = true;
      this.router.navigate(['/wallet-details', this.wallets[0].id]);
    }
  }

  async deleteWallet(event: Event, wallet: Wallet) {
    event.stopPropagation();
    let awnser = await this.alertService.question(`Tem certeza que deseja excluir a carteira "${wallet.name}"?`);
    if (awnser.isConfirmed) {
      this.storageService.deleteWallet(wallet.id);
      this.loadWallets();
    }
  }
}
