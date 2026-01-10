import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BitcoinApiService {
  private readonly API_BASES = [
    'https://mempool.space/api',
    'https://blockstream.info/api'
  ];
  private readonly API_BASE = this.API_BASES[0];
  private btcPriceBRL: number = 0;
  private btcPriceUSD: number = 0;
  private lastPriceUpdate: number = 0;
  private readonly PRICE_CACHE_DURATION = 5 * 60 * 1000;

  constructor(private http: HttpClient) {
    this.btcPriceBRL = 250000;
    this.btcPriceUSD = 50000;
    this.updateBitcoinPrice();
  }
  
  async getBalance(address: string): Promise<number> {
    try{
      let utxos = (<any[]>(await firstValueFrom(this.http.get(`${this.API_BASE}/address/${address}/utxo`))));

      const confirmedUTXOs = utxos.filter(utxo => {
        return utxo.status && utxo.status.confirmed === true;
      });

      const balance = confirmedUTXOs.reduce((sum, utxo) => sum + (utxo.value || 0), 0);
      return balance / 100000000;
    }
    catch(error: any){
      console.error('Erro ao consultar saldo:', error);
      return 0;
    }
  }

  async getAddressInfo(address: string): Promise<any> {
    try{
      return (<any>(await firstValueFrom(this.http.get(`${this.API_BASE}/address/${address}`))));
    }
    catch(error: any){
      console.error('Erro ao consultar informações do endereço:', error);
      return null;
    }
  }

  async getUTXOs(address: string, confirmedOnly: boolean = true): Promise<any[]> {
    try {
      let utxos = (<any[]>(await firstValueFrom(this.http.get<any[]>(`${this.API_BASE}/address/${address}/utxo`))));

      if (confirmedOnly) {
        utxos = utxos.filter(utxo => {
          return utxo.status && utxo.status.confirmed === true;
        });
      }
      
      const validUtxos = utxos.filter(utxo => {
        return utxo && 
               utxo.txid && 
               typeof utxo.vout === 'number' && 
               typeof utxo.value === 'number' &&
               utxo.value > 0;
      });

      if (validUtxos.length !== utxos.length) {
        console.warn(`Alguns UTXOs foram filtrados por validação: ${utxos.length - validUtxos.length} inválidos`);
      }

      return validUtxos;
    }
    catch(error: any){
      console.error('Erro ao buscar UTXOs da API principal:', error);
      
      for (const apiBase of this.API_BASES.slice(1)) {
        try {
          let utxos = (<any[]>(await firstValueFrom(this.http.get<any[]>(`${apiBase}/address/${address}/utxo`))));
          
          if (confirmedOnly) {
            utxos = utxos.filter(utxo => {
              return utxo.status && utxo.status.confirmed === true;
            });
          }
          
          const validUtxos = utxos.filter(utxo => {
            return utxo && 
                   utxo.txid && 
                   typeof utxo.vout === 'number' && 
                   typeof utxo.value === 'number' &&
                   utxo.value > 0;
          });
          
          console.log(`UTXOs recuperados via fallback (${apiBase})`);
          return validUtxos;
        } catch (fallbackError) {
          console.warn(`Fallback ${apiBase} também falhou:`, fallbackError);
          continue;
        }
      }
      
      return [];
    }
  }

  async getTransaction(txid: string): Promise<any> {
    try{
      return (<any>(await firstValueFrom(this.http.get(`${this.API_BASE}/tx/${txid}`))));
    }
    catch(error: any){
      console.error('Erro ao buscar transação:', error);
      return null;
    }
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    let lastError: any = null;
    
    for (const apiBase of this.API_BASES) {
      try {
        let response = (<any>(await firstValueFrom(this.http.post(`${apiBase}/tx`, txHex, {
          headers: { 'Content-Type': 'text/plain' },
          responseType: 'text'
        }))));

        let txId: string;
        if (typeof response === 'string') {
          txId = response;
        } else if (response && response.txid) {
          txId = response.txid;
        } else {
          txId = response;
        }

        await this.verifyTransactionInMempool(txId, apiBase);
        
        return txId;
      }
      catch(error: any){
        console.warn(`Erro ao transmitir via ${apiBase}:`, error);
        lastError = error;
        continue;
      }
    }

    console.error('Erro ao enviar transação em todas as APIs:', lastError);
    let errorMessage = 'Erro ao transmitir transação em todas as APIs disponíveis';
    if (lastError?.error) {
      if (typeof lastError.error === 'string') {
        errorMessage = lastError.error;
      } else if (lastError.error.error) {
        errorMessage = lastError.error.error;
      }
    }
    throw new Error(errorMessage);
  }

  private async verifyTransactionInMempool(txId: string, apiBase: string, maxAttempts: number = 3): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Aguarda 1s, 2s, 3s
        
        const tx = await firstValueFrom(this.http.get(`${apiBase}/tx/${txId}`));
        if (tx) {
          return;
        }
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          console.warn(`Transação ${txId} não apareceu no mempool após ${maxAttempts} tentativas. Pode ter sido censurada ou há problema de rede.`);
        }
      }
    }
  }

  async getBitcoinPriceBRL(): Promise<number> {
    const now = Date.now();

    if (this.btcPriceBRL > 0 && (now - this.lastPriceUpdate) < this.PRICE_CACHE_DURATION) {
      return this.btcPriceBRL;
    }

    await this.updateBitcoinPrice();

    return this.btcPriceBRL;
  }

  async getBitcoinPriceUSD(): Promise<number> {
    const now = Date.now();

    if (this.btcPriceUSD > 0 && (now - this.lastPriceUpdate) < this.PRICE_CACHE_DURATION) {
      return this.btcPriceUSD;
    }

    await this.updateBitcoinPrice();

    return this.btcPriceUSD;
  }

  private async updateBitcoinPrice(): Promise<number> {
    try{
      let data = (<any>(await firstValueFrom(this.http.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,brl'))));

      if (data.bitcoin) {
        this.btcPriceUSD = data.bitcoin.usd || 50000;
        this.btcPriceBRL = data.bitcoin.brl || 250000;
        this.lastPriceUpdate = Date.now();
      }

      return this.btcPriceBRL;
    }
    catch(error: any){
      console.error('Erro ao buscar cotação do Bitcoin:', error);
      if (this.btcPriceBRL === 0) {
        this.btcPriceBRL = 250000;
        this.btcPriceUSD = 50000;
      }
      return this.btcPriceBRL;
    }
  }

  getCurrentPriceBRL(): number {
    return this.btcPriceBRL || 250000;
  }

  getCurrentPriceUSD(): number {
    return this.btcPriceUSD || 50000;
  }

  async getPendingBalance(address: string): Promise<number> {
    try{
      let utxos = (<any[]>(await firstValueFrom(this.http.get(`${this.API_BASE}/address/${address}/utxo`))));

      const pendingUTXOs = utxos.filter(utxo => {
        return !utxo.status || utxo.status.confirmed === false;
      });

      const pendingBalance = pendingUTXOs.reduce((sum, utxo) => sum + (utxo.value || 0), 0);
      return pendingBalance / 100000000;
    }
    catch(error: any){
      console.error('Erro ao consultar saldo pendente:', error);
      return 0;
    }
  }

  async getPendingSent(address: string): Promise<number> {
    try{
      let transactions = (<any[]>(await firstValueFrom(this.http.get(`${this.API_BASE}/address/${address}/txs`))));

      if (!transactions || transactions.length === 0) {
        return 0;
      }

      let pendingSent = 0;

      const unconfirmedTxs = transactions.filter((tx: any) => {
        return !tx.status || !tx.status.confirmed;
      });

      for (const tx of unconfirmedTxs) {
        let isSender = false;
        let inputValue = 0;
        let outputValue = 0;

        if (tx.vin) {
          for (const input of tx.vin) {
            if (input.prevout && input.prevout.scriptpubkey_address === address) {
              isSender = true;
              inputValue += input.prevout.value || 0;
            }
          }
        }

        if (tx.vout) {
          for (const output of tx.vout) {
            if (output.scriptpubkey_address === address) {
              outputValue += output.value || 0;
            }
          }
        }

        if (isSender) {
          const sentAmount = inputValue - outputValue;
          if (sentAmount > 0) {
            pendingSent += sentAmount;
          }
        }
      }

      return pendingSent / 100000000;
    }
    catch(error: any){
      console.error('Erro ao consultar saldo pendente a enviar:', error);
      return 0;
    }
  }

  async getTransactionHistory(address: string, limit: number = 25): Promise<any[]> {
    try{
      let transactions = (<any[]>(await firstValueFrom(this.http.get(`${this.API_BASE}/address/${address}/txs`))));

      if (!transactions || transactions.length === 0) {
        return [];
      }

      const processedTxs = transactions.slice(0, limit).map((tx: any) => {
        let inputValue = 0;
        let outputValue = 0;
        let isSender = false;
        let isReceiver = false;

        if (tx.vin) {
          for (const input of tx.vin) {
            if (input.prevout && input.prevout.scriptpubkey_address === address) {
              isSender = true;
              inputValue += input.prevout.value || 0;
            }
          }
        }

        if (tx.vout) {
          for (const output of tx.vout) {
            if (output.scriptpubkey_address === address) {
              isReceiver = true;
              outputValue += output.value || 0;
            }
          }
        }

        let netAmount = 0;
        let type: 'sent' | 'received' | 'self' = 'self';

        if (isSender && isReceiver) {
          netAmount = outputValue - inputValue;
          type = netAmount > 0 ? 'received' : 'sent';
        } else if (isSender) {
          netAmount = -(inputValue - outputValue);
          type = 'sent';
        } else if (isReceiver) {
          netAmount = outputValue;
          type = 'received';
        }

        return {
          txid: tx.txid,
          type: type,
          amount: netAmount / 100000000,
          amountSatoshis: netAmount,
          confirmed: tx.status?.confirmed || false,
          blockHeight: tx.status?.block_height,
          blockTime: tx.status?.block_time || tx.status?.block_time || Date.now() / 1000,
          fee: tx.fee ? tx.fee / 100000000 : 0,
          inputs: tx.vin?.length || 0,
          outputs: tx.vout?.length || 0
        };
      });

      return processedTxs.sort((a, b) => {
        if (!a.confirmed && b.confirmed) return -1;
        if (a.confirmed && !b.confirmed) return 1;
        return b.blockTime - a.blockTime;
      });
    }
    catch(error: any){
      console.error('Erro ao buscar histórico de transações:', error);
      return [];
    }
  }

  async getRecommendedFees(): Promise<{
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
  }> {
    try{
      let data = (<any>(await firstValueFrom(this.http.get('https://mempool.space/api/v1/fees/recommended'))));

      return {
        fastestFee: data.fastestFee || 20,
        halfHourFee: data.halfHourFee || 10,
        hourFee: data.hourFee || 5,
        economyFee: data.economyFee || 2,
        minimumFee: data.minimumFee || 1
      };
    }
    catch(error: any){
      console.error('Erro ao buscar taxas recomendadas:', error);
      return {
        fastestFee: 20,
        halfHourFee: 10,
        hourFee: 5,
        economyFee: 2,
        minimumFee: 1
      };
    }
  }

  async getRecommendedFeeInSatoshis(estimatedVBytes: number = 250, priority: 'fastest' | 'halfHour' | 'hour' | 'economy' | 'minimum' = 'hour'): Promise<number> {
    let fees = await this.getRecommendedFees();
    
    let feeRate: number;

    switch (priority) {
      case 'fastest':
        feeRate = fees.fastestFee;
        break;
      case 'halfHour':
        feeRate = fees.halfHourFee;
        break;
      case 'hour':
        feeRate = fees.hourFee;
        break;
      case 'economy':
        feeRate = fees.economyFee;
        break;
      case 'minimum':
        feeRate = fees.minimumFee;
        break;
      default:
        feeRate = fees.hourFee;
    }

    const totalFee = Math.ceil(feeRate * estimatedVBytes);
    
    return Math.max(1, totalFee);
  }
}

