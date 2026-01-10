import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CreateWalletPageRoutingModule } from './create-wallet-routing.module';
import { CreateWalletPage } from './create-wallet.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CreateWalletPageRoutingModule
  ],
  declarations: [CreateWalletPage]
})
export class CreateWalletPageModule {}

