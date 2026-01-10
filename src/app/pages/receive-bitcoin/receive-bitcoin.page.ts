import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { AlertService } from '../../services/alert.service';
import { Wallet } from '../../domain/wallet';

@Component({
  selector: 'app-receive-bitcoin',
  templateUrl: './receive-bitcoin.page.html',
  styleUrls: ['./receive-bitcoin.page.scss'],
  standalone: false,
})
export class ReceiveBitcoinPage implements OnInit, AfterViewInit {
  
  @ViewChild('qrCanvas', { static: false }) qrCanvas!: ElementRef<HTMLCanvasElement>;
  wallet: Wallet | null = null;
  qrCodeData: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    const walletId = this.route.snapshot.paramMap.get('id');
    if (walletId) {
      this.wallet = this.storageService.getWallet(walletId);
      if (this.wallet) {
        this.qrCodeData = `bitcoin:${this.wallet.address}`;
      } else {
        this.router.navigate(['/home']);
      }
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.wallet && this.qrCanvas) {
        this.generateQRCode();
      }
    }, 100);
  }

  async copyAddress() {
    if (this.wallet) {
      try {
        await navigator.clipboard.writeText(this.wallet.address);
        this.alertService.toastSuccess('Endereço copiado!');
      } catch (error) {
        this.alertService.toastError('Erro ao copiar endereço');
      }
    }
  }

  private generateQRCode() {
    if (!this.qrCanvas || !this.qrCodeData) return;

    const canvas = this.qrCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const qrSize = 256;
    canvas.width = qrSize;
    canvas.height = qrSize;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const encodedData = encodeURIComponent(this.qrCodeData);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodedData}`;
    
    img.onload = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, qrSize, qrSize);
      
      ctx.drawImage(img, 0, 0, qrSize, qrSize);
    };
    
    img.onerror = () => {
      this.generateQRCodeFallback(ctx, qrSize);
    };
    
    img.src = qrUrl;
  }

  private generateQRCodeFallback(ctx: CanvasRenderingContext2D, size: number) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const moduleCount = 25;
    const moduleSize = Math.floor(size / moduleCount);
    const modules = this.createSimpleQRModules(this.qrCodeData, moduleCount);

    ctx.fillStyle = '#000000';
    for (let y = 0; y < moduleCount; y++) {
      for (let x = 0; x < moduleCount; x++) {
        if (modules[y][x]) {
          ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
        }
      }
    }
  }

  private createSimpleQRModules(data: string, size: number): boolean[][] {
    const modules: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));

    this.drawFinderPattern(modules, 0, 0, size);
    this.drawFinderPattern(modules, size - 7, 0, size);
    this.drawFinderPattern(modules, 0, size - 7, size);

    const dataBits = this.stringToBits(data);
    let bitIndex = 0;

    for (let y = 0; y < size && bitIndex < dataBits.length; y++) {
      const direction = (y % 2 === 0) ? 1 : -1;
      const startX = (direction === 1) ? 0 : size - 1;
      
      for (let x = 0; x < size; x++) {
        const actualX = (direction === 1) ? x : size - 1 - x;
        
        if (!this.isInReservedArea(actualX, y, size)) {
          if (bitIndex < dataBits.length) {
            modules[y][actualX] = dataBits[bitIndex];
            bitIndex++;
          } else {
            modules[y][actualX] = (y + actualX) % 2 === 0;
          }
        }
      }
    }

    return modules;
  }

  private drawFinderPattern(modules: boolean[][], startX: number, startY: number, size: number) {
    const pattern = [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1]
    ];

    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        if (startY + y < size && startX + x < size) {
          modules[startY + y][startX + x] = pattern[y][x] === 1;
        }
      }
    }
  }

  private isInReservedArea(x: number, y: number, size: number): boolean {
    const finderPatterns = [
      { x: 0, y: 0, w: 7, h: 7 },
      { x: size - 7, y: 0, w: 7, h: 7 },
      { x: 0, y: size - 7, w: 7, h: 7 }
    ];

    for (const pattern of finderPatterns) {
      if (x >= pattern.x && x < pattern.x + pattern.w &&
          y >= pattern.y && y < pattern.y + pattern.h) {
        return true;
      }
    }

    if (y === 6 || x === 6) {
      return true;
    }

    return false;
  }

  private stringToBits(str: string): boolean[] {
    const bits: boolean[] = [];
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      for (let j = 7; j >= 0; j--) {
        bits.push((charCode & (1 << j)) !== 0);
      }
    }
    return bits;
  }
}

