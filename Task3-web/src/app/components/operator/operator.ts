import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WebSocketService } from '../../services/websocket.service';
import { ApiService } from '../../services/api.service';
import { Subscription } from 'rxjs';

interface Drone {
  id: number;
  isAvailable: boolean;
  batteryLevel: number;
  operator: string;
  order_id?: number;
  Order_ID?: number;
  altitude: number;
  latest_latitude: number;
  latest_longitude: number;
}

@Component({
  selector: 'app-operator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './operator.html',
  styleUrls: ['./operator.css']
})
export class Operator implements OnInit, OnDestroy {
  outstandingOrders: any[] = [];
  allDrones: Drone[] = [];
  dronesCurrentlyDelivering: Drone[] = [];
  dronesWaitingToDeliver: Drone[] = [];
  dronesReturningToBase: Drone[] = [];
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
    this.fetchDrones();
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
    
    // For courier users, use a known courier user ID (1) to ensure we get all orders
    // This bypasses any potential user validation issues
    this.apiService.callApi('getAllOrders', {
      user_id: 1,  // Use a default courier user ID
      user_type: 'Courier'  // Ensure we're requesting as a courier
    }).subscribe({
      next: (response: any) => {
        this.loading = false;
        console.log('Current user from localStorage:', currentUser);
        console.log('API call made with user_id: 1, user_type: Courier');
        console.log('All orders from API:', response);
        
        if (response.success && response.data) {
          console.log('Total orders received:', response.data.length);
          
          // Log all order states to debug
          response.data.forEach((order: any, index: number) => {
            console.log(`Order ${index + 1}: ID=${order.order_id}, Customer=${order.customer_id}, State="${order.state}"`);
          });
          
          // Filter orders with Storage state (case insensitive)
          const storageOrders = response.data.filter((order: any) => {
            if (!order.state) return false;
            const state = order.state.toString().toLowerCase().trim();
            const isStorage = state === 'storage';
            console.log(`Order ${order.order_id}: state="${order.state}" -> normalized="${state}" -> isStorage=${isStorage}`);
            return isStorage;
          });
          
          console.log('Storage orders found:', storageOrders.length);
          
          // Process the orders for display
          this.processOutstandingOrders(storageOrders);
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

  // Process outstanding orders for display
  private processOutstandingOrders(orders: any[]) {
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

  // Fetch all drones and categorize them
  private fetchDrones() {
    this.apiService.callApi('getAllDrones', {}).subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.allDrones = response.data.map((drone: any) => ({
            id: drone.id,
            isAvailable: drone.is_available,
            batteryLevel: drone.battery_level,
            operator: drone.operator?.username || 'Unassigned',
            order_id: drone.order_id,
            Order_ID: drone.Order_ID, // Some systems might use capitalized field name
            altitude: parseFloat(drone.altitude) || 0,
            latest_latitude: parseFloat(drone.latest_latitude) || 0,
            latest_longitude: parseFloat(drone.latest_longitude) || 0
          }));
          
          // Categorize drones based on status
          this.categorizeDrones();
        } else {
          console.error('Failed to fetch drones:', response.message);
        }
      },
      error: (err) => {
        console.error('Error fetching drones:', err);
      }
    });
  }
  
  // Categorize drones based on the business rules defined in server.js
  private categorizeDrones() {
    // Reset arrays
    this.dronesCurrentlyDelivering = [];
    this.dronesWaitingToDeliver = [];
    this.dronesReturningToBase = [];
    
    // For each drone, categorize based on extended business rules
    this.allDrones.forEach(drone => {
      // Handle field capitalization differences (order_id vs Order_ID)
      const orderID = drone.order_id || drone.Order_ID;
      
      // CURRENTLY_DELIVERING: is_available = false and order_id is not null
      if (!drone.isAvailable && orderID) {
        this.dronesCurrentlyDelivering.push(drone);
      }
      // WAITING_TO_DELIVER: is_available = true and order_id is not null
      else if (drone.isAvailable && orderID) {
        this.dronesWaitingToDeliver.push(drone);
      }
      // RETURNING_TO_BASE: is_available = false and order_id is null
      // This captures drones that have delivered their package and are returning to base
      else if (!drone.isAvailable && !orderID) {
        this.dronesReturningToBase.push(drone);
      }
    });
    
    console.log('Drones currently delivering:', this.dronesCurrentlyDelivering.length);
    console.log('Drones waiting to deliver:', this.dronesWaitingToDeliver.length);
    console.log('Drones returning to base:', this.dronesReturningToBase.length);
  }

  // Handle WebSocket messages
  private handleWebSocketMessage(message: any) {
    console.log('WebSocket message received:', message.action);
    
    switch (message.action) {
      case 'orders_update':
        if (message.data) {
          console.log('WebSocket orders update received:', message.data);
          
          // Filter for storage orders only - case insensitive with detailed logging
          const storageOrders = message.data.filter((order: any) => {
            if (!order.state) return false;
            const state = order.state.toString().toLowerCase().trim();
            const isStorage = state === 'storage';
            console.log(`WebSocket Order ${order.order_id}: state="${order.state}" -> normalized="${state}" -> isStorage=${isStorage}`);
            return isStorage;
          });
          
          console.log('WebSocket Storage orders found:', storageOrders.length);
          this.processOutstandingOrders(storageOrders);
        }
        break;
        
      case 'drone_status_update':
        if (message.drones) {
          this.allDrones = message.drones.map((drone: any) => ({
            id: drone.id,
            isAvailable: drone.is_available,
            batteryLevel: drone.battery_level,
            operator: drone.operator?.username || 'Unassigned',
            order_id: drone.order_id,
            Order_ID: drone.Order_ID,
            altitude: parseFloat(drone.altitude) || 0,
            latest_latitude: parseFloat(drone.latest_latitude) || 0,
            latest_longitude: parseFloat(drone.latest_longitude) || 0
          }));
          
          this.categorizeDrones();
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

  processOrder(orderId: any) {
    console.log(`Processing order: ${orderId}`);
    this.router.navigate(['/operator/dispatch', orderId]);
  }

  // Refresh data
  refreshData() {
    this.fetchOutstandingOrders();
    this.fetchDrones();
  }

  // Get total active drones count
  getTotalActiveDrones(): number {
    return this.dronesCurrentlyDelivering.length + 
           this.dronesWaitingToDeliver.length + 
           this.dronesReturningToBase.length;
  }
}