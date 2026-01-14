import { Injectable } from '@angular/core';
import { BitcoinApiService } from './bitcoin-api.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as bitcoin from 'bitcoinjs-lib';
import { initEccLib } from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';
import Decimal from 'decimal.js';

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

  async getUTXOs(address: string, confirmedOnly: boolean = true): Promise<UTXO[]> {
    let utxos = await this.bitcoinApi.getUTXOs(address, confirmedOnly)
    
    return utxos.map(utxo => ({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      status: utxo.status || { confirmed: false }
    }));
  }

  async buildTransaction(
    utxos: UTXO[],
    recipientAddress: string,
    amount: number,
    fee: number,
    privateKey: string,
    senderAddress: string
  ): Promise<string> {
    const amountDecimal = new Decimal(amount);
    const amountSatoshis = amountDecimal.mul(100000000).floor().toNumber();
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
      const adjustmentDecimal = new Decimal(adjustmentNeeded).div(100000000);
      throw new Error(
        `Não é possível criar uma transação que respeite a taxa especificada de ${feeSatoshis} satoshis. ` +
        `O troco calculado (${finalChangeAmount} satoshis) é menor que o dust limit (${DUST_LIMIT} satoshis). ` +
        `Sem output de troco, a taxa seria ${feeIfNoChange} satoshis em vez de ${feeSatoshis} satoshis. ` +
        `Considere reduzir o valor enviado em ${adjustmentDecimal.toFixed(8)} BTC ou usar uma taxa de ${feeSatoshis + adjustmentNeeded} satoshis.`
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
    const API_BASES = [
      'https://mempool.space/api', 
      'https://blockstream.info/api' 
    ];

    for (const utxo of utxos) {
      let scriptPubKey: string | null = null;
      let scriptPubKeyAsm: string | null = null;
      let txHex: string | null = null;
      let found = false;

      for (const apiBase of API_BASES) {
        try {
          const txResponse = await fetch(`${apiBase}/tx/${utxo.txid}`);
          if (txResponse.ok) {
            const tx = await txResponse.json();
            if (tx.vout && tx.vout[utxo.vout]) {
              scriptPubKey = tx.vout[utxo.vout].scriptpubkey;
              scriptPubKeyAsm = tx.vout[utxo.vout].scriptpubkey_asm;
              
              try {
                const txHexResponse = await fetch(`${apiBase}/tx/${utxo.txid}/hex`);
                if (txHexResponse.ok) {
                  txHex = await txHexResponse.text();
                }
              } catch (hexError) {

              }

              found = true;
              break;
            }
          }
        } catch (error) {
          continue;
        }
      }

      if (!found) {
        console.warn(`Não foi possível buscar scriptPubKey para UTXO ${utxo.txid}:${utxo.vout} de nenhuma API`);
      }

      utxosWithScripts.push({
        ...utxo,
        scriptPubKey: scriptPubKey,
        scriptPubKeyAsm: scriptPubKeyAsm,
        txHex: txHex
      });
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

      const isTaproot = senderAddress.startsWith('bc1p') && senderAddress.length === 62;

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

        inputData.witnessUtxo = {
          script: scriptPubKey,
          value: BigInt(input.value)
        };
        if (isTaproot && taprootPayment) {
          if (taprootPayment.internalPubkey) {
            inputData.tapInternalKey = taprootPayment.internalPubkey;
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
        if (!isTaproot) {
          throw new Error('Esta carteira suporta apenas endereços Taproot');
        }
        const tweakedSigner = this.tweakSigner(keyPair, { network: this.network });
        psbt.signTaprootInput(i, tweakedSigner);
      }

      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();

      return tx.toHex();
    } catch (error: any) {
      console.error('Erro ao criar transação:', error);
      throw new Error(`Erro ao construir transação: ${error.message || error}`);
    }
  }

  async accelerateTransaction(
    originalTxId: string,
    newFeeSatoshis: number,
    privateKey: string,
    senderAddress: string,
    availableBalanceSatoshis: number = 0
  ): Promise<string> {
    try {
      const originalTx = await this.bitcoinApi.getTransaction(originalTxId);
      if (!originalTx) {
        throw new Error('Transação original não encontrada');
      }

      if (originalTx.status?.confirmed) {
        throw new Error('Transação já foi confirmada e não pode ser acelerada');
      }

      const supportsRBF = await this.bitcoinApi.checkTransactionSupportsRBF(originalTxId);
      if (!supportsRBF) {
        throw new Error('Esta transação não suporta RBF (Replace-By-Fee)');
      }

      let originalInputValue = 0;
      let originalOutputValue = 0;
      let recipientAddress = '';
      let originalAmountSatoshis = 0;

      if (originalTx.vin) {
        for (const input of originalTx.vin) {
          if (input.prevout && input.prevout.scriptpubkey_address === senderAddress) {
            originalInputValue += input.prevout.value || 0;
          }
        }
      }

      if (originalTx.vout) {
        for (const output of originalTx.vout) {
          if (output.scriptpubkey_address === senderAddress) {
            originalOutputValue += output.value || 0;
          } else {
            recipientAddress = output.scriptpubkey_address;
            originalAmountSatoshis += output.value || 0;
          }
        }
      }

      const originalFeeSatoshis = originalInputValue - (originalAmountSatoshis + originalOutputValue);
      const feeDifference = newFeeSatoshis - originalFeeSatoshis;

      if (newFeeSatoshis <= originalFeeSatoshis) {
        throw new Error(
          `A nova taxa (${newFeeSatoshis} satoshis) deve ser maior que a taxa original (${originalFeeSatoshis} satoshis) para acelerar`
        );
      }

      const originalInputs: UTXO[] = [];
      for (const input of originalTx.vin) {
        if (input.prevout && input.prevout.scriptpubkey_address === senderAddress) {
          originalInputs.push({
            txid: input.txid,
            vout: input.vout,
            value: input.prevout.value,
            status: { confirmed: false }
          });
        }
      }

      const originalChangeAmount = originalInputValue - originalAmountSatoshis - originalFeeSatoshis;
      
      let newChangeAmount = originalInputValue - originalAmountSatoshis - newFeeSatoshis;
      
      let additionalInputs: UTXO[] = [];
      let additionalInputValue = 0;
      
      if (newChangeAmount < 0) {
        const neededAmount = Math.abs(newChangeAmount);
        
        if (neededAmount > availableBalanceSatoshis) {
          throw new Error(
            `Saldo disponível insuficiente para acelerar. ` +
            `Necessário: ${neededAmount} satoshis, ` +
            `Disponível: ${availableBalanceSatoshis} satoshis ` +
            `(troco original: ${originalChangeAmount} satoshis)`
          );
        }
        
        const allUtxos = await this.bitcoinApi.getUTXOs(senderAddress, false);
        
        const sortedUtxos = [...allUtxos]
          .filter(utxo => {
            return !originalInputs.some(origInput => 
              origInput.txid === utxo.txid && origInput.vout === utxo.vout
            );
          })
          .sort((a, b) => b.value - a.value);
        
        for (const utxo of sortedUtxos) {
          if (additionalInputValue >= neededAmount) break;
          additionalInputs.push(utxo);
          additionalInputValue += utxo.value;
        }
        
        if (additionalInputValue < neededAmount) {
          throw new Error(
            `Saldo disponível insuficiente para acelerar. ` +
            `Necessário: ${neededAmount} satoshis, ` +
            `Disponível em UTXOs adicionais: ${additionalInputValue} satoshis`
          );
        }
        
        const totalInputValue = originalInputValue + additionalInputValue;
        newChangeAmount = totalInputValue - originalAmountSatoshis - newFeeSatoshis;
      } else if (newChangeAmount > 0 && newChangeAmount < 546) {
        const dustAdjustment = newChangeAmount;
        const adjustedFee = newFeeSatoshis + dustAdjustment;
        const adjustedNeeded = adjustedFee - originalFeeSatoshis;
        
        if (adjustedNeeded > originalChangeAmount + availableBalanceSatoshis) {
          throw new Error(
            `Saldo insuficiente para acelerar (incluindo ajuste de dust). ` +
            `Necessário: ${adjustedNeeded} satoshis, ` +
            `Disponível: ${originalChangeAmount + availableBalanceSatoshis} satoshis`
          );
        }
        
        if (adjustedNeeded > originalChangeAmount) {
          const neededFromBalance = adjustedNeeded - originalChangeAmount;
          const allUtxos = await this.bitcoinApi.getUTXOs(senderAddress, false);
          const sortedUtxos = [...allUtxos]
            .filter(utxo => {
              return !originalInputs.some(origInput => 
                origInput.txid === utxo.txid && origInput.vout === utxo.vout
              );
            })
            .sort((a, b) => b.value - a.value);
          
          for (const utxo of sortedUtxos) {
            if (additionalInputValue >= neededFromBalance) break;
            additionalInputs.push(utxo);
            additionalInputValue += utxo.value;
          }
          
          if (additionalInputValue < neededFromBalance) {
            throw new Error('Saldo insuficiente para acelerar (ajuste de dust)');
          }
        }
      }
      
      const allInputs = [...originalInputs, ...additionalInputs];

      const DUST_LIMIT = 546;
      if (newChangeAmount > 0 && newChangeAmount < DUST_LIMIT) {
        const adjustedFee = newFeeSatoshis + newChangeAmount;
        const adjustedChangeAmount = 0;

        const utxosWithScripts = await this.getUTXOsWithScripts(allInputs);
        return await this.createRawTransactionHex(
          utxosWithScripts,
          recipientAddress,
          senderAddress,
          originalAmountSatoshis,
          adjustedChangeAmount,
          adjustedFee,
          privateKey
        );
      }

      const utxosWithScripts = await this.getUTXOsWithScripts(allInputs);
      return await this.createRawTransactionHex(
        utxosWithScripts,
        recipientAddress,
        senderAddress,
        originalAmountSatoshis,
        newChangeAmount,
        newFeeSatoshis,
        privateKey
      );
    } catch (error: any) {
      console.error('Erro ao acelerar transação:', error);
      throw new Error(`Erro ao acelerar transação: ${error.message || error}`);
    }
  }

  async cancelTransaction(
    originalTxId: string,
    newFeeSatoshis: number,
    privateKey: string,
    senderAddress: string,
    sentAmountSatoshis: number
  ): Promise<string> {
    try {
      const originalTx = await this.bitcoinApi.getTransaction(originalTxId);
      if (!originalTx) {
        throw new Error('Transação original não encontrada');
      }

      if (originalTx.status?.confirmed) {
        throw new Error('Transação já foi confirmada e não pode ser cancelada');
      }

      const supportsRBF = await this.bitcoinApi.checkTransactionSupportsRBF(originalTxId);
      if (!supportsRBF) {
        throw new Error('Esta transação não suporta RBF (Replace-By-Fee)');
      }

      let totalInputValue = 0;
      let originalSentAmountSatoshis = 0;

      if (originalTx.vin) {
        for (const input of originalTx.vin) {
          if (input.prevout && input.prevout.scriptpubkey_address === senderAddress) {
            totalInputValue += input.prevout.value || 0;
          }
        }
      }

      if (originalTx.vout) {
        for (const output of originalTx.vout) {
          if (output.scriptpubkey_address !== senderAddress) {
            originalSentAmountSatoshis += output.value || 0;
          }
        }
      }

      let totalOutputValue = 0;
      if (originalTx.vout) {
        for (const output of originalTx.vout) {
          totalOutputValue += output.value || 0;
        }
      }

      const currentFeeSatoshis = totalInputValue - totalOutputValue;
      const feeDifference = newFeeSatoshis - currentFeeSatoshis;

      const actualSentAmount = sentAmountSatoshis > 0 ? sentAmountSatoshis : originalSentAmountSatoshis;

      if (feeDifference > actualSentAmount) {
        throw new Error(
          `Valor enviado insuficiente para cancelar. ` +
          `Diferença de taxa necessária: ${feeDifference} satoshis, ` +
          `Valor enviado: ${actualSentAmount} satoshis`
        );
      }

      const allInputs: UTXO[] = [];
      for (const input of originalTx.vin) {
        if (input.prevout && input.prevout.scriptpubkey_address === senderAddress) {
          allInputs.push({
            txid: input.txid,
            vout: input.vout,
            value: input.prevout.value,
            status: { confirmed: false }
          });
        }
      }

      const DUST_LIMIT = 546;
      
      const amountToSendBack = totalInputValue - newFeeSatoshis;

      if (amountToSendBack < 0) {
        throw new Error('A nova taxa é maior que o valor total dos inputs. Não é possível cancelar.');
      }

      if (amountToSendBack < DUST_LIMIT && amountToSendBack > 0) {
        const adjustedFee = totalInputValue;
        const adjustedAmount = 0;
        
        const adjustedFeeDifference = adjustedFee - currentFeeSatoshis;
        if (adjustedFeeDifference > actualSentAmount) {
          throw new Error(
            `Valor enviado insuficiente para cancelar. ` +
            `Diferença de taxa necessária: ${adjustedFeeDifference} satoshis, ` +
            `Valor enviado: ${actualSentAmount} satoshis`
          );
        }

        const utxosWithScripts = await this.getUTXOsWithScripts(allInputs);
        return await this.createRawTransactionHex(
          utxosWithScripts,
          senderAddress,
          senderAddress,
          adjustedAmount,
          0,
          adjustedFee,
          privateKey
        );
      }

      if (amountToSendBack === 0) {
        const utxosWithScripts = await this.getUTXOsWithScripts(allInputs);
        return await this.createRawTransactionHex(
          utxosWithScripts,
          senderAddress,
          senderAddress,
          0,
          0,
          totalInputValue,
          privateKey
        );
      }

      const utxosWithScripts = await this.getUTXOsWithScripts(allInputs);
      return await this.createRawTransactionHex(
        utxosWithScripts,
        senderAddress,
        senderAddress,
        amountToSendBack,
        0,
        newFeeSatoshis,
        privateKey
      );
    } catch (error: any) {
      console.error('Erro ao cancelar transação:', error);
      throw new Error(`Erro ao cancelar transação: ${error.message || error}`);
    }
  }

}

