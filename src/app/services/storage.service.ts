import { Injectable } from '@angular/core';
import { Wallet } from './wallet.service';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly WALLETS_KEY = 'bitcoin_wallets';

  getWallets(): Wallet[] {
    const walletsJson = localStorage.getItem(this.WALLETS_KEY);
    if (!walletsJson) {
      return [];
    }
    
    try {
      const wallets = JSON.parse(walletsJson);
      return wallets.map((wallet: any) => {
        if (!wallet.addressType) {
          wallet.addressType = 'segwit';
        }
        return wallet;
      });
    } catch (error) {
      console.error('Erro ao ler carteiras:', error);
      return [];
    }
  }

  saveWallet(wallet: Wallet): void {
    const wallets = this.getWallets();
    const existingIndex = wallets.findIndex(w => w.id === wallet.id);
    
    if (existingIndex >= 0) {
      wallets[existingIndex] = wallet;
    } else {
      wallets.push(wallet);
    }
    
    localStorage.setItem(this.WALLETS_KEY, JSON.stringify(wallets));
  }

  deleteWallet(walletId: string): void {
    const wallets = this.getWallets();
    const filtered = wallets.filter(w => w.id !== walletId);
    localStorage.setItem(this.WALLETS_KEY, JSON.stringify(filtered));
  }

  getWallet(walletId: string): Wallet | null {
    const wallets = this.getWallets();
    return wallets.find(w => w.id === walletId) || null;
  }
}

