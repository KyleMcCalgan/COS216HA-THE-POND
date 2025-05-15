// import { Routes } from '@angular/router';
// import { LoginComponent } from './components/login/login.component';

// export const routes: Routes = [
//   { path: 'login', component: LoginComponent },
//   { path: '', redirectTo: '/login', pathMatch: 'full' },
//   // Add more routes as you develop them
// ];

// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { OperatorComponent } from './components/operator/operator';
import { OrderHistoryComponent } from './components/order-history/order-history';
import { DispatchedOrdersComponent } from './components/dispatched-orders/dispatched-orders';
import { TrackComponent } from './components/track/track';
import { DispatchComponent } from './components/dispatch/dispatch';
import { LoginComponent } from './components/login/login.component';
import { CustomerComponent } from './components/customer/customer';


export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'customer', component: CustomerComponent },
  { path: 'operator', component: OperatorComponent },
  { path: 'operator/order-history', component: OrderHistoryComponent },
  { path: 'operator/dispatched-orders', component: DispatchedOrdersComponent },
  { path: 'operator/track/:orderId', component: TrackComponent },
  { path: 'operator/dispatch/:orderId', component: DispatchComponent },
  { path: '**', redirectTo: '/login' }
];

