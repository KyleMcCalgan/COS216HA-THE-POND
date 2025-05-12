import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component'; // Import LoginComponent

// Define routes
const routes: Routes = [
  { path: '', component: LoginComponent }, // Default route to LoginComponent
  { path: '**', redirectTo: '' } // Wildcard route to redirect to default
];

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent // Ensure LoginComponent is declared
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes) // Import RouterModule with routes
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}