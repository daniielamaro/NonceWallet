import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service';
import { StorageService } from '../../services/storage.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-create-wallet',
  templateUrl: './create-wallet.page.html',
  styleUrls: ['./create-wallet.page.scss'],
  standalone: false,
})
export class CreateWalletPage implements OnInit {
  mode: 'create' | 'import' = 'create';
  walletName: string = '';
  seedWords: string[] = Array(12).fill('');
  generatedSeed: string[] = [];
  seedInputText: string = '';
  loading: boolean = false;

  constructor(
    private walletService: WalletService,
    private storageService: StorageService,
    private router: Router,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    if (this.mode === 'create') {
      this.generateNewSeed();
    }
  }

  generateNewSeed() {
    this.generatedSeed = this.walletService.generateSeed();
    this.seedWords = [...this.generatedSeed];
  }

  async createWallet() {
    if (this.loading) {
      return;
    }

    if (!this.walletName.trim()) {
      await this.alertService.toastError('Por favor, informe um nome para a carteira');
      return;
    }

    this.loading = true;

    try {
      let wallet;
      let seedToUse: string[] = [];

      if (this.mode === 'create') {
        if (this.generatedSeed.length === 0) {
          await this.alertService.toastError('Por favor, gere um seed primeiro');
          this.loading = false;
          return;
        }
        seedToUse = this.generatedSeed;
      } else {
        seedToUse = this.getSeedArray();
        if (seedToUse.length !== 12) {
          await this.alertService.toastError('Por favor, insira todas as 12 palavras do seed');
          this.loading = false;
          return;
        }
        if (!this.walletService.validateSeed(seedToUse)) {
          await this.alertService.toastError('Verifique se todas as palavras estão corretas.');
          this.loading = false;
          return;
        }
      }

      try {
        wallet = await this.walletService.generateWalletFromSeed(seedToUse, this.walletName);
      } catch (genError: any) {
        throw new Error(`Erro ao gerar carteira: ${genError.message || 'Falha na geração da carteira. Verifique se o seed está correto.'}`);
      }

      if (!wallet || !wallet.address || !wallet.privateKey) {
        throw new Error('Carteira gerada está incompleta. Tente novamente.');
      }

      try {
        this.storageService.saveWallet(wallet);
      } catch (saveError: any) {
        throw new Error(`Erro ao salvar carteira: ${saveError.message || 'Falha ao salvar no armazenamento local.'}`);
      }

      try {
        this.alertService.toastSuccess('Carteira criada com sucesso!');
      } catch (alertError: any) {
      }

      this.loading = false;

      this.router.navigate(['/wallet-details', wallet.id]);
    } 
    catch (error: any) {
      let errorMessage = 'Ocorreu um erro ao criar a carteira.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      this.alertService.error(errorMessage);
    } finally {
      this.loading = false;
    }
  }

  getSeedArray(): string[] {
    if (this.seedInputText.trim()) {
      return this.seedInputText.trim().split(/\s+/).filter(w => w.trim() !== '');
    }
    return this.seedWords.filter(w => w.trim() !== '');
  }

  onSeedInputPaste() {
    const words = this.seedInputText.trim().split(/\s+/).filter(w => w.trim() !== '');
    if (words.length <= 12) {
      for (let i = 0; i < 12; i++) {
        this.seedWords[i] = words[i] || '';
      }
    }
  }

  isWordValid(word: string): boolean {
    return this.walletService.isWordValid(word);
  }

  getFilledWordsCount(): number {
    return this.getSeedArray().length;
  }

  isSeedComplete(): boolean {
    const seed = this.getSeedArray();
    return seed.length === 12 && this.walletService.validateSeed(seed);
  }

  async copySeed() {
    const seedText = this.generatedSeed.join(' ');
    try {
      await navigator.clipboard.writeText(seedText);
      this.alertService.toastSuccess('Seed copiado!');
    } catch (error) {
      this.alertService.toastError('Não foi possível copiar o seed. Tente novamente.')
        .catch(() => {});
    }
  }

  onModeChange() {
    if (this.mode === 'create') {
      this.generateNewSeed();
    } else {
      this.generatedSeed = [];
      this.seedWords = Array(12).fill('');
      this.seedInputText = '';
    }
  }

  clearSeedInput() {
    this.seedWords = Array(12).fill('');
    this.seedInputText = '';
  }

  hasSeedInput(): boolean {
    return !!this.seedInputText || this.seedWords.some(w => w && w.trim() !== '');
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }
}

