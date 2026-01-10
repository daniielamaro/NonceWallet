import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ReceiveBitcoinPageRoutingModule } from './receive-bitcoin-routing.module';
import { ReceiveBitcoinPage } from './receive-bitcoin.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReceiveBitcoinPageRoutingModule
  ],
  declarations: [ReceiveBitcoinPage]
})
export class ReceiveBitcoinPageModule {}

