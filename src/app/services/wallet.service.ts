import { Injectable } from '@angular/core';
import * as bitcoin from 'bitcoinjs-lib';
import { initEccLib } from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import { AddressType, Wallet } from '../domain/wallet';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private network = bitcoin.networks.bitcoin;
  private ECPair = ECPairFactory(ecc);
  private bip32 = BIP32Factory(ecc);

  constructor() {
    initEccLib(ecc);
  }

  generateSeed(): string[] {
    // Gera um mnemônico BIP39 válido de 12 palavras (128 bits de entropia)
    const mnemonic = bip39.generateMnemonic(128);
    return mnemonic.split(' ');
  }

  async generateWalletFromSeed(seed: string[], name: string, addressType: AddressType = 'taproot'): Promise<Wallet> {
    try {
      const mnemonic = seed.join(' ');

      // Valida o mnemônico BIP39
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Mnemônico BIP39 inválido. Verifique se todas as palavras estão corretas.');
      }

      // Converte mnemônico para seed usando PBKDF2 (BIP39)
      const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
      
      // Deriva a chave privada usando BIP32
      // Caminhos de derivação:
      // - SegWit (BIP84): m/84'/0'/0'/0/0
      // - Taproot (BIP86): m/86'/0'/0'/0/0
      // - Legacy (BIP44): m/44'/0'/0'/0/0
      const root = this.bip32.fromSeed(seedBuffer, this.network);
      let path: string;
      if (addressType === 'segwit') {
        path = "m/84'/0'/0'/0/0"; // BIP84 - SegWit
      } else {
        path = "m/86'/0'/0'/0/0"; // BIP86 - Taproot
      }
      const child = root.derivePath(path);

      if (!child.privateKey) {
        throw new Error('Falha ao derivar chave privada do seed BIP39');
      }

      const privateKeyHex = Buffer.from(child.privateKey).toString('hex');

      const address = await this.generateAddressFromPrivateKey(privateKeyHex, addressType);

      const wallet = {
        id: this.generateId(),
        name,
        address,
        privateKey: privateKeyHex,
        seed,
        addressType,
        createdAt: Date.now()
      };

      return wallet;
    } catch (error: any) {
      console.error('Erro em generateWalletFromSeed:', error);
      throw error;
    }
  }

  async generateWalletFromPrivateKey(privateKey: string, name: string, addressType: AddressType = 'taproot'): Promise<Wallet> {
    let normalizedKey = privateKey.trim().replace(/^0x/i, '').replace(/\s/g, '');

    if (normalizedKey.length < 64) {
      normalizedKey = normalizedKey.padEnd(64, '0');
    } else if (normalizedKey.length > 64) {
      normalizedKey = normalizedKey.substring(0, 64);
    }

    const address = await this.generateAddressFromPrivateKey(normalizedKey, addressType);

    return {
      id: this.generateId(),
      name,
      address,
      privateKey: normalizedKey,
      seed: [],
      addressType,
      createdAt: Date.now()
    };
  }

  private async generateAddressFromPrivateKey(privateKey: string, addressType: AddressType = 'taproot'): Promise<string> {
    try {
      const privateKeyBuffer = Buffer.from(privateKey, 'hex');

      if (privateKeyBuffer.length !== 32) {
        throw new Error('Chave privada deve ter exatamente 32 bytes (64 caracteres hex)');
      }

      const keyPair = this.ECPair.fromPrivateKey(privateKeyBuffer, { network: this.network });

      let address: string | undefined;

      if (addressType === 'taproot') {
        const xOnlyPubkey = keyPair.publicKey.slice(1, 33);

        if (xOnlyPubkey.length !== 32) {
          throw new Error(`Chave pública X-only inválida: esperado 32 bytes, obtido ${xOnlyPubkey.length} bytes`);
        }

        const { address: taprootAddress } = bitcoin.payments.p2tr({
          internalPubkey: xOnlyPubkey,
          network: this.network
        });

        if (!taprootAddress) {
          throw new Error('Falha ao gerar endereço Taproot: endereço é nulo');
        }

        if (!taprootAddress.startsWith('bc1p')) {
          throw new Error(`Endereço Taproot inválido: deve começar com "bc1p", mas começa com "${taprootAddress.substring(0, 4)}"`);
        }

        if (taprootAddress.length !== 62) {
          throw new Error(`Endereço Taproot inválido: deve ter 62 caracteres, mas tem ${taprootAddress.length} caracteres. Endereço: ${taprootAddress}`);
        }

        address = taprootAddress;
      } else {
        const { address: segwitAddress } = bitcoin.payments.p2wpkh({
          pubkey: keyPair.publicKey,
          network: this.network
        });
        address = segwitAddress;
      }

      if (!address) {
        throw new Error('Falha ao gerar endereço Bitcoin');
      }

      return address;
    } catch (error: any) {
      console.error('Erro em generateAddressFromPrivateKey:', error);
      throw new Error(`Erro ao gerar endereço: ${error.message || error}`);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  validateSeed(seed: string[]): boolean {
    if (seed.length !== 12) {
      return false;
    }

    // Valida usando BIP39 (verifica palavras e checksum)
    const mnemonic = seed.join(' ');
    return bip39.validateMnemonic(mnemonic);
  }

  isWordValid(word: string): boolean {
    if (!word || word.trim() === '') {
      return false;
    }
    
    // Obtém a lista de palavras BIP39
    const wordList = bip39.wordlists['english'];
    return wordList.includes(word.trim().toLowerCase());
  }
}

