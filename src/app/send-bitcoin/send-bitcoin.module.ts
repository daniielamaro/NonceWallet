import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SendBitcoinPageRoutingModule } from './send-bitcoin-routing.module';
import { SendBitcoinPage } from './send-bitcoin.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SendBitcoinPageRoutingModule
  ],
  declarations: [SendBitcoinPage]
})
export class SendBitcoinPageModule {}

