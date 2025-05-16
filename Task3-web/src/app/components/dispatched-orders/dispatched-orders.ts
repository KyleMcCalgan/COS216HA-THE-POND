import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

interface Drone {
  id: number;
  isAvailable: boolean;
  batteryLevel: number;
  operator: string;
  order_id?: number | null;
  Order_ID?: number | null;
  altitude: number;
  latest_latitude: number;
  latest_longitude: number;
}

interface Order {
  orderId: number;
  orderIdStr: string;
  products: string[];
  status: string;
  destination: string;
  customer: string;
  customerId: number;
  trackingNum: string;
  droneId: number;
  droneStatus: 'waiting' | 'delivering'; // Added to track drone status
}

@Component({
  selector: 'app-dispatched-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dispatched-orders.html',
  styleUrls: ['./dispatched-orders.css']
})
export class DispatchedOrders implements OnInit {
  // Arrays for different order states
  waitingOrders: Order[] = [];
  deliveringOrders: Order[] = [];
  filteredOrders: Order[] = []; // Orders displayed based on current filter
  
  // UI state
  loading = true;
  error = '';
  currentFilter = 'all'; // 'all', 'waiting', 'delivering'
  
  // Store drone and order info
  allDrones: Drone[] = [];
  allOrders: any[] = [];

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    // Fetch both drones and orders, then process them together
    this.fetchData();
  }

  // Fetch all necessary data
  private fetchData() {
    this.loading = true;
    this.error = '';
    
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // First, fetch all drones
    this.apiService.callApi('getAllDrones', {}).subscribe({
      next: (droneResponse: any) => {
        if (droneResponse.success && droneResponse.data) {
          console.log('Drones data:', droneResponse.data);
          this.allDrones = this.processDroneData(droneResponse.data);
          
          // After getting drones, fetch all orders
          this.apiService.callApi('getAllOrders', {
            user_id: currentUser.id || 1,
            user_type: currentUser.type || 'Courier'
          }).subscribe({
            next: (orderResponse: any) => {
              this.loading = false;
              
              if (orderResponse.success && orderResponse.data) {
                console.log('Orders data:', orderResponse.data);
                this.allOrders = orderResponse.data;
                
                // Process and match orders with drones
                this.processOrdersAndDrones();
                
                // Apply initial filter
                this.filterOrders(this.currentFilter);
              } else {
                this.error = orderResponse.message || 'Failed to load orders';
                console.error('Failed to load orders:', orderResponse.message);
              }
            },
            error: (err) => {
              this.loading = false;
              this.error = 'Error connecting to the server';
              console.error('Error fetching orders:', err);
            }
          });
        } else {
          this.loading = false;
          this.error = droneResponse.message || 'Failed to load drones';
          console.error('Failed to load drones:', droneResponse.message);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error connecting to the server';
        console.error('Error fetching drones:', err);
      }
    });
  }
  
  // Process drone data into a structured format
  private processDroneData(drones: any[]): Drone[] {
    return drones.map(drone => {
      // Handle order_id field with consideration for different property names
      let orderId = null;
      if (drone.order_id !== undefined) {
        orderId = drone.order_id;
      } else if (drone.Order_ID !== undefined) {
        orderId = drone.Order_ID;
      }
      
      // Parse values and ensure correct types
      return {
        id: parseInt(drone.id),
        isAvailable: drone.is_available === true,
        batteryLevel: parseInt(drone.battery_level) || 0,
        operator: drone.operator?.username || 'Unassigned',
        order_id: orderId !== null ? parseInt(orderId) : null,
        Order_ID: orderId !== null ? parseInt(orderId) : null,
        altitude: parseFloat(drone.altitude) || 0,
        latest_latitude: parseFloat(drone.latest_latitude) || 0,
        latest_longitude: parseFloat(drone.latest_longitude) || 0
      };
    });
  }

  // Match orders with drones and categorize them
  private processOrdersAndDrones() {
    // Reset arrays
    this.waitingOrders = [];
    this.deliveringOrders = [];
    
    // Debug logs
    console.log(`Processing ${this.allDrones.length} drones and ${this.allOrders.length} orders`);
    
    // Log the drones with their order IDs for debugging
    this.allDrones.forEach(drone => {
      const orderId = drone.order_id || drone.Order_ID;
      console.log(`Drone ${drone.id}: isAvailable=${drone.isAvailable}, order_id=${orderId}`);
    });
    
    // Process each order
    this.allOrders.forEach(order => {
      try {
        // Find if this order is assigned to any drone
        const assignedDrone = this.allDrones.find(drone => {
          const droneOrderId = drone.order_id || drone.Order_ID;
          return droneOrderId !== null && droneOrderId == order.order_id;
        });
        
        // Skip orders without assigned drones
        if (!assignedDrone) {
          console.log(`Order ${order.order_id} is not assigned to any drone`);
          return;
        }
        
        console.log(`Order ${order.order_id} is assigned to drone ${assignedDrone.id} (isAvailable: ${assignedDrone.isAvailable})`);
        
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
        const processedOrder: Order = {
          orderId: order.order_id,
          orderIdStr: String(order.order_id), // For routing
          products: productsList,
          status: order.state,
          destination: formattedAddress,
          customer: order.customer?.username || `Customer #${order.customer_id}`,
          customerId: order.customer_id,
          trackingNum: order.tracking_num || 'Unknown',
          droneId: assignedDrone.id,
          // Categorize based on drone status - using our business logic from the server
          droneStatus: assignedDrone.isAvailable ? 'waiting' : 'delivering'
        };
        
        // Add to appropriate category
        if (processedOrder.droneStatus === 'waiting') {
          this.waitingOrders.push(processedOrder);
        } else {
          this.deliveringOrders.push(processedOrder);
        }
      } catch (error) {
        console.error('Error processing order:', error, order);
      }
    });
    
    console.log(`Processed ${this.waitingOrders.length} waiting orders and ${this.deliveringOrders.length} delivering orders`);
  }

  // Apply filter to orders
  filterOrders(filter: string) {
    this.currentFilter = filter;
    
    switch (filter) {
      case 'waiting':
        this.filteredOrders = [...this.waitingOrders];
        break;
      case 'delivering':
        this.filteredOrders = [...this.deliveringOrders];
        break;
      case 'all':
      default:
        // Combine both lists
        this.filteredOrders = [...this.waitingOrders, ...this.deliveringOrders];
        break;
    }
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
    this.fetchData();
  }

  // Get product names as a string for display
  getProductNames(products: string[]): string {
    return products.join(', ');
  }
}