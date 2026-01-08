import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SendBitcoinPage } from './send-bitcoin.page';

const routes: Routes = [
  {
    path: '',
    component: SendBitcoinPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SendBitcoinPageRoutingModule {}

