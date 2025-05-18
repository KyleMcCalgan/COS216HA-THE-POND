import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Router, RouterModule } from '@angular/router';

interface Order {
  orderId: string;
  product: string;
  status: string;
  date?: string;
}

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './customer.html',
  styleUrls: ['./customer.css']
})
export class Customer implements OnInit {
  storageOrders: Order[] = [];
  activeOrders: Order[] = [];
  pastOrders: Order[] = [];
  loading = true;
  error = '';
  
  // Track which section is currently active
  activeSection = 'storage'; // Default section to show

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

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
          // Process orders and categorize them
          this.categorizeOrders(response.data);
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

  private categorizeOrders(orders: any[]) {
    this.storageOrders = [];
    this.activeOrders = [];
    this.pastOrders = [];
    
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

        // Format date if it exists
        let formattedDate = '';
        if (order.created_at) {
          try {
            const date = new Date(order.created_at);
            formattedDate = date.toLocaleDateString();
          } catch (e) {
            console.warn('Could not format date:', e);
          }
        }

        // Create processed order object
        const processedOrder: Order = {
          orderId: order.order_id,
          product: productString,
          status: order.state,
          date: formattedDate
        };
        
        // Categorize orders based on their status
        const status = order.state.toLowerCase();
        
        if (status === 'storage') {
          this.storageOrders.push(processedOrder);
        } else if (status === 'out_for_delivery' || status === 'out for delivery' || status === 'dispatched' || status === 'shipping') {
          this.activeOrders.push(processedOrder);
        } else if (status === 'delivered' || status === 'completed') {
          this.pastOrders.push(processedOrder);
        }
      } catch (error) {
        console.error('Error processing order:', error, order);
      }
    }
    
    console.log('Orders categorized:', {
      storage: this.storageOrders.length,
      active: this.activeOrders.length,
      past: this.pastOrders.length
    });
  }
  
  navigateToTrack(orderId: string) {
    this.router.navigate(['/customer/track', orderId]);
  }
  
  navigateToNewOrder() {
    this.router.navigate(['/customer/new-order']);
  }
  
  navigateToGame() {
    this.router.navigate(['/customer/flappy-drone']);
  }
  
  // Method to change which section is shown
  showSection(section: string) {
    this.activeSection = section;
  }
  
  // Refresh all orders
  refreshOrders() {
    this.fetchOrders();
  }
}