import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ReceiveBitcoinPage } from './receive-bitcoin.page';

const routes: Routes = [
  {
    path: '',
    component: ReceiveBitcoinPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReceiveBitcoinPageRoutingModule {}

