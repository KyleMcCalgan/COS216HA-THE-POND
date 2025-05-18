import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface Drone {
  id: number;
  isAvailable: boolean;
  batteryLevel: number;
  operator: string;
  latest_latitude: number;
  latest_longitude: number;
  altitude: number;
}

interface OrderDetails {
  orderId: string;
  products: string[];
  status: string;
  customer: string;
  customerId: number;
  trackingNum: string;
  destination: { latitude: number; longitude: number };
}

@Component({
  selector: 'app-dispatch',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dispatch.html',
  styleUrls: ['./dispatch.css']
})
export class Dispatch implements OnInit {
  orderId: string | null = null;
  orderCustomerId: number | null = null;
  orderDetails: OrderDetails | null = null;
  availableDrones: Drone[] = [];
  selectedDroneId: number | null = null;
  isProcessing = false;
  error = '';
  isLoading = true;
  
  // HQ coordinates (as defined in server)
  private readonly HQ_LATITUDE = 25.7472;
  private readonly HQ_LONGITUDE = 28.2511;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    // Get order ID from route parameters
    this.orderId = this.route.snapshot.paramMap.get('orderId');
    if (!this.orderId) {
      this.isLoading = false;
      this.error = 'Order ID is missing from the URL.';
      return;
    }
    
    console.log(`Initializing dispatch page for order ID: ${this.orderId}`);
    
    // Load order details directly using getOrder API
    this.loadOrderDetails();
  }

  // Load order details using the getOrder API
  private loadOrderDetails() {
    this.isLoading = true;
    
    // Use getOrder API directly since it works correctly
    this.apiService.callApi('getOrder', {
      order_id: parseInt(this.orderId!),
      user_id: 1,  // Use courier user ID 
      user_type: 'Courier'
    }).subscribe({
      next: (response: any) => {
        console.log('getOrder API response:', response);
        
        if (response.success && response.data) {
          console.log('Order found:', response.data);
          
          // Process the order details
          this.processOrderDetails(response.data);
          
          // Also load available drones
          this.loadAvailableDrones();
        } else {
          this.isLoading = false;
          this.error = response.message || `Order with ID ${this.orderId} not found.`;
          console.error('Failed to load order:', response.message);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.error = 'Error loading order: ' + (err.message || 'Unknown error');
        console.error('Error loading order:', err);
      }
    });
  }

  // Process order details from the order data
  private processOrderDetails(orderData: any) {
    // Format products list
    const productsList = this.formatProductsList(orderData.products);
    
    // Create order details object
    this.orderDetails = {
      orderId: this.orderId || '0',
      products: productsList,
      status: orderData.state || 'Unknown',
      customer: orderData.customer?.username || `Customer #${orderData.customer_id}`,
      customerId: orderData.customer_id,
      trackingNum: orderData.tracking_num || 'Unknown',
      destination: {
        latitude: parseFloat(orderData.destination_latitude) || 0,
        longitude: parseFloat(orderData.destination_longitude) || 0
      }
    };
    
    // Store customer ID for later use
    this.orderCustomerId = orderData.customer_id;
    
    this.isLoading = false;
    console.log('Processed order details:', this.orderDetails);
  }

  // Load available drones
  private loadAvailableDrones() {
    this.apiService.callApi('getAllDrones', {}).subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          console.log('All drones response:', response.data);
          
          // Filter drones to get only available ones (is_available = true and no order assigned)
          const availableDrones = response.data.filter((drone: any) => {
            const isAvailable = drone.is_available === true;
            
            // Check for both order_id and Order_ID fields being null/undefined
            let hasNoOrder = true;
            if (drone.order_id !== null && drone.order_id !== undefined) {
              hasNoOrder = false;
            }
            if (drone.Order_ID !== null && drone.Order_ID !== undefined) {
              hasNoOrder = false;
            }
            
            return isAvailable && hasNoOrder;
          });
          
          console.log('Available drones:', availableDrones);
          
          // Map drone data to our interface
          this.availableDrones = availableDrones.map((drone: any) => ({
            id: parseInt(drone.id),
            isAvailable: drone.is_available === true,
            batteryLevel: parseInt(drone.battery_level) || 0,
            operator: drone.operator?.username || 'Unassigned',
            latest_latitude: parseFloat(drone.latest_latitude) || 0,
            latest_longitude: parseFloat(drone.latest_longitude) || 0,
            altitude: parseFloat(drone.altitude) || 0
          }));
        } else {
          this.error = response.message || 'Failed to load available drones';
          console.error('Failed to load drones:', response.message);
        }
      },
      error: (err) => {
        this.error = 'Error loading drones: ' + (err.message || 'Unknown error');
        console.error('Error loading drones:', err);
      }
    });
  }

  // Format products list
  private formatProductsList(products: any[]): string[] {
    if (!products || !Array.isArray(products)) {
      return ['No products'];
    }
    
    return products.map((p: any) => {
      if (p.title) {
        return `${p.title} (${p.quantity || 1}x)`;
      } else if (p.name) {
        return `${p.name} (${p.quantity || 1}x)`;
      } else {
        return `Product #${p.product_id || p.id || 'Unknown'} (${p.quantity || 1}x)`;
      }
    });
  }

  // Handle drone selection
  selectDrone(droneId: number) {
    this.selectedDroneId = droneId;
    console.log(`Selected drone ID: ${droneId}`);
  }

  // Handle order dispatch
  dispatchOrder() {
    if (!this.selectedDroneId || !this.orderDetails || !this.orderCustomerId) {
      this.error = 'Please select a drone to dispatch the order.';
      return;
    }
    
    this.isProcessing = true;
    this.error = '';
    
    console.log(`Dispatching order ${this.orderId} with drone ${this.selectedDroneId}`);
    
    // 1. First, update the drone to assign the order ID
    this.apiService.callApi('updateDrone', {
      id: this.selectedDroneId,
      order_id: parseInt(this.orderId || '0'),
      latest_latitude: this.HQ_LATITUDE,
      latest_longitude: this.HQ_LONGITUDE,
      altitude: 0  // Ensure drone is on the ground
    }).subscribe({
      next: (droneResponse: any) => {
        if (droneResponse.success) {
          console.log('Drone updated successfully:', droneResponse.data);
          
          // 2. Then update the order state to "Out_for_delivery"
          this.updateOrderStatus();
        } else {
          this.isProcessing = false;
          this.error = droneResponse.message || 'Failed to update drone';
          console.error('Failed to update drone:', droneResponse.message);
        }
      },
      error: (err) => {
        this.isProcessing = false;
        this.error = 'Error updating drone: ' + (err.message || 'Unknown error');
        console.error('Error updating drone:', err);
      }
    });
  }

  // Update order status to "Out_for_delivery"
  private updateOrderStatus() {
    // Make sure we have the customer ID
    if (!this.orderCustomerId) {
      this.isProcessing = false;
      this.error = 'Customer ID not found for this order.';
      return;
    }
    
    // Call the updateOrder API
    this.apiService.callApi('updateOrder', {
      customer_id: this.orderCustomerId,
      order_id: parseInt(this.orderId || '0'),
      state: 'Out_for_delivery'
    }).subscribe({
      next: (orderResponse: any) => {
        this.isProcessing = false;
        
        if (orderResponse.success) {
          console.log('Order status updated successfully:', orderResponse.data);
          
          // Show success message and navigate back to dashboard
          alert(`Order ${this.orderId} has been successfully assigned to Drone ${this.selectedDroneId} and is ready for delivery.`);
          this.router.navigate(['/operator']);
        } else {
          this.error = orderResponse.message || 'Failed to update order status';
          console.error('Failed to update order status:', orderResponse.message);
        }
      },
      error: (err) => {
        this.isProcessing = false;
        this.error = 'Error updating order status: ' + (err.message || 'Unknown error');
        console.error('Error updating order status:', err);
      }
    });
  }

  // Cancel and go back to dashboard
  cancel() {
    this.router.navigate(['/operator']);
  }
}