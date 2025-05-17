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
  droneStatus: 'waiting' | 'delivering' | 'returning'; // Added 'returning' state
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
  returningDrones: Order[] = []; // New array for returning drones with last order info
  filteredOrders: Order[] = []; // Orders displayed based on current filter
  
  // UI state
  loading = true;
  error = '';
  currentFilter = 'all'; // 'all', 'waiting', 'delivering', 'returning'
  
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
    this.returningDrones = [];
    
    // Debug logs
    console.log(`Processing ${this.allDrones.length} drones and ${this.allOrders.length} orders`);
    
    // Log the drones with their order IDs for debugging
    this.allDrones.forEach(drone => {
      const orderId = drone.order_id || drone.Order_ID;
      console.log(`Drone ${drone.id}: isAvailable=${drone.isAvailable}, order_id=${orderId}`);
    });
    
    // First handle drones with assigned orders
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
        
        // Create processed order with formatted data
        const processedOrder = this.createProcessedOrder(order, assignedDrone.id, 
          assignedDrone.isAvailable ? 'waiting' : 'delivering');
        
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
    
    // Now handle drones that are in the RETURNING state (not available and no order ID)
    const returningDrones = this.allDrones.filter(drone => {
      const droneOrderId = drone.order_id || drone.Order_ID;
      return !drone.isAvailable && !droneOrderId;
    });
    
    console.log(`Found ${returningDrones.length} drones returning to base`);
    
    // For returning drones, create entries with their current location
    returningDrones.forEach(drone => {
      // Create a processed order object for returning drone with minimal info
      const returningDroneOrder: Order = {
        orderId: 0, // No real order ID
        orderIdStr: `drone-${drone.id}`, // Use drone ID as identifier for routing
        products: ["Package delivered"],
        status: "Returning to HQ",
        destination: "Headquarters",
        customer: "N/A - Returning",
        customerId: 0,
        trackingNum: `RTN-${drone.id}`,
        droneId: drone.id,
        droneStatus: 'returning'
      };
      
      this.returningDrones.push(returningDroneOrder);
    });
    
    console.log(`Processed ${this.waitingOrders.length} waiting orders, ${this.deliveringOrders.length} delivering orders, and ${this.returningDrones.length} returning drones`);
  }

  // Create a processed order object with all needed fields
  private createProcessedOrder(order: any, droneId: number, status: 'waiting' | 'delivering' | 'returning'): Order {
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
    
    return {
      orderId: order.order_id,
      orderIdStr: String(order.order_id), // For routing
      products: productsList,
      status: order.state,
      destination: formattedAddress,
      customer: order.customer?.username || `Customer #${order.customer_id}`,
      customerId: order.customer_id,
      trackingNum: order.tracking_num || 'Unknown',
      droneId: droneId,
      droneStatus: status
    };
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
      case 'returning':
        this.filteredOrders = [...this.returningDrones];
        break;
      case 'all':
      default:
        // Combine all lists
        this.filteredOrders = [
          ...this.waitingOrders, 
          ...this.deliveringOrders,
          ...this.returningDrones
        ];
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
    
    // Check if this is a returning drone (will start with 'drone-')
    if (orderId.startsWith('drone-')) {
      const droneId = orderId.split('-')[1];
      console.log(`This is a returning drone (ID: ${droneId}). Finding last order...`);
      
      // For returning drones, we need to find a delivered order to track
      // This is a simplification - in a real app, you'd want to track the most recent order
      const deliveredOrders = this.allOrders.filter(order => order.state === 'Delivered');
      let orderToTrack = orderId; // Default to drone ID if no order found
      
      if (deliveredOrders.length > 0) {
        // Just use the first delivered order (in real app, find the actual last order)
        orderToTrack = String(deliveredOrders[0].order_id);
        console.log(`Using order ID ${orderToTrack} for returning drone tracking`);
      }
      
      this.router.navigate(['/operator/track', orderToTrack]);
      return;
    }
    
    // Find the order in our filtered orders
    const order = this.filteredOrders.find(o => o.orderIdStr === orderId);
    
    // If this is a waiting drone (START button was clicked), update the drone status first
    if (order && order.droneStatus === 'waiting') {
      this.updateDroneStatus(order.droneId, false).then(() => {
        this.router.navigate(['/operator/track', orderId]);
      }).catch(error => {
        console.error('Error updating drone status:', error);
        // Navigate anyway, even if there was an error
        this.router.navigate(['/operator/track', orderId]);
      });
    } else {
      // For regular "Track Order" button (already delivering or returning), just navigate
      this.router.navigate(['/operator/track', orderId]);
    }
  }
  
  // Update drone status (available/not available)
  private updateDroneStatus(droneId: number, isAvailable: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      this.apiService.callApi('updateDrone', {
        id: droneId,
        is_available: isAvailable
      }).subscribe({
        next: (response: any) => {
          if (response.success) {
            console.log(`Drone ${droneId} status updated successfully to is_available=${isAvailable}`);
            resolve();
          } else {
            console.error('Failed to update drone status:', response.message);
            reject(response.message);
          }
        },
        error: (err) => {
          console.error('Error updating drone status:', err);
          reject(err);
        }
      });
    });
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