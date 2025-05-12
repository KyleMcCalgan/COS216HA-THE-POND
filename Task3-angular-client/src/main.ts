// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter, Routes } from '@angular/router';
import { LoginComponent } from './app/components/login/login.component';
import { CustomerComponent } from './app/components/customer/customer.component';
import { OperatorComponent } from './app/components/operator/operator.component';
import { OrderHistoryComponent } from './app/components/order-history/order-history.component';
import { DispatchedOrdersComponent } from './app/components/dispatched-orders/dispatched-orders.component';
import { TrackComponent } from './app/components/track/track.component';
import { DispatchComponent } from './app/components/dispatch/dispatch.component'; // Import the new component

const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'customer', component: CustomerComponent },
  { path: 'operator', component: OperatorComponent },
  { path: 'operator/order-history', component: OrderHistoryComponent },
  { path: 'operator/dispatched-orders', component: DispatchedOrdersComponent },
  { path: 'operator/track/:orderId', component: TrackComponent },
  { path: 'operator/dispatch/:orderId', component: DispatchComponent }, // Add the new route
  { path: '**', redirectTo: '' }
];

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes)]
}).catch(err => console.error(err));