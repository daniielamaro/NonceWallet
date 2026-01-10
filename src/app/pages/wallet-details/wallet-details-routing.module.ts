import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { WalletDetailsPage } from './wallet-details.page';

const routes: Routes = [
  {
    path: '',
    component: WalletDetailsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WalletDetailsPageRoutingModule {}

