import { Injectable } from '@angular/core';
import { BitcoinApiService } from './bitcoin-api.service';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as bitcoin from 'bitcoinjs-lib';
import { initEccLib } from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private network = bitcoin.networks.bitcoin; // Usar mainnet
  private ECPair = ECPairFactory(ecc);

  constructor(private bitcoinApi: BitcoinApiService) {
    initEccLib(ecc);
  }

  private toXOnly(pubKey: Buffer): Buffer {
    return pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);
  }

  private tapTweakHash(pubKeyXOnly: Buffer, h?: Buffer): Buffer {
    const data = h ? Buffer.concat([pubKeyXOnly, h]) : pubKeyXOnly;
    const hash = bitcoin.crypto.taggedHash('TapTweak', data);
    return Buffer.from(hash);
  }

  private tweakSigner(signer: any, opts: { network: any; tweakHash?: Buffer }): any {
    if (!signer.privateKey) {
      throw new Error('Signer sem privateKey');
    }

    let privateKey = Buffer.from(signer.privateKey);
    const publicKeyBuffer = Buffer.from(signer.publicKey);

    if (publicKeyBuffer[0] === 0x03) {
      privateKey = Buffer.from(ecc.privateNegate(privateKey));
    }

    const tweakHash = opts.tweakHash || this.tapTweakHash(this.toXOnly(publicKeyBuffer));

    const tweakedPrivateKey = ecc.privateAdd(privateKey, tweakHash);

    if (!tweakedPrivateKey) {
      throw new Error('Falha ao tweakar private key');
    }

    return this.ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
      network: opts.network
    });
  }

  getUTXOs(address: string, confirmedOnly: boolean = true): Observable<UTXO[]> {
    return this.bitcoinApi.getUTXOs(address, confirmedOnly).pipe(
      map((utxos: any[]) => {
        return utxos.map(utxo => ({
          txid: utxo.txid,
          vout: utxo.vout,
          value: utxo.value,
          status: utxo.status || { confirmed: false }
        }));
      }),
      catchError(error => {
        console.error('Erro ao buscar UTXOs:', error);
        return of([]);
      })
    );
  }

  async buildTransaction(
    utxos: UTXO[],
    recipientAddress: string,
    amount: number,
    fee: number,
    privateKey: string,
    senderAddress: string
  ): Promise<string> {
    const amountSatoshis = Math.floor(amount * 100000000);
    const feeSatoshis = fee;

    const confirmedUTXOs = utxos.filter(utxo => {
      return utxo.status && utxo.status.confirmed === true;
    });

    if (confirmedUTXOs.length === 0) {
      throw new Error('Nenhum UTXO confirmado disponível. Aguarde a confirmação das transações.');
    }

    const sortedUTXOs = [...confirmedUTXOs].sort((a, b) => b.value - a.value);
    let totalInput = 0;
    const selectedUTXOs: UTXO[] = [];
    const DUST_LIMIT = 546;

    const minimumRequired = amountSatoshis + feeSatoshis + DUST_LIMIT;

    for (const utxo of sortedUTXOs) {
      selectedUTXOs.push(utxo);
      totalInput += utxo.value;
      if (totalInput >= minimumRequired) {
        break;
      }
    }

    if (totalInput < amountSatoshis + feeSatoshis) {
      throw new Error('Saldo insuficiente nos UTXOs disponíveis');
    }

    const changeAmount = totalInput - amountSatoshis - feeSatoshis;

    if (changeAmount < 0) {
      throw new Error(`Saldo insuficiente. Necessário: ${amountSatoshis + feeSatoshis} satoshis, disponível: ${totalInput} satoshis`);
    }

    if (changeAmount > 0 && changeAmount < DUST_LIMIT) {
      const remainingUTXOs = sortedUTXOs.slice(selectedUTXOs.length);
      for (const nextUTXO of remainingUTXOs) {
        selectedUTXOs.push(nextUTXO);
        totalInput += nextUTXO.value;
        const newChangeAmount = totalInput - amountSatoshis - feeSatoshis;
        if (newChangeAmount >= DUST_LIMIT) {
          break;
        }
      }
    }

    const finalChangeAmount = totalInput - amountSatoshis - feeSatoshis;

    if (finalChangeAmount > 0 && finalChangeAmount < DUST_LIMIT) {
      const feeIfNoChange = totalInput - amountSatoshis;
      const adjustmentNeeded = DUST_LIMIT - finalChangeAmount;
      throw new Error(
        `Não é possível criar uma transação que respeite a taxa especificada de ${feeSatoshis} satoshis. ` +
        `O troco calculado (${finalChangeAmount} satoshis) é menor que o dust limit (${DUST_LIMIT} satoshis). ` +
        `Sem output de troco, a taxa seria ${feeIfNoChange} satoshis em vez de ${feeSatoshis} satoshis. ` +
        `Considere reduzir o valor enviado em ${(adjustmentNeeded / 100000000).toFixed(8)} BTC ou usar uma taxa de ${feeSatoshis + adjustmentNeeded} satoshis.`
      );
    }

    const utxosWithScripts = await this.getUTXOsWithScripts(selectedUTXOs);

    const txHex = await this.createRawTransactionHex(
      utxosWithScripts,
      recipientAddress,
      senderAddress,
      amountSatoshis,
      finalChangeAmount,
      feeSatoshis,
      privateKey
    );

    return txHex;
  }

  private async getUTXOsWithScripts(utxos: UTXO[]): Promise<any[]> {
    const utxosWithScripts = [];

    for (const utxo of utxos) {
      try {
        const txResponse = await fetch(`https://blockstream.info/api/tx/${utxo.txid}`);
        if (txResponse.ok) {
          const tx = await txResponse.json();
          if (tx.vout && tx.vout[utxo.vout]) {
            const txHexResponse = await fetch(`https://blockstream.info/api/tx/${utxo.txid}/hex`);
            let txHex = null;
            if (txHexResponse.ok) {
              txHex = await txHexResponse.text();
            }

            utxosWithScripts.push({
              ...utxo,
              scriptPubKey: tx.vout[utxo.vout].scriptpubkey,
              scriptPubKeyAsm: tx.vout[utxo.vout].scriptpubkey_asm,
              txHex: txHex
            });
          } else {
            utxosWithScripts.push(utxo);
          }
        } else {
          utxosWithScripts.push(utxo);
        }
      } catch (error) {
        console.error(`Erro ao buscar scriptPubKey para UTXO ${utxo.txid}:`, error);
        utxosWithScripts.push(utxo);
      }
    }

    return utxosWithScripts;
  }

  private async createRawTransactionHex(
    inputs: any[],
    recipientAddress: string,
    senderAddress: string,
    amountSatoshis: number,
    changeAmount: number,
    feeSatoshis: number,
    privateKey: string
  ): Promise<string> {
    try {
      const privateKeyBuffer = Buffer.from(privateKey, 'hex');
      if (privateKeyBuffer.length !== 32) {
        throw new Error('Chave privada inválida. Deve ter 32 bytes (64 caracteres hex).');
      }

      const keyPair = this.ECPair.fromPrivateKey(privateKeyBuffer, { network: this.network });

      const isSegWit = senderAddress.startsWith('bc1') && senderAddress.length === 42;
      const isTaproot = senderAddress.startsWith('bc1p') && senderAddress.length === 62;
      const isLegacy = !isSegWit && !isTaproot;

      if (isTaproot) {
        if (senderAddress.length !== 62) {
          throw new Error(`Endereço Taproot inválido: deve ter 62 caracteres, mas tem ${senderAddress.length}. Endereço: ${senderAddress}`);
        }
        if (!senderAddress.startsWith('bc1p')) {
          throw new Error(`Endereço Taproot inválido: deve começar com "bc1p", mas começa com "${senderAddress.slice(0, 4)}"`);
        }
      }

      let taprootPayment: bitcoin.payments.Payment | undefined;
      if (isTaproot) {
        const publicKeyBuffer = Buffer.from(keyPair.publicKey);
        const internalPubkey = this.toXOnly(publicKeyBuffer);

        if (internalPubkey.length !== 32) {
          throw new Error(`Chave interna Taproot inválida: esperado 32 bytes, obtido ${internalPubkey.length} bytes`);
        }

        taprootPayment = bitcoin.payments.p2tr({
          internalPubkey: internalPubkey,
          network: this.network
        });

        if (taprootPayment.address && taprootPayment.address !== senderAddress) {
          const errorMsg = `ERRO CRÍTICO: A chave privada não corresponde ao endereço Taproot!\n` +
            `Endereço gerado a partir da chave privada: ${taprootPayment.address}\n` +
            `Endereço da carteira: ${senderAddress}\n` +
            `Chave pública original: ${Buffer.from(keyPair.publicKey).toString('hex')}\n` +
            `Chave interna (X-only): ${Buffer.from(internalPubkey).toString('hex')}\n\n` +
            `Isso significa que a chave privada armazenada não é a chave correta para este endereço Taproot. ` +
            `Você precisa recriar a carteira ou verificar se a chave privada está correta.`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
      }

      const psbt = new bitcoin.Psbt({ network: this.network });

      for (const input of inputs) {
        const txid = input.txid;
        const vout = input.vout;

        if (!input.scriptPubKey) {
          throw new Error(
            `UTXO ${txid}:${vout} não possui scriptPubKey. ` +
            `É necessário buscar a transação anterior para obter o scriptPubKey correto.`
          );
        }

        const scriptPubKey = Buffer.from(input.scriptPubKey, 'hex');

        if (isTaproot && taprootPayment?.output) {
          const expected = Buffer.from(taprootPayment.output).toString('hex');
          const got = scriptPubKey.toString('hex');

          if (expected !== got) {
            const errorMsg =
              `UTXO scriptPubKey não bate com seu endereço Taproot.\n` +
              `Esperado: ${expected}\n` +
              `Recebido: ${got}\n` +
              `Isso indica que o UTXO não é desse endereço/chave.`;
            throw new Error(errorMsg);
          }
        }

        const inputData: any = {
          hash: txid,
          index: vout,
          sequence: 0xFFFFFFFD
        };

        if (isSegWit || isTaproot) {
          inputData.witnessUtxo = {
            script: scriptPubKey,
            value: BigInt(input.value)
          };
          if (isTaproot && taprootPayment) {
            if (taprootPayment.internalPubkey) {
              inputData.tapInternalKey = taprootPayment.internalPubkey;
            }
          }
        } else {
          if (input.txHex) {
            inputData.nonWitnessUtxo = Buffer.from(input.txHex, 'hex');
          } else {
            inputData.witnessUtxo = {
              script: scriptPubKey,
              value: BigInt(input.value)
            };
          }
        }

        psbt.addInput(inputData);
      }

      const totalInputValue = inputs.reduce((sum, input) => sum + input.value, 0);

      const recipientScript = bitcoin.address.toOutputScript(recipientAddress, this.network);
      psbt.addOutput({
        address: recipientAddress,
        value: BigInt(amountSatoshis)
      });

      const DUST_LIMIT = 546;

      const expectedChangeAmount = totalInputValue - amountSatoshis - feeSatoshis;

      if (Math.abs(changeAmount - expectedChangeAmount) > 1) {
        throw new Error(
          `Erro no cálculo do troco: esperado ${expectedChangeAmount} satoshis, obtido ${changeAmount} satoshis. ` +
          `Isso indica um problema no cálculo da transação.`
        );
      }

      if (changeAmount < DUST_LIMIT && changeAmount > 0) {
        const feeIfNoChange = totalInputValue - amountSatoshis;
        throw new Error(
          `Não é possível respeitar a taxa especificada de ${feeSatoshis} satoshis. ` +
          `O troco calculado (${changeAmount} satoshis) é menor que o dust limit (${DUST_LIMIT} satoshis). ` +
          `Sem output de troco, a taxa seria ${feeIfNoChange} satoshis. ` +
          `Considere ajustar a quantidade enviada ou selecionar UTXOs diferentes.`
        );
      }

      if (changeAmount >= DUST_LIMIT) {
        psbt.addOutput({
          address: senderAddress,
          value: BigInt(changeAmount)
        });
      }

      const totalOutputValue = amountSatoshis + (changeAmount >= DUST_LIMIT ? changeAmount : 0);
      const actualFee = totalInputValue - totalOutputValue;

      if (Math.abs(actualFee - feeSatoshis) > 1) {
        throw new Error(
          `Erro crítico: A taxa real (${actualFee} satoshis) não corresponde à taxa especificada (${feeSatoshis} satoshis). ` +
          `Isso indica um problema grave no cálculo da transação.`
        );
      }

      for (let i = 0; i < inputs.length; i++) {
        if (isTaproot) {
          const tweakedSigner = this.tweakSigner(keyPair, { network: this.network });
          psbt.signTaprootInput(i, tweakedSigner);
        } else {
          psbt.signInput(i, keyPair);
        }
      }

      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();

      return tx.toHex();
    } catch (error: any) {
      console.error('Erro ao criar transação:', error);
      throw new Error(`Erro ao construir transação: ${error.message || error}`);
    }
  }

}

