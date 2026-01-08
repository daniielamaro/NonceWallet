import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'create-wallet',
    loadChildren: () => import('./create-wallet/create-wallet.module').then( m => m.CreateWalletPageModule)
  },
  {
    path: 'wallet-details/:id',
    loadChildren: () => import('./wallet-details/wallet-details.module').then( m => m.WalletDetailsPageModule)
  },
  {
    path: 'send-bitcoin/:id',
    loadChildren: () => import('./send-bitcoin/send-bitcoin.module').then( m => m.SendBitcoinPageModule)
  },
  {
    path: 'receive-bitcoin/:id',
    loadChildren: () => import('./receive-bitcoin/receive-bitcoin.module').then( m => m.ReceiveBitcoinPageModule)
  },
  {
    path: 'transaction-history/:id',
    loadChildren: () => import('./transaction-history/transaction-history.module').then( m => m.TransactionHistoryPageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
