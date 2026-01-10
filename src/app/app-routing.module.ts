import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./pages/home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'create-wallet',
    loadChildren: () => import('./pages/create-wallet/create-wallet.module').then( m => m.CreateWalletPageModule)
  },
  {
    path: 'wallet-details/:id',
    loadChildren: () => import('./pages/wallet-details/wallet-details.module').then( m => m.WalletDetailsPageModule)
  },
  {
    path: 'send-bitcoin/:id',
    loadChildren: () => import('./pages/send-bitcoin/send-bitcoin.module').then( m => m.SendBitcoinPageModule)
  },
  {
    path: 'receive-bitcoin/:id',
    loadChildren: () => import('./pages/receive-bitcoin/receive-bitcoin.module').then( m => m.ReceiveBitcoinPageModule)
  },
  {
    path: 'transaction-history/:id',
    loadChildren: () => import('./pages/transaction-history/transaction-history.module').then( m => m.TransactionHistoryPageModule)
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
