import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-history.html',
  styleUrls: ['./order-history.css']
})
export class OrderHistory implements OnInit {
  orderHistory: any[] = [];
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.fetchDeliveredOrders();
  }

  // Fetch orders with 'Delivered' status
  private fetchDeliveredOrders() {
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
          // Filter orders to only show those with "Delivered" status
          const deliveredOrders = response.data.filter((order: any) => order.state === 'Delivered');
          console.log('Filtered Delivered orders:', deliveredOrders);
          
          // Process the orders for display
          this.processOrders(deliveredOrders);
        } else {
          this.error = response.message || 'Failed to load order history';
          console.error('Failed to load order history:', response.message);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error connecting to the server';
        console.error('Error fetching order history:', err);
      }
    });
  }

  // Process orders for display
  private processOrders(orders: any[]) {
    this.orderHistory = [];
    
    for (const order of orders) {
      try {
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

        // Format delivery date
        let deliveryDate = order.delivery_date || 'Unknown';
        try {
          if (order.delivery_date) {
            // Format date to a more readable format
            const date = new Date(order.delivery_date);
            deliveryDate = date.toLocaleString();
          }
        } catch (e) {
          console.warn('Could not format delivery date:', e);
        }

        // Create processed order object
        const processedOrder = {
          orderId: order.order_id,
          products: productsList,
          status: order.state,
          destination: formattedAddress,
          customer: order.customer?.username || `Customer #${order.customer_id}`,
          customerId: order.customer_id,
          trackingNum: order.tracking_num,
          deliveryDate: deliveryDate
        };
        
        this.orderHistory.push(processedOrder);
      } catch (error) {
        console.error('Error processing order:', error, order);
      }
    }
    
    console.log('Order history processed:', this.orderHistory.length);
    
    // Sort orders by delivery date (newest first)
    this.orderHistory.sort((a, b) => {
      if (!a.deliveryDate || a.deliveryDate === 'Unknown') return 1;
      if (!b.deliveryDate || b.deliveryDate === 'Unknown') return -1;
      return new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime();
    });
  }

  // Go back to operator dashboard
  goBack() {
    this.router.navigate(['/operator']);
  }

  // Refresh data
  refreshData() {
    this.fetchDeliveredOrders();
  }
}