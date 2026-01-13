import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { BitcoinApiService } from '../../services/bitcoin-api.service';
import { TransactionService } from '../../services/transaction.service';
import { AlertService } from '../../services/alert.service';
import { Wallet } from 'src/app/domain/wallet';
import { Transaction } from 'src/app/domain/transaction';
import Decimal from 'decimal.js';

interface RBFStatus {
  supportsRBF: boolean;
  canAccelerate: boolean;
  canCancel: boolean;
  feeDifference?: number;
  reason?: string;
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
  rbfStatus: Map<string, RBFStatus> = new Map();
  availableBalance: number = 0;
  processingRBF: Set<string> = new Set();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService,
    private bitcoinApi: BitcoinApiService,
    private transactionService: TransactionService,
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
    this.availableBalance = await this.bitcoinApi.getBalance(this.wallet.address);
    this.loading = false;

    this.btcPriceBRL = await this.bitcoinApi.getBitcoinPriceBRL();
    this.btcPriceUSD = await this.bitcoinApi.getBitcoinPriceUSD();

    await this.checkRBFStatus();
  }

  async checkRBFStatus() {
    if (!this.wallet) return;

    this.rbfStatus.clear();

    for (const tx of this.transactions) {
      if (tx.type === 'sent' && !tx.confirmed) {
        try {
          const supportsRBF = await this.bitcoinApi.checkTransactionSupportsRBF(tx.txid);
          
          if (supportsRBF) {
            const txDetails = await this.bitcoinApi.getTransaction(tx.txid);
            
            if (txDetails) {
              let originalInputValue = 0;
              
              if (txDetails.vin) {
                for (const input of txDetails.vin) {
                  if (input.prevout && input.prevout.scriptpubkey_address === this.wallet!.address) {
                    originalInputValue += input.prevout.value || 0;
                  }
                }
              }
              
              let originalAmountSatoshis = 0;
              let originalChangeAmount = 0;
              
              if (txDetails.vout) {
                for (const output of txDetails.vout) {
                  if (output.scriptpubkey_address === this.wallet!.address) {
                    originalChangeAmount += output.value || 0;
                  } else {
                    originalAmountSatoshis += output.value || 0;
                  }
                }
              }
              
              const originalOutputValue = originalAmountSatoshis + originalChangeAmount;
              const originalFeeSatoshis = originalInputValue - originalOutputValue;
              
              const recommendedFee = await this.bitcoinApi.getRecommendedFeeInSatoshis(250, 'fastest');
              
              let cancelFee = Math.max(
                Math.ceil(originalFeeSatoshis * 1.1),
                recommendedFee,
                originalFeeSatoshis + 20
              );
              
              const feeDifference = recommendedFee - originalFeeSatoshis;
              const cancelFeeDifference = cancelFee - originalFeeSatoshis;
              
              const sentAmountSatoshis = Math.abs(tx.amountSatoshis);
              
              const availableBalanceSatoshis = Math.floor(this.availableBalance * 100000000);
              
              const totalAvailableForFee = originalChangeAmount + availableBalanceSatoshis;
              const canAccelerate = feeDifference > 0 && totalAvailableForFee >= feeDifference;
              
              const canCancel = sentAmountSatoshis > 0 && cancelFeeDifference <= sentAmountSatoshis;
              
              this.rbfStatus.set(tx.txid, {
                supportsRBF: true,
                canAccelerate,
                canCancel,
                feeDifference: cancelFeeDifference,
                reason: !canAccelerate && !canCancel 
                  ? totalAvailableForFee < feeDifference && feeDifference > 0
                    ? `Saldo insuficiente para acelerar. Necessário: ${feeDifference} sat, disponível (troco + saldo): ${totalAvailableForFee} sat (troco: ${originalChangeAmount} sat, saldo: ${availableBalanceSatoshis} sat)`
                    : cancelFeeDifference > sentAmountSatoshis
                      ? `Diferença de taxa (${cancelFeeDifference} sat) excede valor enviado (${sentAmountSatoshis} sat) para cancelar`
                      : sentAmountSatoshis === 0
                        ? `Não é possível cancelar: valor enviado é zero`
                        : `Não é possível cancelar esta transação`
                  : !canAccelerate && totalAvailableForFee < feeDifference && feeDifference > 0
                    ? `Saldo insuficiente para acelerar. Necessário: ${feeDifference} sat, disponível: ${totalAvailableForFee} sat`
                    : undefined
              });
            } else {
              this.rbfStatus.set(tx.txid, {
                supportsRBF: true,
                canAccelerate: false,
                canCancel: false,
                reason: 'Não foi possível obter detalhes da transação'
              });
            }
          } else {
            this.rbfStatus.set(tx.txid, {
              supportsRBF: false,
              canAccelerate: false,
              canCancel: false
            });
          }
        } catch (error) {
          console.error(`Erro ao verificar RBF para ${tx.txid}:`, error);
          this.rbfStatus.set(tx.txid, {
            supportsRBF: false,
            canAccelerate: false,
            canCancel: false,
            reason: 'Erro ao verificar status RBF'
          });
        }
      }
    }
  }

  getRBFStatus(txid: string): RBFStatus | undefined {
    return this.rbfStatus.get(txid);
  }

  async accelerateTransaction(tx: Transaction) {
    if (!this.wallet || this.processingRBF.has(tx.txid)) return;

    const rbfStatus = this.rbfStatus.get(tx.txid);
    if (!rbfStatus || !rbfStatus.canAccelerate) {
      this.alertService.toastError('Não é possível acelerar esta transação');
      return;
    }

    try {
      this.processingRBF.add(tx.txid);
      
      const recommendedFee = await this.bitcoinApi.getRecommendedFeeInSatoshis(250, 'fastest');
      
      const txDetails = await this.bitcoinApi.getTransaction(tx.txid);
      if (!txDetails) {
        throw new Error('Não foi possível obter detalhes da transação');
      }

      let originalInputValue = 0;
      let originalOutputValue = 0;
      
      if (txDetails.vin) {
        for (const input of txDetails.vin) {
          if (input.prevout && input.prevout.scriptpubkey_address === this.wallet!.address) {
            originalInputValue += input.prevout.value || 0;
          }
        }
      }
      
      if (txDetails.vout) {
        for (const output of txDetails.vout) {
          originalOutputValue += output.value || 0;
        }
      }
      
      const originalFeeSatoshis = originalInputValue - originalOutputValue;
      const feeDifference = recommendedFee - originalFeeSatoshis;
      
      const availableBalanceSatoshis = Math.floor(this.availableBalance * 100000000);

      const txHex = await this.transactionService.accelerateTransaction(
        tx.txid,
        recommendedFee,
        this.wallet.privateKey,
        this.wallet.address,
        availableBalanceSatoshis
      );

      const newTxId = await this.bitcoinApi.broadcastTransaction(txHex);
      
      this.alertService.toastSuccess(`Transação acelerada! Novo TXID: ${newTxId.substring(0, 16)}...`);
      
      await this.loadTransactionHistory();
    } catch (error: any) {
      console.error('Erro ao acelerar transação:', error);
      this.alertService.toastError(error.message || 'Erro ao acelerar transação');
    } finally {
      this.processingRBF.delete(tx.txid);
    }
  }

  async cancelTransaction(tx: Transaction) {
    if (!this.wallet || this.processingRBF.has(tx.txid)) return;

    const rbfStatus = this.rbfStatus.get(tx.txid);
    if (!rbfStatus || !rbfStatus.canCancel) {
      this.alertService.toastError('Não é possível cancelar esta transação');
      return;
    }

    try {
      this.processingRBF.add(tx.txid);
      
      const recommendedFee = await this.bitcoinApi.getRecommendedFeeInSatoshis(250, 'fastest');
      
      const txDetails = await this.bitcoinApi.getTransaction(tx.txid);
      if (!txDetails) {
        throw new Error('Não foi possível obter detalhes da transação');
      }

      let originalInputValue = 0;
      let originalOutputValue = 0;
      
      if (txDetails.vin) {
        for (const input of txDetails.vin) {
          if (input.prevout && input.prevout.scriptpubkey_address === this.wallet!.address) {
            originalInputValue += input.prevout.value || 0;
          }
        }
      }
      
      if (txDetails.vout) {
        for (const output of txDetails.vout) {
          originalOutputValue += output.value || 0;
        }
      }
      
      const originalFeeSatoshis = originalInputValue - originalOutputValue;
      
      let cancelFee = Math.max(
        Math.ceil(originalFeeSatoshis * 1.1),
        recommendedFee,
        originalFeeSatoshis + 20
      );
      
      const feeDifference = cancelFee - originalFeeSatoshis;
      
      let sentAmountSatoshis = 0;
      if (txDetails.vout) {
        for (const output of txDetails.vout) {
          if (output.scriptpubkey_address !== this.wallet!.address) {
            sentAmountSatoshis += output.value || 0;
          }
        }
      }
      
      if (sentAmountSatoshis === 0) {
        sentAmountSatoshis = Math.abs(tx.amountSatoshis);
      }
      
      if (feeDifference > sentAmountSatoshis) {
        throw new Error(
          `Valor enviado insuficiente para cancelar. ` +
          `Diferença de taxa necessária: ${feeDifference} satoshis, ` +
          `Valor enviado: ${sentAmountSatoshis} satoshis`
        );
      }

      const txHex = await this.transactionService.cancelTransaction(
        tx.txid,
        cancelFee,
        this.wallet.privateKey,
        this.wallet.address,
        sentAmountSatoshis
      );

      const newTxId = await this.bitcoinApi.broadcastTransaction(txHex);
      
      this.alertService.toastSuccess(`Transação cancelada! Novo TXID: ${newTxId.substring(0, 16)}...`);
      
      await this.loadTransactionHistory();
    } catch (error: any) {
      console.error('Erro ao cancelar transação:', error);
      this.alertService.toastError(error.message || 'Erro ao cancelar transação');
    } finally {
      this.processingRBF.delete(tx.txid);
    }
  }

  isProcessingRBF(txid: string): boolean {
    return this.processingRBF.has(txid);
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

