// src/app/components/customer/customer.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-customer',
  standalone: true,
  templateUrl: './customer.html',
  styleUrls: ['./customer.css']
})
export class CustomerComponent {
  // Placeholder for orders (to be fetched from API later)
  orders = [
    { orderId: 'CS-1234567890', products: ['Book', 'Pen'], status: 'Storage' },
    { orderId: 'CS-0987654321', products: ['Laptop Charger'], status: 'Storage' }
  ];

  requestDelivery(orderId: string) {
    alert(`Delivery requested for order: ${orderId}`);
    // Later, this will call the API to request delivery
  }
}