import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class BitcoinApiService {
  private readonly API_BASE = 'https://blockstream.info/api';
  private btcPriceBRL: number = 0;
  private btcPriceUSD: number = 0;
  private lastPriceUpdate: number = 0;
  private readonly PRICE_CACHE_DURATION = 5 * 60 * 1000;

  constructor(private http: HttpClient) {
    this.btcPriceBRL = 250000;
    this.btcPriceUSD = 50000;
    this.updateBitcoinPrice().subscribe();
  }

  getBalance(address: string): Observable<number> {
    return this.http.get<any[]>(`${this.API_BASE}/address/${address}/utxo`).pipe(
      map((utxos: any[]) => {
        const confirmedUTXOs = utxos.filter(utxo => {
          return utxo.status && utxo.status.confirmed === true;
        });

        const balance = confirmedUTXOs.reduce((sum, utxo) => sum + (utxo.value || 0), 0);
        return balance / 100000000;
      }),
      catchError(error => {
        console.error('Erro ao consultar saldo:', error);
        return of(0);
      })
    );
  }

  getAddressInfo(address: string): Observable<any> {
    return this.http.get(`${this.API_BASE}/address/${address}`).pipe(
      catchError(error => {
        console.error('Erro ao consultar informações do endereço:', error);
        return of(null);
      })
    );
  }

  getUTXOs(address: string, confirmedOnly: boolean = true): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_BASE}/address/${address}/utxo`).pipe(
      map((utxos: any[]) => {
        if (confirmedOnly) {
          return utxos.filter(utxo => {
            return utxo.status && utxo.status.confirmed === true;
          });
        }
        return utxos;
      }),
      catchError(error => {
        console.error('Erro ao buscar UTXOs:', error);
        return of([]);
      })
    );
  }

  getTransaction(txid: string): Observable<any> {
    return this.http.get(`${this.API_BASE}/tx/${txid}`).pipe(
      catchError(error => {
        console.error('Erro ao buscar transação:', error);
        return of(null);
      })
    );
  }

  broadcastTransaction(txHex: string): Observable<string> {
    return this.http.post(`${this.API_BASE}/tx`, txHex, {
      headers: { 'Content-Type': 'text/plain' },
      responseType: 'text'
    }).pipe(
      map((response: any) => {
        if (typeof response === 'string') {
          return response;
        } else if (response && response.txid) {
          return response.txid;
        }
        return response;
      }),
      catchError(error => {
        console.error('Erro ao enviar transação:', error);
        let errorMessage = 'Erro ao transmitir transação';
        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.error) {
            errorMessage = error.error.error;
          }
        }
        throw new Error(errorMessage);
      })
    );
  }

  getBitcoinPriceBRL(): Observable<number> {
    const now = Date.now();

    if (this.btcPriceBRL > 0 && (now - this.lastPriceUpdate) < this.PRICE_CACHE_DURATION) {
      return of(this.btcPriceBRL);
    }

    return this.updateBitcoinPrice();
  }

  getBitcoinPriceUSD(): Observable<number> {
    const now = Date.now();

    if (this.btcPriceUSD > 0 && (now - this.lastPriceUpdate) < this.PRICE_CACHE_DURATION) {
      return of(this.btcPriceUSD);
    }

    return this.updateBitcoinPrice().pipe(
      map(() => this.btcPriceUSD)
    );
  }

  private updateBitcoinPrice(): Observable<number> {
    return this.http.get<any>('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,brl').pipe(
      map((data: any) => {
        if (data.bitcoin) {
          this.btcPriceUSD = data.bitcoin.usd || 50000;
          this.btcPriceBRL = data.bitcoin.brl || 250000;
          this.lastPriceUpdate = Date.now();
        }
        return this.btcPriceBRL;
      }),
      catchError(error => {
        console.error('Erro ao buscar cotação do Bitcoin:', error);
        if (this.btcPriceBRL === 0) {
          this.btcPriceBRL = 250000;
          this.btcPriceUSD = 50000;
        }
        return of(this.btcPriceBRL);
      })
    );
  }

  getCurrentPriceBRL(): number {
    return this.btcPriceBRL || 250000;
  }

  getCurrentPriceUSD(): number {
    return this.btcPriceUSD || 50000;
  }

  getPendingBalance(address: string): Observable<number> {
    return this.http.get<any[]>(`${this.API_BASE}/address/${address}/utxo`).pipe(
      map((utxos: any[]) => {
        const pendingUTXOs = utxos.filter(utxo => {
          return !utxo.status || utxo.status.confirmed === false;
        });

        const pendingBalance = pendingUTXOs.reduce((sum, utxo) => sum + (utxo.value || 0), 0);
        return pendingBalance / 100000000;
      }),
      catchError(error => {
        console.error('Erro ao consultar saldo pendente:', error);
        return of(0);
      })
    );
  }

  getPendingSent(address: string): Observable<number> {
    return this.http.get<any[]>(`${this.API_BASE}/address/${address}/txs`).pipe(
      map((transactions: any[]) => {
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
      }),
      catchError(error => {
        console.error('Erro ao consultar saldo pendente a enviar:', error);
        return of(0);
      })
    );
  }

  getTransactionHistory(address: string, limit: number = 25): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_BASE}/address/${address}/txs`).pipe(
      map((transactions: any[]) => {
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
      }),
      catchError(error => {
        console.error('Erro ao buscar histórico de transações:', error);
        return of([]);
      })
    );
  }

  getRecommendedFees(): Observable<{
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
  }> {
    return this.http.get<any>('https://mempool.space/api/v1/fees/recommended').pipe(
      map((data: any) => {
        return {
          fastestFee: data.fastestFee || 20,
          halfHourFee: data.halfHourFee || 10,
          hourFee: data.hourFee || 5,
          economyFee: data.economyFee || 2,
          minimumFee: data.minimumFee || 1
        };
      }),
      catchError(error => {
        console.error('Erro ao buscar taxas recomendadas:', error);
        return of({
          fastestFee: 20,
          halfHourFee: 10,
          hourFee: 5,
          economyFee: 2,
          minimumFee: 1
        });
      })
    );
  }

  getRecommendedFeeInSatoshis(estimatedVBytes: number = 250, priority: 'fastest' | 'halfHour' | 'hour' | 'economy' | 'minimum' = 'hour'): Observable<number> {
    return this.getRecommendedFees().pipe(
      map((fees) => {
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
      })
    );
  }
}

