// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { Operator } from './components/operator/operator';
import { OrderHistory } from './components/order-history/order-history';
import { DispatchedOrders } from './components/dispatched-orders/dispatched-orders';
import { Track } from './components/track/track';
import { Dispatch } from './components/dispatch/dispatch';
import { Login } from './components/login/login';
import { Customer } from './components/customer/customer';
import { CustomerTrack } from './components/customer-track/customer-track';
import { NewOrder } from './components/new-order/new-order';
import { FlappyDrone } from './components/flappy-drone/flappy-drone'; // Add this import

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'customer', component: Customer },
  { path: 'customer/track/:orderId', component: CustomerTrack },
  { path: 'customer/new-order', component: NewOrder },
  { path: 'customer/flappy-drone', component: FlappyDrone }, // Add this route
  { path: 'operator', component: Operator },
  { path: 'operator/order-history', component: OrderHistory },
  { path: 'operator/dispatched-orders', component: DispatchedOrders },
  { path: 'operator/track/:orderId', component: Track },
  { path: 'operator/dispatch/:orderId', component: Dispatch },
  { path: '**', redirectTo: '/login' }
];