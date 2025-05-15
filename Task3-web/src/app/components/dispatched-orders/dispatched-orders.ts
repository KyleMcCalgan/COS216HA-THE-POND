import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

// Define interface for our order data structure
interface Order {
  id: number;
  customer_id: number;
  tracking_num: string;
  state: string;
  products: any[];
  destination_latitude: number;
  destination_longitude: number;
  drone_id?: number;
  created_at: string;
  customer_name?: string;
}

@Component({
  selector: 'app-dispatched-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dispatched-orders.html',
  styleUrls: ['./dispatched-orders.css']
})
export class DispatchedOrders implements OnInit {
  dispatchedOrders: Order[] = [];
  loading = true;
  error = '';

  constructor(private router: Router, private apiService: ApiService) {}

  ngOnInit(): void {
    this.fetchOrders();
  }

  fetchOrders(): void {
    // Get current user from localStorage (or you could use AuthService)
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // Make API call to get all orders
    this.apiService.callApi<Order[]>('getAllOrders', {
      user_id: currentUser.id || 1, // Use the logged-in user's ID if available, or default to 1
      user_type: currentUser.type || 'Courier' // Use the logged-in user's type, or default to Courier
    }).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data) {
          // Filter orders to only show those with Out_for_delivery status
          this.dispatchedOrders = response.data.filter(order => order.state === 'Out_for_delivery');
          
          // If no dispatched orders, set empty array
          if (this.dispatchedOrders.length === 0) {
            console.log('No orders currently being delivered');
          }
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

  trackOrder(orderId: number): void {
    this.router.navigate(['/operator/track', orderId]);
  }

  // Helper method to get product names from products array
  getProductNames(products: any[]): string {
    if (!products || products.length === 0) {
      return 'No products';
    }
    return products.map(p => p.name || `Product #${p.id}`).join(', ');
  }
  
  // Go back to operator dashboard
  goBack(): void {
    this.router.navigate(['/operator']);
  }
}