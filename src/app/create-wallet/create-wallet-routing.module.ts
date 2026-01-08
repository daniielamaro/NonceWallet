import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CreateWalletPage } from './create-wallet.page';

const routes: Routes = [
  {
    path: '',
    component: CreateWalletPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CreateWalletPageRoutingModule {}

