// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter, Routes } from '@angular/router';
import { LoginComponent } from './app/components/login/login.component';
import { CustomerComponent } from './app/components/customer/customer.component';
import { OperatorComponent } from './app/components/operator/operator.component';

const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'customer', component: CustomerComponent },
  { path: 'operator', component: OperatorComponent },
  { path: '**', redirectTo: '' }
];

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes)]
}).catch(err => console.error(err));