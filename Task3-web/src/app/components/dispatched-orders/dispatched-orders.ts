// src/app/components/dispatched-orders/dispatched-orders.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common'; // Import CommonModule

@Component({
  selector: 'app-dispatched-orders',
  standalone: true,
  imports: [CommonModule], // Add CommonModule to imports
  templateUrl: './dispatched-orders.html',
  styleUrls: ['./dispatched-orders.css']
})
export class DispatchedOrders {
  dispatchedOrders = [
    { orderId: '', products: [], status: '' }
  ];

  constructor(private router: Router) {}

  trackOrder(orderId: string) {
    this.router.navigate(['/operator/track', orderId]);
  }
}