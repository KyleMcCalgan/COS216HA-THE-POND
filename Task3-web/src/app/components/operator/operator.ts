// src/app/components/operator/operator.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-operator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './operator.html',
  styleUrls: ['./operator.css']
})
export class OperatorComponent {
  outstandingOrders = [
    { orderId: '', products: [], status: '' }
  ];

  dispatchedDrones = [
    { id: 0, isAvailable: false, batteryLevel: 0, operator: '' }
  ];

  constructor(private router: Router) {}

  viewOrderHistory() {
    this.router.navigate(['/operator/order-history']);
  }

  viewDispatchedOrders() {
    this.router.navigate(['/operator/dispatched-orders']);
  }

  trackOrder(orderId: string) {
    this.router.navigate(['/operator/track', orderId]);
  }

  processOrder(orderId: string) {
    this.router.navigate(['/operator/dispatch', orderId]);
  }
}