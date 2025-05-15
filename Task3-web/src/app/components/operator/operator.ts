import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WebSocketService } from '../../services/websocket.service';
import { ApiService } from '../../services/api.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-operator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './operator.html',
  styleUrls: ['./operator.css']
})
export class Operator implements OnInit, OnDestroy {
  outstandingOrders: any[] = [];
  dispatchedDrones: any[] = [];
  loading = true;
  error = '';
  private wsSubscription: Subscription | null = null;

  constructor(
    private router: Router, 
    private webSocketService: WebSocketService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    // Connect to WebSocket
    this.webSocketService.connect();

    // Subscribe to WebSocket messages
    this.wsSubscription = this.webSocketService.messages$.subscribe((message: any) => {
      this.handleWebSocketMessage(message);
    });

    // Fetch initial data
    this.fetchOutstandingOrders();
    this.fetchDispatchedDrones();
  }

  ngOnDestroy() {
    // Unsubscribe and disconnect WebSocket
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    this.webSocketService.disconnect();
  }

  // Fetch outstanding orders using the API
  private fetchOutstandingOrders() {
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
          // Filter orders to only show those with "Storage" status
          const storageOrders = response.data.filter((order: any) => order.state === 'Storage');
          console.log('Filtered Storage orders:', storageOrders);
          
          // Process the orders for display
          this.processOrders(storageOrders);
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

  // Process orders for display
  private processOrders(orders: any[]) {
    this.outstandingOrders = [];
    
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

        // Create processed order object
        const processedOrder = {
          orderId: order.order_id,
          products: productsList,
          status: order.state,
          deliveryAddress: formattedAddress,
          customer: order.customer?.username || `Customer #${order.customer_id}`,
          customerId: order.customer_id,
          trackingNum: order.tracking_num
        };
        
        this.outstandingOrders.push(processedOrder);
      } catch (error) {
        console.error('Error processing order:', error, order);
      }
    }
    
    console.log('Outstanding orders processed:', this.outstandingOrders.length);
  }

  // Fetch dispatched drones (simplified version)
  private fetchDispatchedDrones() {
    this.apiService.callApi('getAllDrones', {}).subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.dispatchedDrones = response.data.map((drone: any) => ({
            id: drone.id,
            isAvailable: drone.is_available,
            batteryLevel: drone.battery_level,
            operator: drone.operator?.username || 'Unassigned'
          }));
        }
      },
      error: (err) => {
        console.error('Error fetching drones:', err);
      }
    });
  }

  // Handle WebSocket messages
  private handleWebSocketMessage(message: any) {
    console.log('WebSocket message received:', message.action);
    
    switch (message.action) {
      case 'orders_update':
        if (message.data) {
          const storageOrders = message.data.filter((order: any) => order.state === 'Storage');
          this.processOrders(storageOrders);
        }
        break;
        
      case 'drone_status_update':
        if (message.drones) {
          this.dispatchedDrones = message.drones.map((drone: any) => ({
            id: drone.id,
            isAvailable: drone.is_available,
            batteryLevel: drone.battery_level,
            operator: drone.operator?.username || 'Unassigned'
          }));
        }
        break;
    }
  }

  // Navigation methods
  viewOrderHistory() {
    this.router.navigate(['/operator/order-history']);
  }

  viewDispatchedOrders() {
    this.router.navigate(['/operator/dispatched-orders']);
  }

  trackOrder(orderId: string) {
    this.router.navigate(['/operator/track', orderId]);
  }

  processOrder(orderId: any) {
    console.log(`Processing order: ${orderId}`);
    this.router.navigate(['/operator/dispatch', orderId]);
  }

  // Refresh data
  refreshData() {
    this.fetchOutstandingOrders();
    this.fetchDispatchedDrones();
  }
}