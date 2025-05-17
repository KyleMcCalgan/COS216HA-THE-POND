import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customer.html',
  styleUrls: ['./customer.css']
})
export class Customer implements OnInit {
  orders: any[] = [];
  loading = true;
  error = '';

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.fetchOrders();
  }

  private fetchOrders() {
    this.loading = true;
    
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // Use API service to get customer orders
    this.apiService.callApi('getAllOrders', {
      user_id: currentUser.id || 1,
      user_type: 'Customer'
    }).subscribe({
      next: (response: any) => {
        this.loading = false;
        console.log('API response data:', response);
        
        if (response.success && response.data) {
          // Process orders for display
          this.processOrders(response.data);
        } else {
          this.error = response.message || 'Failed to load orders';
          console.error('Failed to load orders:', response.message);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error connecting to the server';
        console.error('Error fetching orders:', err);
      }
    });
  }

  private processOrders(orders: any[]) {
    this.orders = [];
    
    for (const order of orders) {
      try {
        // Format product list (combine products into a single string)
        let productString = 'No products';
        if (order.products && Array.isArray(order.products)) {
          productString = order.products
            .map((p: any) => {
              if (p.title) {
                return `${p.title} (${p.quantity || 1}x)`;
              } else if (p.name) {
                return `${p.name} (${p.quantity || 1}x)`;
              } else {
                return `Product #${p.product_id || p.id || 'Unknown'} (${p.quantity || 1}x)`;
              }
            })
            .join(', ');
        }

        // Create processed order object
        const processedOrder = {
          orderId: order.order_id,
          product: productString,
          status: order.state
        };
        
        this.orders.push(processedOrder);
      } catch (error) {
        console.error('Error processing order:', error, order);
      }
    }
    
    console.log('Customer orders processed:', this.orders.length);
  }
}