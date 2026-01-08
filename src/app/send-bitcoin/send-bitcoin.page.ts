import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Wallet } from '../services/wallet.service';
import { StorageService } from '../services/storage.service';
import { BitcoinApiService } from '../services/bitcoin-api.service';
import { TransactionService, UTXO } from '../services/transaction.service';
import { AlertService } from '../services/alert.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-send-bitcoin',
  templateUrl: './send-bitcoin.page.html',
  styleUrls: ['./send-bitcoin.page.scss'],
  standalone: false,
})
export class SendBitcoinPage implements OnInit {
  wallet: Wallet | null = null;
  recipientAddress: string = '';
  amount: string = '';
  networkFee: number = 438; // Taxa padrão em satoshis (será atualizada com taxa recomendada)
  balance: number = 0;
  loading: boolean = false;
  btcPriceBRL: number = 0;
  btcPriceUSD: number = 0;
  loadingFee: boolean = false;
  recommendedFeeRate: number | null = null; // Taxa recomendada em sat/vB
  baseNetworkFee: number = 438; // Taxa base (sem ajuste de dust limit)
  isFeeAdjusted: boolean = false; // Indica se a taxa foi ajustada devido ao dust limit
  feeAdjustmentReason: string = ''; // Razão do ajuste da taxa
  calculatingAdjustedFee: boolean = false; // Indica se está calculando a taxa ajustada
  isFeeManuallyChanged: boolean = false; // Indica se o usuário alterou a taxa manualmente

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService,
    private bitcoinApi: BitcoinApiService,
    private transactionService: TransactionService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const walletId = this.route.snapshot.paramMap.get('id');
    if (walletId) {
      this.wallet = this.storageService.getWallet(walletId);
      if (this.wallet) {
        this.loadBalance();
        this.loadRecommendedFee();
      } else {
        this.router.navigate(['/home']);
      }
    }
  }

  loadBalance() {
    if (!this.wallet) return;

    this.bitcoinApi.getBalance(this.wallet.address).subscribe(
      balance => {
        this.balance = balance;
      }
    );

    this.bitcoinApi.getBitcoinPriceBRL().subscribe(priceBRL => {
      this.btcPriceBRL = priceBRL;
    });

    this.bitcoinApi.getBitcoinPriceUSD().subscribe(priceUSD => {
      this.btcPriceUSD = priceUSD;
    });
  }

  private estimateTransactionSize(addressType: 'segwit' | 'taproot' | 'legacy', numInputs: number = 1, numOutputs: number = 2): number {
    const baseSize = 10;

    if (addressType === 'taproot') {
      return baseSize + (numInputs * 57) + (numOutputs * 43);
    } else if (addressType === 'segwit') {
      return baseSize + (numInputs * 68) + (numOutputs * 31);
    } else {
      return baseSize + (numInputs * 148) + (numOutputs * 34);
    }
  }

  private detectAddressType(address: string): 'segwit' | 'taproot' | 'legacy' {
    if (!address) return 'legacy';

    if (address.startsWith('bc1p') && address.length === 62) {
      return 'taproot';
    } else if (address.startsWith('bc1') && address.length === 42) {
      return 'segwit';
    } else {
      return 'legacy';
    }
  }

  loadRecommendedFee() {
    if (!this.wallet) return;

    this.isFeeManuallyChanged = false;
    this.loadingFee = true;

    const addressType = this.wallet.addressType || this.detectAddressType(this.wallet.address);

    let estimatedInputs = 1;
    let estimatedOutputs = 2;

    this.bitcoinApi.getUTXOs(this.wallet.address).subscribe(
      utxos => {
        const confirmedUTXOs = utxos.filter(utxo => utxo.status && utxo.status.confirmed === true);
        estimatedInputs = Math.max(1, Math.min(confirmedUTXOs.length, 3));

        if (this.amount && this.recipientAddress.trim()) {
          const amountNum = parseFloat(this.amount);
          if (!isNaN(amountNum) && amountNum > 0) {
            const amountSatoshis = Math.floor(amountNum * 100000000);

            const totalBalanceSatoshis = confirmedUTXOs.reduce((sum, utxo) => sum + utxo.value, 0);
            const DUST_LIMIT = 546;

            const sizeWith1Output = this.estimateTransactionSize(addressType, estimatedInputs, 1);
            const sizeWith2Outputs = this.estimateTransactionSize(addressType, estimatedInputs, 2);

            const estimatedFeeForCheck = Math.ceil(3 * sizeWith1Output);
            const estimatedTotalNeeded = amountSatoshis + estimatedFeeForCheck + DUST_LIMIT;

            const willHaveChange = (totalBalanceSatoshis - estimatedTotalNeeded) >= (DUST_LIMIT * 2);
            estimatedOutputs = willHaveChange ? 2 : 1;

            this.bitcoinApi.getRecommendedFees().subscribe(
              fees => {
                const optimizedFeeRate = Math.max(
                  fees.economyFee || 2,
                  Math.ceil((fees.economyFee + fees.hourFee) / 2)
                );

                const estimatedVBytes = this.estimateTransactionSize(addressType, estimatedInputs, estimatedOutputs);
                const recommendedFee = Math.ceil(optimizedFeeRate * estimatedVBytes);

                this.baseNetworkFee = recommendedFee;
                this.recommendedFeeRate = optimizedFeeRate;

                if (!this.isFeeManuallyChanged) {
                  this.networkFee = recommendedFee;
                }
                this.loadingFee = false;

                if (this.amount && this.recipientAddress && !this.isFeeManuallyChanged) {
                  this.calculateAdjustedFee();
                }
              },
              error => {
                this.loadRecommendedFeeFallback(addressType, estimatedInputs, 2);
              }
            );
          } else {
            this.loadRecommendedFeeFallback(addressType, estimatedInputs, 2);
          }
        } else {
          this.loadRecommendedFeeFallback(addressType, estimatedInputs, 2);
        }
      },
      error => {
        this.loadRecommendedFeeFallback(addressType, 1, 2);
      }
    );
  }

  private loadRecommendedFeeFallback(addressType: 'segwit' | 'taproot' | 'legacy', estimatedInputs: number, estimatedOutputs: number) {
    const estimatedVBytes = this.estimateTransactionSize(addressType, estimatedInputs, estimatedOutputs);

    this.bitcoinApi.getRecommendedFees().subscribe(
      fees => {
        const optimizedFeeRate = Math.max(
          fees.economyFee || 2,
          Math.ceil((fees.economyFee + fees.hourFee) / 2)
        );
        const recommendedFee = Math.ceil(optimizedFeeRate * estimatedVBytes);

        this.baseNetworkFee = recommendedFee;
        this.recommendedFeeRate = optimizedFeeRate;

        if (!this.isFeeManuallyChanged) {
          this.networkFee = recommendedFee;
        }
        this.loadingFee = false;

        if (this.amount && this.recipientAddress && !this.isFeeManuallyChanged) {
          this.calculateAdjustedFee();
        }
      },
      error => {
        console.error('Erro ao carregar taxa recomendada:', error);
        this.loadingFee = false;
      }
    );
  }

  async sendTransaction() {
    console.log('[sendTransaction] Início do método');

    if (!this.wallet) {
      console.log('[sendTransaction] ERRO: Wallet não encontrado');
      return;
    }

    console.log('[sendTransaction] Wallet encontrado:', this.wallet.id);

    if (!this.recipientAddress.trim()) {
      console.log('[sendTransaction] Validação falhou: Endereço vazio');
      await this.alertService.toastError('Por favor, informe o endereço de destino');
      return;
    }

    const amountNum = parseFloat(this.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      console.log('[sendTransaction] Validação falhou: Valor inválido');
      await this.alertService.toastError('Por favor, informe um valor válido');
      return;
    }

    if (this.networkFee < 1) {
      console.log('[sendTransaction] Validação falhou: Taxa inválida');
      await this.alertService.toastError('A taxa de rede deve ser pelo menos 1 satoshi');
      return;
    }

    const feeInBTC = this.getNetworkFeeInBTC();
    let totalNeeded = amountNum + feeInBTC;

    let x = totalNeeded.toFixed(8);
    totalNeeded = parseFloat(x);

    if (totalNeeded > this.balance) {
      console.log('[sendTransaction] Validação falhou: Saldo insuficiente');
      await this.alertService.toastError(
        `Necessário: ${totalNeeded.toFixed(8)} BTC\n(${amountNum.toFixed(8)} BTC + ${feeInBTC.toFixed(8)} BTC de taxa)`
      );
      return;
    }

    if (!this.isValidBitcoinAddress(this.recipientAddress)) {
      console.log('[sendTransaction] Validação falhou: Endereço Bitcoin inválido');
      await this.alertService.toastError('Por favor, verifique o endereço Bitcoin informado');
      return;
    }

    console.log('[sendTransaction] Todas as validações passaram');
    console.log('[sendTransaction] Definindo loading = true');

    if (!this.wallet) {
      console.error('[sendTransaction] Wallet perdido antes de iniciar transação');
      await this.alertService.toastError('Carteira não encontrada. Por favor, tente novamente.');
      return;
    }

    this.loading = true;

    try {
      this.cdr.detectChanges();
    } catch (cdrError) {
    }

    try {
      console.log('[sendTransaction] Iniciando busca de UTXOs...');
      const utxos = await firstValueFrom(this.bitcoinApi.getUTXOs(this.wallet.address));
      console.log('[sendTransaction] UTXOs obtidos:', utxos.length, 'UTXOs encontrados');

      if (utxos.length === 0) {
        console.log('[sendTransaction] ERRO: Nenhum UTXO disponível');
        throw new Error('Nenhum UTXO disponível para esta carteira');
      }

      console.log('[sendTransaction] Iniciando construção da transação...');
      const txHex = await this.transactionService.buildTransaction(
        utxos,
        this.recipientAddress.trim(),
        amountNum,
        this.networkFee,
        this.wallet.privateKey,
        this.wallet.address
      );
      console.log('[sendTransaction] Transação construída com sucesso. TX Hex length:', txHex.length);

      console.log('[sendTransaction] Iniciando transmissão para a rede...');
      const txId = await firstValueFrom(this.bitcoinApi.broadcastTransaction(txHex));
      console.log('[sendTransaction] Transação transmitida com sucesso! TXID:', txId);

      console.log('[sendTransaction] Resetando loading = false');
      this.loading = false;
      console.log('[sendTransaction] Loading resetado. Estado atual:', { loading: this.loading, wallet: !!this.wallet });

      if (this.wallet) {
        console.log('[sendTransaction] Iniciando navegação para wallet-details...');
        this.router.navigate(['/wallet-details', this.wallet.id])
          .then(() => {
            console.log('[sendTransaction] Navegação bem-sucedida');
            setTimeout(() => {
              try {
                console.log('[sendTransaction] Exibindo toast de sucesso...');
                this.alertService.toastSuccess(`Transação enviada! TXID: ${txId.substring(0, 16)}...`);
                console.log('[sendTransaction] Toast exibido com sucesso');
              } catch (toastError: any) {
                console.error('[sendTransaction] ERRO ao exibir toast:', toastError);
              }
            }, 300);
          })
          .catch((navError: any) => {
            console.error('[sendTransaction] ERRO na navegação:', navError);
            if (this.wallet) {
              setTimeout(() => {
                console.log('[sendTransaction] Tentando navegar novamente...');
                this.router.navigate(['/wallet-details', this.wallet!.id])
                  .then(() => {
                    console.log('[sendTransaction] Navegação de retry bem-sucedida');
                    try {
                      this.alertService.toastSuccess(`Transação enviada! TXID: ${txId.substring(0, 16)}...`);
                    } catch (toastError: any) {
                      console.error('[sendTransaction] ERRO ao exibir toast no retry:', toastError);
                    }
                  })
                  .catch(err => {
                    console.error('[sendTransaction] ERRO ao tentar navegar novamente:', err);
                  });
              }, 500);
            }
          });
      } else {
        console.log('[sendTransaction] AVISO: Wallet não disponível após transação, exibindo apenas toast');
        try {
          this.alertService.toastSuccess(`Transação enviada! TXID: ${txId.substring(0, 16)}...`);
        } catch (toastError: any) {
          console.error('[sendTransaction] ERRO ao exibir toast sem wallet:', toastError);
        }
      }

      console.log('[sendTransaction] Método concluído com sucesso');

    } catch (error: any) {
      console.error('[sendTransaction] ERRO capturado no catch:', error);
      console.error('[sendTransaction] Stack trace:', error.stack);

      this.loading = false;

      try {
        this.cdr.detectChanges();
      } catch (cdrError) {
        console.warn('[sendTransaction] Erro ao forçar detecção de mudanças:', cdrError);
      }

      console.log('[sendTransaction] Loading resetado para false e UI atualizada');

      requestAnimationFrame(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
          let errorMessage = 'Erro ao enviar transação.';
          if (error?.message) {
            errorMessage = error.message;
          } else if (error?.error) {
            errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
          }

          if (errorMessage.includes('dust limit') || errorMessage.includes('troco calculado')) {
            const dustMatch = errorMessage.match(/troco calculado \((\d+) satoshis\)/);
            const feeMatch = errorMessage.match(/taxa especificada de (\d+) satoshis/);
            const actualFeeMatch = errorMessage.match(/taxa seria (\d+) satoshis/);

            if (dustMatch && feeMatch) {
              const changeAmount = parseInt(dustMatch[1]);
              const specifiedFee = parseInt(feeMatch[1]);
              const actualFee = actualFeeMatch ? parseInt(actualFeeMatch[1]) : null;

              const adjustmentNeeded = 546 - changeAmount;
              const suggestedAmount = amountNum - (adjustmentNeeded / 100000000);

              errorMessage =
                `⚠️ Troco muito pequeno para criar transação\n\n` +
                `O troco calculado (${changeAmount} satoshis) é menor que o mínimo permitido (546 satoshis).\n\n`;
            }
          }

          if (errorMessage.length > 500) {
            errorMessage = errorMessage.substring(0, 500) + '...';
          }

          console.log('[sendTransaction] Exibindo alerta de erro...');

          this.alertService.toastError(errorMessage);

          console.log('[sendTransaction] Alerta de erro exibido com sucesso');
        } catch (alertError: any) {
          console.error('[sendTransaction] ERRO ao exibir alerta:', alertError);
          try {
            await this.alertService.toastError('Erro ao enviar transação. Tente novamente.');
          } catch (toastError: any) {
            console.error('[sendTransaction] ERRO ao exibir toast de fallback:', toastError);
          }
        } finally {
          try {
            this.cdr.detectChanges();
          } catch (cdrError) {
          }
        }
      });

      console.log('[sendTransaction] Tratamento de erro concluído');
    }
  }

  onFeeChange() {
    this.isFeeManuallyChanged = true;
    this.isFeeAdjusted = false;
    this.feeAdjustmentReason = '';
  }

  async calculateAdjustedFee() {
    if (this.isFeeManuallyChanged) {
      return;
    }

    if (!this.wallet || !this.amount || !this.recipientAddress.trim()) {
      this.isFeeAdjusted = false;
      this.feeAdjustmentReason = '';
      return;
    }

    const amountNum = parseFloat(this.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      this.isFeeAdjusted = false;
      this.feeAdjustmentReason = '';
      return;
    }

    this.calculatingAdjustedFee = true;

    try {
      const utxos = await firstValueFrom(this.bitcoinApi.getUTXOs(this.wallet.address));
      const confirmedUTXOs = utxos.filter(utxo => utxo.status && utxo.status.confirmed === true);

      if (confirmedUTXOs.length === 0) {
        this.isFeeAdjusted = false;
        this.feeAdjustmentReason = '';
        this.calculatingAdjustedFee = false;
        return;
      }

      const amountSatoshis = Math.floor(amountNum * 100000000);
      const feeSatoshis = this.baseNetworkFee;
      const DUST_LIMIT = 546;

      const sortedUTXOs = [...confirmedUTXOs].sort((a, b) => b.value - a.value);
      let totalInput = 0;
      const selectedUTXOs: UTXO[] = [];

      const minimumRequired = amountSatoshis + feeSatoshis + DUST_LIMIT;

      for (const utxo of sortedUTXOs) {
        selectedUTXOs.push(utxo);
        totalInput += utxo.value;
        if (totalInput >= minimumRequired) {
          break;
        }
      }

      if (totalInput < amountSatoshis + feeSatoshis) {
        this.isFeeAdjusted = false;
        this.feeAdjustmentReason = '';
        this.calculatingAdjustedFee = false;
        return;
      }

      const changeAmount = totalInput - amountSatoshis - feeSatoshis;

      if (changeAmount > 0 && changeAmount < DUST_LIMIT) {
        const adjustedFee = totalInput - amountSatoshis;
        this.networkFee = adjustedFee;
        this.isFeeAdjusted = true;
        this.feeAdjustmentReason =
          `Taxa ajustada de ${feeSatoshis} para ${adjustedFee} satoshis porque o troco (${changeAmount} satoshis) ` +
          `é menor que o mínimo permitido (${DUST_LIMIT} satoshis). O troco será incluído na taxa.`;
      } else {
        this.networkFee = this.baseNetworkFee;
        this.isFeeAdjusted = false;
        this.feeAdjustmentReason = '';
      }
    } catch (error) {
      console.error('Erro ao calcular taxa ajustada:', error);
      this.networkFee = this.baseNetworkFee;
      this.isFeeAdjusted = false;
      this.feeAdjustmentReason = '';
    } finally {
      this.calculatingAdjustedFee = false;
      this.cdr.detectChanges();
    }
  }

  onAmountChange() {
    if (this.amount && this.recipientAddress.trim()) {
      this.calculateAdjustedFee();
    } else {
      this.networkFee = this.baseNetworkFee;
      this.isFeeAdjusted = false;
      this.feeAdjustmentReason = '';
    }
  }

  onRecipientAddressChange() {
    if (this.amount && this.recipientAddress.trim()) {
      this.calculateAdjustedFee();
    } else {
      this.networkFee = this.baseNetworkFee;
      this.isFeeAdjusted = false;
      this.feeAdjustmentReason = '';
    }
  }

  private isValidBitcoinAddress(address: string): boolean {
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
           /^bc1[a-z0-9]{39,59}$/.test(address);
  }

  async setMaxAmount() {
    if (!this.wallet) return;

    try {
      const utxos = await firstValueFrom(this.bitcoinApi.getUTXOs(this.wallet.address));
      const confirmedUTXOs = utxos.filter(utxo => utxo.status && utxo.status.confirmed === true);

      if (confirmedUTXOs.length === 0) {
        const feeInBTC = this.getNetworkFeeInBTC();
        const maxAmount = Math.max(0, this.balance - feeInBTC);
        this.amount = maxAmount.toFixed(8);
        if (this.recipientAddress.trim()) {
          this.calculateAdjustedFee();
        }
        return;
      }

      const totalSatoshis = confirmedUTXOs.reduce((sum, utxo) => sum + utxo.value, 0);
      const feeSatoshis = this.baseNetworkFee;

      const maxSatoshis = Math.max(0, totalSatoshis - feeSatoshis);
      const maxAmount = maxSatoshis / 100000000;

      this.amount = maxAmount.toFixed(8);

      if (this.recipientAddress.trim()) {
        this.calculateAdjustedFee();
      }
    } catch (error) {
      console.error('Erro ao calcular valor máximo:', error);
      const feeInBTC = this.getNetworkFeeInBTC();
      const maxAmount = Math.max(0, this.balance - feeInBTC);
      this.amount = maxAmount.toFixed(8);
      if (this.recipientAddress.trim()) {
        this.calculateAdjustedFee();
      }
    }
  }

  getNetworkFeeInBTC(): number {
    try {
      const fee = this.networkFee || 0;
      return fee / 100000000;
    } catch (error) {
      console.error('Erro ao calcular taxa em BTC:', error);
      return 0;
    }
  }

  getTotalAmount(): number {
    try {
      const amountNum = parseFloat(this.amount || '0') || 0;
      return amountNum + this.getNetworkFeeInBTC();
    } catch (error) {
      console.error('Erro ao calcular total:', error);
      return 0;
    }
  }

  getNetworkFeeInBRL(): string {
    try {
      const feeInBTC = this.getNetworkFeeInBTC();
      const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL() || 0;
      return (feeInBTC * price).toFixed(2);
    } catch (error) {
      console.error('Erro ao calcular taxa em BRL:', error);
      return '0.00';
    }
  }

  getNetworkFeeInUSD(): string {
    try {
      const feeInBTC = this.getNetworkFeeInBTC();
      const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD() || 0;
      return (feeInBTC * price).toFixed(2);
    } catch (error) {
      console.error('Erro ao calcular taxa em USD:', error);
      return '0.00';
    }
  }

  getTotalInBRL(): string {
    try {
      const total = this.getTotalAmount();
      const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL() || 0;
      return (total * price).toFixed(2);
    } catch (error) {
      console.error('Erro ao calcular total em BRL:', error);
      return '0.00';
    }
  }

  getTotalInUSD(): string {
    try {
      const total = this.getTotalAmount();
      const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD() || 0;
      return (total * price).toFixed(2);
    } catch (error) {
      console.error('Erro ao calcular total em USD:', error);
      return '0.00';
    }
  }

  getAvailableBalance(): number {
    try {
      const feeInBTC = this.getNetworkFeeInBTC();
      const balance = this.balance || 0;
      return Math.max(0, balance - feeInBTC);
    } catch (error) {
      console.error('Erro ao calcular saldo disponível:', error);
      return 0;
    }
  }

  getAmountInUSD(): string {
    try {
      const amountNum = parseFloat(this.amount || '0') || 0;
      const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD() || 0;
      return (amountNum * price).toFixed(2);
    } catch (error) {
      console.error('Erro ao calcular valor em USD:', error);
      return '0.00';
    }
  }

  getAmountInBRL(): string {
    try {
      const amountNum = parseFloat(this.amount || '0') || 0;
      const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL() || 0;
      return (amountNum * price).toFixed(2);
    } catch (error) {
      console.error('Erro ao calcular valor em BRL:', error);
      return '0.00';
    }
  }

  getAddressTypeLabel(): string {
    if (!this.wallet) return '';

    const addressType = this.wallet.addressType || this.detectAddressType(this.wallet.address);

    switch (addressType) {
      case 'taproot':
        return 'Taproot (BIP86)';
      case 'segwit':
        return 'SegWit (BIP84)';
      default:
        return 'Legacy';
    }
  }

  getAddressTypeDescription(): string {
    if (!this.wallet) return '';

    const addressType = this.wallet.addressType || this.detectAddressType(this.wallet.address);

    switch (addressType) {
      case 'taproot':
        return 'Taxas otimizadas (~15-20% menores que SegWit).';
      case 'segwit':
        return 'Taxas reduzidas (~40% menores que Legacy).';
      default:
        return 'Taxas maiores. Considere migrar para SegWit ou Taproot.';
    }
  }
}

