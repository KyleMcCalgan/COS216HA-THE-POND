// src/app/components/customer/customer.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customer.html',
  styleUrls: ['./customer.css']
})
export class Customer {
  orders = [
    { orderId: 'C001', product: 'Drone Kit', status: 'Pending' },
    { orderId: 'C002', product: 'Battery Pack', status: 'Shipped' }
  ];
}