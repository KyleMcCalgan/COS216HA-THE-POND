// src/app/components/order-history/order-history.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule], // Add CommonModule to imports
  templateUrl: './order-history.html',
  styleUrls: ['./order-history.css']
})
export class OrderHistoryComponent {
  orderHistory = [
    { orderId: '', products: [], status: '', deliveryDate: '' }
  ];
}