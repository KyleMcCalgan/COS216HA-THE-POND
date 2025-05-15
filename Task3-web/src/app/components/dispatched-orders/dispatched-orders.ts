import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dispatched-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dispatched-orders.html',
  styleUrls: ['./dispatched-orders.css']
})
export class DispatchedOrders implements OnInit {
  dispatchedOrders: any[] = [];
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.fetchDispatchedOrders();
  }

  // Fetch orders with 'Out_for_delivery' status
  private fetchDispatchedOrders() {
    this.loading = true;
    
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // Use API service to get all orders
    this.apiService.callApi('getAllOrders', {
      user_id: currentUser.id || 1,
      user_type: currentUser.type || 'Courier'
    }).subscribe({
      next: (response: any) => {
        this.loading = false;
        console.log('API response data:', response);
        
        if (response.success && response.data) {
          // Filter orders to only show those with "Out_for_delivery" status
          const outForDeliveryOrders = response.data.filter((order: any) => 
            order.state === 'Out_for_delivery'
          );
          console.log('Filtered Out_for_delivery orders:', outForDeliveryOrders);
          
          // Process the orders for display
          this.processOrders(outForDeliveryOrders);
        } else {
          this.error = response.message || 'Failed to load dispatched orders';
          console.error('Failed to load dispatched orders:', response.message);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error connecting to the server';
        console.error('Error fetching dispatched orders:', err);
      }
    });
  }

  // Process orders for display
  private processOrders(orders: any[]) {
    this.dispatchedOrders = [];
    
    for (const order of orders) {
      try {
        console.log('Processing order:', order);
        
        // Format products list
        let productsList: string[] = [];
        if (order.products && Array.isArray(order.products)) {
          productsList = order.products.map((p: any) => {
            if (p.title) {
              return `${p.title} (${p.quantity || 1}x)`;
            } else if (p.name) {
              return `${p.name} (${p.quantity || 1}x)`;
            } else {
              return `Product #${p.product_id || p.id || 'Unknown'} (${p.quantity || 1}x)`;
            }
          });
        } else {
          productsList = ['No products'];
        }

        // Format coordinates
        let lat = order.destination_latitude;
        let lng = order.destination_longitude;
        let formattedAddress = `${lat}, ${lng}`;
        
        try {
          // Try to format with 4 decimal places if possible
          if (typeof lat === 'number') lat = lat.toFixed(4);
          if (typeof lng === 'number') lng = lng.toFixed(4);
          formattedAddress = `${lat}, ${lng}`;
        } catch (e) {
          console.warn('Could not format coordinates:', e);
        }

        // Get drone information if available
        const droneId = order.drone_id || 'Unknown';

        // Create processed order object
        const processedOrder = {
          orderId: order.order_id,
          orderIdStr: String(order.order_id), // Ensure we have a string version for routing
          products: productsList,
          status: order.state,
          destination: formattedAddress,
          customer: order.customer?.username || `Customer #${order.customer_id}`,
          customerId: order.customer_id,
          trackingNum: order.tracking_num,
          droneId: droneId
        };
        
        console.log('Processed order:', processedOrder);
        this.dispatchedOrders.push(processedOrder);
      } catch (error) {
        console.error('Error processing order:', error, order);
      }
    }
    
    console.log('Dispatched orders processed:', this.dispatchedOrders.length);
  }

  // Navigate to track page for specific order
  trackOrder(orderId: string) {
    console.log('Tracking order:', orderId);
    if (!orderId) {
      console.error('Cannot track order: No order ID provided');
      return;
    }
    this.router.navigate(['/operator/track', orderId]);
  }

  // Go back to operator dashboard
  goBack() {
    this.router.navigate(['/operator']);
  }

  // Refresh data
  refreshData() {
    this.fetchDispatchedOrders();
  }

  // Get product names as a string for display
  getProductNames(products: string[]): string {
    return products.join(', ');
  }
}