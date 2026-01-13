import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { BitcoinApiService } from '../../services/bitcoin-api.service';
import { TransactionService, UTXO } from '../../services/transaction.service';
import { AlertService } from '../../services/alert.service';
import { Wallet } from 'src/app/domain/wallet';
import Decimal from 'decimal.js';

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
  networkFee: number = 438;
  balance: number = 0;
  loading: boolean = false;
  btcPriceBRL: number = 0;
  btcPriceUSD: number = 0;
  loadingFee: boolean = false;
  recommendedFeeRate: number | null = null;
  baseNetworkFee: number = 438;
  isFeeAdjusted: boolean = false;
  feeAdjustmentReason: string = '';
  calculatingAdjustedFee: boolean = false;
  isFeeManuallyChanged: boolean = false;
  isMaxChecked: boolean = false;

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

  async loadBalance() {
    if (!this.wallet) return;

    this.balance = await this.bitcoinApi.getBalance(this.wallet.address);

    this.btcPriceBRL = await this.bitcoinApi.getBitcoinPriceBRL();

    this.btcPriceUSD = await this.bitcoinApi.getBitcoinPriceUSD();
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

  async loadRecommendedFee() {
    if (!this.wallet) return;

    this.isFeeManuallyChanged = false;
    this.loadingFee = true;

    const addressType = this.wallet.addressType || this.detectAddressType(this.wallet.address);

    let estimatedInputs = 1;
    let estimatedOutputs = 2;

    let utxos = await this.bitcoinApi.getUTXOs(this.wallet.address);
    
    const confirmedUTXOs = utxos.filter(utxo => utxo.status && utxo.status.confirmed === true);
    estimatedInputs = Math.max(1, Math.min(confirmedUTXOs.length, 3));

    if (this.amount && this.recipientAddress.trim()) {
      let amountDecimal: Decimal;
      try {
        amountDecimal = new Decimal(this.amount);
      } catch {
        this.loadRecommendedFeeFallback(addressType, estimatedInputs, 2);
        return;
      }
      
      if (amountDecimal.gt(0)) {
        const amountSatoshis = amountDecimal.mul(100000000).floor().toNumber();

        const totalBalanceSatoshis = confirmedUTXOs.reduce((sum, utxo) => sum + utxo.value, 0);
        const DUST_LIMIT = 546;

        const sizeWith1Output = this.estimateTransactionSize(addressType, estimatedInputs, 1);

        const estimatedFeeForCheck = Math.ceil(3 * sizeWith1Output);
        const estimatedTotalNeeded = amountSatoshis + estimatedFeeForCheck + DUST_LIMIT;

        const willHaveChange = (totalBalanceSatoshis - estimatedTotalNeeded) >= (DUST_LIMIT * 2);
        estimatedOutputs = willHaveChange ? 2 : 1;

        let fees = await this.bitcoinApi.getRecommendedFees();

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
      } else {
        this.loadRecommendedFeeFallback(addressType, estimatedInputs, 2);
      }
    } else {
      this.loadRecommendedFeeFallback(addressType, estimatedInputs, 2);
    }
  }

  private async loadRecommendedFeeFallback(addressType: 'segwit' | 'taproot' | 'legacy', estimatedInputs: number, estimatedOutputs: number) {
    const estimatedVBytes = this.estimateTransactionSize(addressType, estimatedInputs, estimatedOutputs);

    let fees = await this.bitcoinApi.getRecommendedFees();
    
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
  }

  async sendTransaction() {
    if (!this.wallet) return;

    if (!this.recipientAddress.trim()) {
      await this.alertService.error('Por favor, informe o endereço de destino');
      return;
    }

    let amountDecimal: Decimal;
    try {
      amountDecimal = new Decimal(this.amount || '0');
    } catch {
      await this.alertService.error('Por favor, informe um valor válido');
      return;
    }
    
    if (amountDecimal.lte(0)) {
      await this.alertService.error('Por favor, informe um valor válido');
      return;
    }

    if (this.networkFee < 1) {
      await this.alertService.error('A taxa de rede deve ser pelo menos 1 satoshi');
      return;
    }

    const feeInBTC = this.getNetworkFeeInBTC();
    const feeDecimal = new Decimal(feeInBTC);
    const totalNeeded = amountDecimal.plus(feeDecimal);

    const balanceDecimal = new Decimal(this.balance);

    if (totalNeeded.gt(balanceDecimal)) {
      await this.alertService.error(
        `Necessário: ${totalNeeded.toFixed(8)} BTC\n(${amountDecimal.toFixed(8)} BTC + ${feeDecimal.toFixed(8)} BTC de taxa)`
      );
      return;
    }

    if (!this.isValidBitcoinAddress(this.recipientAddress)) {
      await this.alertService.error('Por favor, verifique o endereço Bitcoin informado');
      return;
    }

    if (!this.wallet) {
      await this.alertService.error('Carteira não encontrada. Por favor, tente novamente.');
      return;
    }

    this.loading = true;

    try {
      this.cdr.detectChanges();
    } catch (cdrError) {}

    try {
      const utxos = await this.bitcoinApi.getUTXOs(this.wallet.address);

      if (utxos.length === 0) {
        throw new Error('Nenhum UTXO disponível para esta carteira');
      }

      const txHex = await this.transactionService.buildTransaction(
        utxos,
        this.recipientAddress.trim(),
        amountDecimal.toNumber(),
        this.networkFee,
        this.wallet.privateKey,
        this.wallet.address
      );

      const txId = await this.bitcoinApi.broadcastTransaction(txHex);

      this.loading = false;
      this.alertService.toastSuccess(`Transação enviada! TXID: ${txId.substring(0, 16)}...`);

      if (this.wallet) {
        this.router.navigate(['/wallet-details', this.wallet.id]);
      }

    } 
    catch (error: any) {
      this.loading = false;

      try {
        this.cdr.detectChanges();
      } catch (cdrError) {}

      requestAnimationFrame(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));

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
            const adjustmentDecimal = new Decimal(adjustmentNeeded).div(100000000);
            const suggestedAmount = amountDecimal.minus(adjustmentDecimal);

            errorMessage =
              `⚠️ Troco muito pequeno para criar transação\n\n` +
              `O troco calculado (${changeAmount} satoshis) é menor que o mínimo permitido (546 satoshis).\n\n` +
              (actualFee !== null
                ? `A taxa especificada foi ${specifiedFee} satoshis, mas a taxa correta seria ${actualFee} satoshis para evitar o troco muito pequeno.\n\n`
                : "") +
              `Sugestão: Reduza a quantia enviada para no máximo ${suggestedAmount.toFixed(8)} BTC para evitar o erro de troco insuficiente.`
          }
        }

        if (errorMessage.length > 500) {
          errorMessage = errorMessage.substring(0, 500) + '...';
        }

        this.alertService.error(errorMessage);
      });
    }
  }

  onFeeChange() {
    this.isFeeManuallyChanged = true;
    this.isFeeAdjusted = false;
    this.feeAdjustmentReason = '';
    
    if (this.isMaxChecked) {
      this.calculateMaxAmount();
    }
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

    let amountDecimal: Decimal;
    try {
      amountDecimal = new Decimal(this.amount);
    } catch {
      this.isFeeAdjusted = false;
      this.feeAdjustmentReason = '';
      return;
    }
    
    if (amountDecimal.lte(0)) {
      this.isFeeAdjusted = false;
      this.feeAdjustmentReason = '';
      return;
    }

    this.calculatingAdjustedFee = true;

    try {
      const utxos = await this.bitcoinApi.getUTXOs(this.wallet.address);
      const confirmedUTXOs = utxos.filter(utxo => utxo.status && utxo.status.confirmed === true);

      if (confirmedUTXOs.length === 0) {
        this.isFeeAdjusted = false;
        this.feeAdjustmentReason = '';
        this.calculatingAdjustedFee = false;
        return;
      }

      const amountSatoshis = amountDecimal.mul(100000000).round().toNumber();
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
      this.networkFee = this.baseNetworkFee;
      this.isFeeAdjusted = false;
      this.feeAdjustmentReason = '';
    } finally {
      this.calculatingAdjustedFee = false;
      this.cdr.detectChanges();
    }
  }

  onAmountChange() {
    if (this.amount) {
      const validated = this.validateAndLimitDecimals(this.amount);
      if (validated !== this.amount) {
        this.amount = validated;
      }
    }

    if (this.isMaxChecked) {
      this.isMaxChecked = false;
      if (this.recipientAddress.trim() && this.amount) {
        if (!this.isFeeManuallyChanged) {
          this.loadRecommendedFee();
        } else {
          this.calculateAdjustedFee();
        }
      }
    } else {
      if (this.amount && this.recipientAddress.trim()) {
        this.calculateAdjustedFee();
      } else {
        this.networkFee = this.baseNetworkFee;
        this.isFeeAdjusted = false;
        this.feeAdjustmentReason = '';
      }
    }
  }

  private validateAndLimitDecimals(value: string): string {
    if (!value) return '';
    
    let cleaned = value.replace(/[^\d.]/g, '');
    
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    if (parts.length === 2 && parts[1].length > 8) {
      cleaned = parts[0] + '.' + parts[1].substring(0, 8);
    }
    
    return cleaned;
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

    this.isMaxChecked = !this.isMaxChecked;

    if (this.isMaxChecked) {
      await this.calculateMaxAmount();
    }
  }

  private async calculateMaxAmount() {
    if (!this.wallet) return;

    try {
      const utxos = await this.bitcoinApi.getUTXOs(this.wallet.address);
      const confirmedUTXOs = utxos.filter(utxo => utxo.status && utxo.status.confirmed === true);

      if (confirmedUTXOs.length === 0) {
        const feeInBTC = this.getNetworkFeeInBTC();
        const balanceDecimal = new Decimal(this.balance);
        const feeDecimal = new Decimal(feeInBTC);
        const maxAmount = Decimal.max(0, balanceDecimal.minus(feeDecimal));
        this.amount = maxAmount.toFixed(8);
        if (this.recipientAddress.trim() && !this.isFeeManuallyChanged) {
          this.calculateAdjustedFee();
        }
        return;
      }

      const totalSatoshis = confirmedUTXOs.reduce((sum, utxo) => sum + utxo.value, 0);
      const feeSatoshis = this.networkFee || this.baseNetworkFee;

      const totalSatoshisDecimal = new Decimal(totalSatoshis);
      const feeSatoshisDecimal = new Decimal(feeSatoshis);
      const maxSatoshis = Decimal.max(0, totalSatoshisDecimal.minus(feeSatoshisDecimal));
      const maxAmount = maxSatoshis.div(100000000);

      this.amount = maxAmount.toFixed(8);

      if (this.recipientAddress.trim() && !this.isFeeManuallyChanged) {
        this.calculateAdjustedFee();
      }
    } catch (error) {
      const feeInBTC = this.getNetworkFeeInBTC();
      const balanceDecimal = new Decimal(this.balance);
      const feeDecimal = new Decimal(feeInBTC);
      const maxAmount = Decimal.max(0, balanceDecimal.minus(feeDecimal));
      this.amount = maxAmount.toFixed(8);
      if (this.recipientAddress.trim() && !this.isFeeManuallyChanged) {
        this.calculateAdjustedFee();
      }
    }
  }

  getNetworkFeeInBTC(): number {
    try {
      const fee = this.networkFee || 0;
      return new Decimal(fee).div(100000000).toNumber();
    } catch (error) {
      return 0;
    }
  }

  getTotalAmount(): number {
    try {
      const amountDecimal = new Decimal(this.amount || '0');
      const feeDecimal = new Decimal(this.getNetworkFeeInBTC());
      return amountDecimal.plus(feeDecimal).toNumber();
    } catch (error) {
      return 0;
    }
  }

  getNetworkFeeInBRL(): string {
    try {
      const feeInBTC = this.getNetworkFeeInBTC();
      const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL() || 0;
      return (feeInBTC * price).toFixed(2);
    } catch (error) {
      return '0.00';
    }
  }

  getNetworkFeeInUSD(): string {
    try {
      const feeInBTC = this.getNetworkFeeInBTC();
      const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD() || 0;
      return (feeInBTC * price).toFixed(2);
    } catch (error) {
      return '0.00';
    }
  }

  getTotalInBRL(): string {
    try {
      const total = this.getTotalAmount();
      const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL() || 0;
      return (total * price).toFixed(2);
    } catch (error) {
      return '0.00';
    }
  }

  getTotalInUSD(): string {
    try {
      const total = this.getTotalAmount();
      const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD() || 0;
      return (total * price).toFixed(2);
    } catch (error) {
      return '0.00';
    }
  }

  getAvailableBalance(): number {
    try {
      const feeInBTC = this.getNetworkFeeInBTC();
      const balanceDecimal = new Decimal(this.balance || 0);
      const feeDecimal = new Decimal(feeInBTC);
      return Decimal.max(0, balanceDecimal.minus(feeDecimal)).toNumber();
    } catch (error) {
      return 0;
    }
  }

  getAmountInUSD(): string {
    try {
      const amountDecimal = new Decimal(this.amount || '0');
      const price = this.btcPriceUSD || this.bitcoinApi.getCurrentPriceUSD() || 0;
      return amountDecimal.mul(price).toFixed(2);
    } catch (error) {
      return '0.00';
    }
  }

  getAmountInBRL(): string {
    try {
      const amountDecimal = new Decimal(this.amount || '0');
      const price = this.btcPriceBRL || this.bitcoinApi.getCurrentPriceBRL() || 0;
      return amountDecimal.mul(price).toFixed(2);
    } catch (error) {
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

