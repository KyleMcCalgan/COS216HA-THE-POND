import { Component, OnInit, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import * as L from 'leaflet';

/**
 * Interface for Order Details
 */
interface OrderDetails {
  products: string[];
  customer: string;
  destination: { latitude: number; longitude: number };
  droneId: number;
  orderId: string | number | null;
  customerId: number;
  trackingNum: string;
}

/**
 * Interface for Drone Details
 */
interface DroneDetails {
  id: number;
  is_available: boolean;
  latest_latitude: number;
  latest_longitude: number;
  altitude: number;
  battery_level: number;
  current_operator_id: number | null;
  order_id: number | null;
}

// Define drone state types
type DroneState = 'waiting' | 'delivering' | 'returning' | 'delivered' | 'completed' | 'dead';

@Component({
  selector: 'app-track',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './track.html',
  styleUrls: ['./track.css']
})
export class Track implements OnInit, AfterViewInit, OnDestroy {
  //---------------------------------------------------
  // PROPERTIES
  //---------------------------------------------------
  droneId: string | null = null;
  orderDetails: OrderDetails | null = null;
  droneDetails: DroneDetails | null = null;
  droneState: DroneState = 'delivering'; // Default state
  private map: L.Map | null = null;
  private droneMarker: L.Marker | null = null;
  private destinationMarker: L.Marker | null = null;
  private isLoading: boolean = true;
  private keyboardEnabled: boolean = false;
  private mapInitialized: boolean = false;
  private updateInterval: any = null;
  private batteryDepletionInterval: any = null;
  private errorMessage: string | null = null;
  private isDroneDead: boolean = false; // Track if drone has died
  private dustDevils: L.Circle[] = [];
  private dustDevilPositions: L.LatLngExpression[] = [];
  private lastDronePosition: L.LatLngExpression | null = null;
  private dustDevilSpawnInterval: any = null;

  // Location coordinates
  //---------------------------------------------------
  // Headquarters coordinates
  HQlat: number = -25.7472;
  HQlng: number = 28.2511;
  private HQCoordinates: L.LatLngExpression = [this.HQlat, this.HQlng];

  // Drone coordinates (will be updated from API)
  private droneCoordinates: L.LatLngExpression = [this.HQlat, this.HQlng];

  // Movement increment for WASD keys
  private readonly MOVEMENT_INCREMENT: number = 0.0001; // ~11 meters
  private readonly OPERATIONAL_RADIUS: number = 5000; // 5km in meters
  private readonly BATTERY_DEPLETION_INTERVAL_MS: number = 6000; // 6 seconds per 1% depletion

  //---------------------------------------------------
  // CONSTRUCTOR & LIFECYCLE HOOKS
  //---------------------------------------------------
  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private apiService: ApiService
  ) {}

  /**
   * Initialize the component properties
   */
ngOnInit() {
  // Get drone ID from route parameters (could be order_id for backward compatibility)
  const routeParam = this.route.snapshot.paramMap.get('orderId');
  
  if (!routeParam) {
    this.errorMessage = 'No drone/order ID provided';
    console.error(this.errorMessage);
    return;
  }

  // Check if this is a drone ID (starts with 'drone-') or a regular order ID
  if (routeParam.startsWith('drone-')) {
    this.droneId = routeParam.split('-')[1];
    console.log(`Tracking drone ID: ${this.droneId}`);
  } else {
    // For backward compatibility, if it's a regular number, treat it as order ID
    console.log(`Tracking by order ID (legacy): ${routeParam}`);
    this.findDroneByOrderId(routeParam);
    return;
  }

  console.log(`HQ coordinates: (${this.HQlat}, ${this.HQlng})`);
  console.log(`Fetching data for drone ID: ${this.droneId}`);
  
  this.loadDroneAndOrderData();
  
  // Set up automatic refreshing
  this.updateInterval = setInterval(() => {
    this.fetchDroneData();
  }, 10000); // Refresh drone data every 10 seconds

  // Spawn dust devils after map is initialized and then every minute
  setTimeout(() => {
    if (this.mapInitialized) {
      this.spawnDustDevils();
    }
    
    // Set up interval to spawn new dust devils every minute
    this.dustDevilSpawnInterval = setInterval(() => {
      if (this.mapInitialized && this.map) {
        this.spawnDustDevils();
      }
    }, 60000); // 60 seconds = 1 minute
  }, 3000); // Wait 3 seconds to ensure map is fully initialized
}

  /**
   * Find drone by order ID (for backward compatibility)
   */
  private findDroneByOrderId(orderId: string) {
    this.apiService.callApi('getAllDrones', {}).subscribe({
      next: (dronesResponse: any) => {
        if (dronesResponse.success && dronesResponse.data) {
          const foundDrone = dronesResponse.data.find((drone: any) => {
            const droneOrderId = drone.order_id || drone.Order_ID;
            return droneOrderId == orderId;
          });
          
          if (foundDrone) {
            this.droneId = foundDrone.id.toString();
            this.loadDroneAndOrderData();
            
            // Set up automatic refreshing
            this.updateInterval = setInterval(() => {
              this.fetchDroneData();
            }, 10000);
          } else {
            this.errorMessage = `No drone found for order ID ${orderId}`;
            console.error(this.errorMessage);
            this.isLoading = false;
          }
        } else {
          this.errorMessage = 'Failed to load drones: ' + (dronesResponse.message || 'Unknown error');
          console.error(this.errorMessage);
          this.isLoading = false;
        }
      },
      error: (err) => {
        this.errorMessage = 'Error loading drones: ' + err.message;
        console.error('Error loading drones:', err);
        this.isLoading = false;
      }
    });
  }

  /**
   * Fetch drone and order data from API
   */
  private loadDroneAndOrderData() {
    if (!this.droneId) {
      this.errorMessage = 'No drone ID available';
      this.isLoading = false;
      return;
    }

    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // First, get all drones to find our specific drone
    this.apiService.callApi('getAllDrones', {}).subscribe({
      next: (dronesResponse: any) => {
        if (dronesResponse.success && dronesResponse.data) {
          console.log('All drones response:', dronesResponse.data);
          
          // Find the specific drone by ID
          const foundDrone = dronesResponse.data.find((drone: any) => 
            drone.id == this.droneId
          );
          
          if (foundDrone) {
            console.log('Found drone:', foundDrone);
            this.processDroneDetails(foundDrone);
            
            // If the drone has an order ID, fetch the order details
            const droneOrderId = foundDrone.order_id || foundDrone.Order_ID;
            if (droneOrderId) {
              this.fetchOrderData(droneOrderId);
            } else {
              // No order ID - this is a returning drone or completed drone
              console.log('Drone has no order ID - likely returning or completed');
              this.createDummyOrderDetails();
              this.isLoading = false;
            }
          } else {
            this.errorMessage = `Drone with ID ${this.droneId} not found`;
            console.error(this.errorMessage);
            this.isLoading = false;
          }
        } else {
          this.errorMessage = 'Failed to load drones: ' + (dronesResponse.message || 'Unknown error');
          console.error(this.errorMessage);
          this.isLoading = false;
        }
      },
      error: (err) => {
        this.errorMessage = 'Error loading drones: ' + err.message;
        console.error('Error loading drones:', err);
        this.isLoading = false;
      }
    });
  }

  /**
   * Process drone details from API data
   */
 private processDroneDetails(droneData: any) {
  // Convert latitude to negative for southern hemisphere
  const rawLatitude = parseFloat(droneData.latest_latitude) || 0;
  const adjustedLatitude = rawLatitude > 0 ? -rawLatitude : rawLatitude;
  
  this.droneDetails = {
    id: parseInt(droneData.id),
    is_available: droneData.is_available === true,
    latest_latitude: adjustedLatitude,
    latest_longitude: parseFloat(droneData.latest_longitude) || 0,
    altitude: parseFloat(droneData.altitude) || 20,
    battery_level: parseInt(droneData.battery_level) || 100,
    current_operator_id: droneData.current_operator_id,
    order_id: droneData.order_id || droneData.Order_ID
  };
  
  console.log('Processed drone details with adjusted latitude:', this.droneDetails);
  
  // Check altitude limit first (this is the new check)
  this.checkAltitudeLimit();
  
  // Only continue with other checks if drone hasn't violated altitude limit
  if (!this.isDroneDead) {
    // Check if drone is dead (battery 0 and altitude > 30) - your existing logic
    this.checkDroneHealth();
    
    // Start battery depletion if the drone is in use and not dead
    if (!this.isDroneDead) {
      this.startBatteryDepletion();
    }
    
    // Determine drone state
    this.determineDroneState();
    
    // Update drone coordinates
    this.updateDroneCoordinates();
    
    // Update or initialize the map with drone marker
    this.updateMapWithDronePosition();
    
    // Enable keyboard controls if appropriate
    this.keyboardEnabled = !this.isDroneDead && 
      (this.droneState === 'delivering' || this.droneState === 'returning');
  }
}

  /**
   * Fetch order data by order ID
   */
  private fetchOrderData(orderId: number) {
    this.apiService.callApi('getOrder', {
      order_id: orderId,
      user_id: 1,
      user_type: 'Courier'
    }).subscribe({
      next: (orderResponse: any) => {
        this.isLoading = false;
        
        if (orderResponse.success && orderResponse.data) {
          console.log('Found order:', orderResponse.data);
          this.processOrderDetails(orderResponse.data);
        } else {
          console.log('Order not found, creating default order details');
          this.createDummyOrderDetails();
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.log('Error fetching order, creating default order details:', err);
        this.createDummyOrderDetails();
      }
    });
  }

  /**
   * Process order details from API data
   */
  private processOrderDetails(orderData: any) {
    // Format products list
    let productsList: string[] = [];
    if (orderData.products && Array.isArray(orderData.products)) {
      productsList = orderData.products.map((p: any) => {
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
    
    // Convert latitude to negative for southern hemisphere
    const rawLatitude = parseFloat(orderData.destination_latitude) || 0;
    const adjustedLatitude = rawLatitude > 0 ? -rawLatitude : rawLatitude;
    
    // Create order details object
    this.orderDetails = {
      orderId: orderData.order_id || null,
      products: productsList,
      customer: orderData.customer?.username || `Customer #${orderData.customer_id}`,
      customerId: orderData.customer_id,
      trackingNum: orderData.tracking_num || 'Unknown',
      destination: {
        latitude: adjustedLatitude,
        longitude: parseFloat(orderData.destination_longitude) || 0
      },
      droneId: this.droneDetails ? this.droneDetails.id : parseInt(this.droneId || '0')
    };
    
    console.log('Processed order details with adjusted latitude:', this.orderDetails);
  }

  /**
   * Create dummy order details for drones without orders (returning/completed)
   */
  private createDummyOrderDetails() {
    // For returning drones, we'll create placeholder order details
    this.orderDetails = {
      orderId: null,
      products: ['Recently delivered package'],
      customer: 'Recently served customer',
      customerId: 0,
      trackingNum: `RTN-${this.droneId}`,
      destination: {
        latitude: this.HQlat,
        longitude: this.HQlng
      },
      droneId: this.droneDetails ? this.droneDetails.id : parseInt(this.droneId || '0')
    };
    
    console.log('Created dummy order details for returning drone:', this.orderDetails);
  }

  /**
   * Fetch drones data from API (for periodic updates)
   */
  private fetchDroneData() {
    if (!this.droneId) return;
    
    this.apiService.callApi('getAllDrones', {}).subscribe({
      next: (dronesResponse: any) => {
        if (dronesResponse.success && dronesResponse.data) {
          const foundDrone = dronesResponse.data.find((drone: any) => 
            drone.id == this.droneId
          );
          
          if (foundDrone) {
            this.processDroneDetails(foundDrone);
          }
        }
      },
      error: (err) => {
        console.error('Error fetching drone data:', err);
      }
    });
  }

  // ... (rest of the methods remain the same: checkDroneHealth, startBatteryDepletion, etc.)
  
  /**
   * Check if the drone is dead based on battery and altitude
   */
  private checkDroneHealth() {
    if (!this.droneDetails) return;
    
    // Check if drone is dead (battery 0 and altitude > 30)
    const isDead = this.droneDetails.battery_level <= 0 && this.droneDetails.altitude > 30;
    
    if (isDead && !this.isDroneDead) {
      this.isDroneDead = true;
      this.droneState = 'dead';
      this.keyboardEnabled = false;
      
      // Clear any existing intervals
      if (this.batteryDepletionInterval) {
        clearInterval(this.batteryDepletionInterval);
        this.batteryDepletionInterval = null;
      }
      
      console.log('Drone is dead - initiating death sequence');
      this.handleDroneDeath();
    }
  }

  /**
   * Handle drone death sequence
   */
  private handleDroneDeath() {
    if (!this.droneDetails || !this.orderDetails) return;
    
    // Show alert about drone death
    window.alert(`⚠️ DRONE MALFUNCTION ⚠️\n\nDrone #${this.droneDetails.id} has suffered a critical failure!\nBattery depleted and altitude exceeded safe limits.\n\nThe order will be returned to storage for reassignment.`);
    
    // Only update order if there was actually an order
    if (this.orderDetails.orderId) {
      // Step 1: Update the order back to storage state
      this.apiService.callApi('updateOrder', {
        customer_id: this.orderDetails.customerId,
        order_id: this.orderDetails.orderId,
        state: 'Storage'
      }).subscribe({
        next: (orderResponse: any) => {
          if (orderResponse.success) {
            console.log('Order returned to storage successfully:', orderResponse.data);
          } else {
            console.error('Failed to return order to storage:', orderResponse.message);
          }
        },
        error: (err) => {
          console.error('Error returning order to storage:', err);
        }
      });
    }
    
    // Step 2: Update drone to dead state
    this.apiService.callApi('updateDrone', {
      id: this.droneDetails.id,
      battery_level: 0,
      is_available: false,
      order_id: null,
      altitude: 0,
      latest_latitude: -this.droneDetails.latest_latitude, // Convert to positive for API
      latest_longitude: this.droneDetails.latest_longitude
    }).subscribe({
      next: (droneResponse: any) => {
        if (droneResponse.success) {
          console.log('Drone updated to dead state successfully:', droneResponse.data);
          
          // Update local drone details
          this.droneDetails!.battery_level = 0;
          this.droneDetails!.is_available = false;
          this.droneDetails!.order_id = null;
          this.droneDetails!.altitude = 0;
          
          // Update map to show drone at ground level (crashed)
          this.updateDronePosition();
          
          // Disable all further operations
          this.keyboardEnabled = false;
          
          // Clear all intervals
          if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
          }
          
          // Set error message to indicate drone is dead
          this.errorMessage = 'Drone has crashed and is no longer operational.';
          
        } else {
          console.error('Failed to update drone to dead state:', droneResponse.message);
        }
      },
      error: (err) => {
        console.error('Error updating drone to dead state:', err);
      }
    });
  }

  /**
   * Start or restart the battery depletion timer
   */
  private startBatteryDepletion() {
    if (this.batteryDepletionInterval) {
      clearInterval(this.batteryDepletionInterval);
    }
    
    // Only start battery depletion if drone is not dead and is actively being used
    if (this.droneDetails && !this.isDroneDead && (this.droneState === 'delivering' || this.droneState === 'returning')) {
      this.batteryDepletionInterval = setInterval(() => {
        if (this.droneDetails && this.droneDetails.battery_level > 0 && !this.isDroneDead) {
          this.droneDetails.battery_level -= 1;
          
          // Check if battery reached 0
          if (this.droneDetails.battery_level <= 0) {
            this.droneDetails.battery_level = 0;
            
            // Set altitude to a high value to trigger death condition
            this.droneDetails.altitude = 35; // Above 30m threshold
            
            // Check drone health which will trigger death sequence
            this.checkDroneHealth();
            
            // Update drone in database immediately
            this.updateDroneInDatabase(this.droneDetails.latest_latitude, this.droneDetails.latest_longitude);
            
            console.warn('Drone battery depleted! Initiating emergency landing...');
          } else {
            // Regular battery update
            this.updateDroneInDatabase(this.droneDetails.latest_latitude, this.droneDetails.latest_longitude);
          }
        }
      }, this.BATTERY_DEPLETION_INTERVAL_MS);
    }
  }

  /**
   * Determine the drone's state based on its properties
   */
  private determineDroneState() {
    if (!this.droneDetails || !this.orderDetails) return;
    
    // Check if drone is dead first
    if (this.isDroneDead) {
      this.droneState = 'dead';
      return;
    }
    
    const isDroneAssignedToOrder = this.droneDetails.order_id != null;
    const isDroneAvailable = this.droneDetails.is_available;
    
    // Check if the drone is at the destination (only if we have a real destination)
    const isAtDestination = this.orderDetails.orderId ? 
      this.isAtDestination(
        this.droneDetails.latest_latitude, 
        this.droneDetails.latest_longitude,
        this.orderDetails.destination.latitude,
        this.orderDetails.destination.longitude
      ) : false;
    
    // Check if the drone is at HQ
    const isAtHQ = this.isAtHQ(
      this.droneDetails.latest_latitude, 
      this.droneDetails.latest_longitude
    );
    
    console.log(`State determination: isDroneAssignedToOrder=${isDroneAssignedToOrder}, isDroneAvailable=${isDroneAvailable}, isAtDestination=${isAtDestination}, isAtHQ=${isAtHQ}`);
    
    // Determine the state based on multiple factors
    if (isAtHQ && !isDroneAssignedToOrder) {
      // Drone is at HQ with no order -> completed
      this.droneState = 'completed';
      this.keyboardEnabled = false;
      if (this.batteryDepletionInterval) {
        clearInterval(this.batteryDepletionInterval);
      }
    } else if (!isDroneAssignedToOrder && !isDroneAvailable && this.orderDetails.orderId && isAtDestination) {
      // Drone is at destination, no order, not available -> delivered (but only if we had a real order)
      this.droneState = 'delivered';
      this.keyboardEnabled = true;
      this.startBatteryDepletion();
    } else if (!isDroneAssignedToOrder && !isDroneAvailable && !isAtHQ) {
      // Drone has no order, not available, not at HQ -> returning
      this.droneState = 'returning';
      this.keyboardEnabled = true;
      this.startBatteryDepletion();
    } else if (isDroneAssignedToOrder && !isDroneAvailable) {
      // Drone has an order and is not available -> delivering
      this.droneState = 'delivering';
      this.keyboardEnabled = true;
      this.startBatteryDepletion();
    } else if (isDroneAssignedToOrder && isDroneAvailable) {
      // Drone has an order but is available -> waiting
      this.droneState = 'waiting';
      this.keyboardEnabled = false;
      if (this.batteryDepletionInterval) {
        clearInterval(this.batteryDepletionInterval);
      }
    } else {
      // Unexpected state
      this.droneState = 'waiting';
      this.keyboardEnabled = false;
      if (this.batteryDepletionInterval) {
        clearInterval(this.batteryDepletionInterval);
      }
      this.errorMessage = 'Unexpected drone state detected';
      console.error(this.errorMessage);
    }
    
    console.log(`Drone state determined: ${this.droneState}, keyboard enabled: ${this.keyboardEnabled}`);
  }

  /**
   * Check if drone is at the destination (within tolerance)
   */
  private isAtDestination(droneLat: number, droneLong: number, destLat: number, destLong: number): boolean {
    const tolerance = 0.0001; // ~11 meters
    return Math.abs(droneLat - destLat) < tolerance && Math.abs(droneLong - destLong) < tolerance;
  }

  /**
   * Check if drone is at HQ (within tolerance)
   */
  private isAtHQ(droneLat: number, droneLong: number): boolean {
    const tolerance = 0.0001; // ~11 meters
    console.log(`Checking if drone at HQ: Drone(${droneLat}, ${droneLong}) vs HQ(${this.HQlat}, ${this.HQlng})`);
    console.log(`Distance: lat=${Math.abs(droneLat - this.HQlat)}, lng=${Math.abs(droneLong - this.HQlng)}`);
    return Math.abs(droneLat - this.HQlat) < tolerance && Math.abs(droneLong - this.HQlng) < tolerance;
  }

  /**
   * Calculate distance between two points in meters using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Get the appropriate label text for the current drone state
   */
  getStateLabelText(): string {
    switch (this.droneState) {
      case 'waiting': return 'WAITING TO START';
      case 'delivering': return 'DELIVERING';
      case 'returning': return 'RETURNING TO BASE';
      case 'delivered': return 'DELIVERED';
      case 'completed': return 'COMPLETED';
      case 'dead': return 'DRONE CRASHED';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Get the appropriate message text for the current drone state
   */
  getStateMessageText(): string {
    switch (this.droneState) {
      case 'waiting': return 'Drone is waiting to start the delivery mission.';
      case 'delivering': return 'Drone is on its way to the delivery destination. Use WASD keys to navigate.';
      case 'returning': return 'Drone has completed the delivery and is returning to base. Use WASD keys to navigate.';
      case 'delivered': return 'Drone has arrived at the delivery destination. Preparing to return to base.';
      case 'completed': return 'Drone has returned to base and completed the mission.';
      case 'dead': return 'Drone has crashed due to battery failure.';
      default: return '';
    }
  }

  /**
   * Get an estimated time text based on drone state
   */
  getEstimatedTimeText(): string {
    switch (this.droneState) {
      case 'waiting': return 'Not yet started';
      case 'delivering': return 'Approximately 5-10 minutes';
      case 'returning': return 'Returning to headquarters';
      case 'delivered': return 'Package has been delivered';
      case 'completed': return 'Mission completed';
      case 'dead': return 'Mission failed - drone crashed';
      default: return 'Unknown';
    }
  }

  /**
   * Update drone coordinates from API data
   */
  private updateDroneCoordinates(): void {
    if (this.droneDetails) {
      this.droneCoordinates = [
        this.droneDetails.latest_latitude,
        this.droneDetails.latest_longitude
      ];
      console.log(`Updated drone coordinates to: ${this.droneCoordinates}`);
    }
  }

  /**
   * Updates the map with drone position or initializes it if not yet created
   */
  private updateMapWithDronePosition(): void {
    if (this.mapInitialized && this.map) {
      this.updateDronePosition();
    } else {
      console.log('Map not initialized yet, drone position will be updated after map initialization');
    }
  }

  /**
   * Initialize map after view has been initialized
   */
  ngAfterViewInit() {
    console.log('AfterViewInit - initializing map');
    setTimeout(() => {
      this.initMap();
    }, 100); // Short delay to ensure DOM is ready
  }

/**
 * Clean up resources when component is destroyed
 */
ngOnDestroy() {
  this.keyboardEnabled = false;
  if (this.updateInterval) {
    clearInterval(this.updateInterval);
  }
  if (this.batteryDepletionInterval) {
    clearInterval(this.batteryDepletionInterval);
  }
  if (this.dustDevilSpawnInterval) {
    clearInterval(this.dustDevilSpawnInterval);
  }
  
  // Clear dust devils before destroying the map
  this.clearDustDevils();
  
  if (this.map) {
    this.map.remove();
    this.map = null;
  }
}

  //---------------------------------------------------
  // MAP INITIALIZATION
  //---------------------------------------------------
  private initMap(): void {
  try {
    console.log('Initializing map');
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      this.errorMessage = 'Map container element not found';
      console.error(this.errorMessage);
      return;
    }
    
    console.log('Map container found, creating Leaflet map');
    this.map = L.map('map').setView(this.HQCoordinates, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.addHeadquartersMarker();
    this.addOperationalRadiusCircle();
    if (this.orderDetails && this.orderDetails.destination && this.orderDetails.orderId) {
      this.addDestinationMarker();
    }
    if (this.droneDetails) {
      this.addDroneMarker();
    }
    
    this.mapInitialized = true;
    console.log('Map initialization complete');
    
    // Spawn initial dust devils after a short delay
    setTimeout(() => {
      this.spawnDustDevils();
    }, 1000);
    
  } catch (error) {
    this.errorMessage = 'Error initializing map: ' + error;
    console.error('Error initializing map:', error);
  }
}

  /**
   * Add headquarters marker with a visible red square
   */
  private addHeadquartersMarker(): void {
    if (!this.map) return;
    try {
      const hqLatLng = [this.HQlat, this.HQlng];
      console.log(`Adding HQ marker at coordinates: ${hqLatLng}`);
      const customHQIcon = L.divIcon({
        className: 'custom-hq-marker',
        html: '<div style="background-color: blue; width: 20px; height: 20px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      
      L.marker(hqLatLng as L.LatLngExpression, { icon: customHQIcon })
        .addTo(this.map)
        .bindPopup('Headquarters');
      
      L.circle(hqLatLng as L.LatLngExpression, {
        radius: 200,
        color: '#2b4de3',
        fillColor: '#129bc4',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(this.map);
      
      console.log('HQ marker (red square) and circle added');
    } catch (error) {
      console.error('Error adding headquarters marker:', error);
    }
  }

  /**
   * Add 5km operational radius circle around HQ
   */
  private addOperationalRadiusCircle(): void {
    if (!this.map) return;
    try {
      console.log(`Adding operational radius circle at: ${this.HQCoordinates}`);
      L.circle(this.HQCoordinates, {
        radius: this.OPERATIONAL_RADIUS,
        color: '#3E1314',
        weight: 2,
        fill: false,
        dashArray: '5, 10'
      }).addTo(this.map);
      console.log('Operational radius circle added');
    } catch (error) {
      console.error('Error adding operational radius circle:', error);
    }
  }

  /**
   * Add drone marker to the map
   */
  private addDroneMarker(): void {
    if (!this.map) return;
    try {
      let droneIcon: L.Icon | L.DivIcon;
      
      // Use different icon based on drone state
      if (this.droneState === 'dead') {
        // Red X for crashed drone
        droneIcon = L.divIcon({
          className: 'crashed-drone-marker',
          html: '<div style="background-color: #dc3545; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">✕</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
      } else {
        // Try to use custom drone image, fallback to icon if image fails
        try {
          droneIcon = L.icon({
            iconUrl: 'assets/drone-icon.png',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
          });
        } catch (e) {
          console.warn('Drone icon not found, using default marker:', e);
          droneIcon = new L.Icon.Default();
        }
      }
      
      const popupText = this.droneState === 'dead' 
        ? `Drone ID: ${this.droneDetails?.id || 'Unknown'} - CRASHED`
        : `Drone ID: ${this.droneDetails?.id || 'Unknown'}`;
      
      this.droneMarker = L.marker(this.droneCoordinates, { icon: droneIcon })
        .addTo(this.map)
        .bindPopup(popupText);
      
      console.log(`Drone marker added at: ${this.droneCoordinates}`);
    } catch (error) {
      console.error('Error adding drone marker:', error);
    }
  }

  /**
   * Update drone marker position
   */
  private updateDronePosition(): void {
    if (!this.map || !this.droneDetails) return;
    try {
      this.updateDroneCoordinates();
      if (this.droneMarker) {
        this.droneMarker.setLatLng(this.droneCoordinates);
        
        // Update icon if drone state changed to dead
        if (this.droneState === 'dead') {
          const crashedIcon = L.divIcon({
            className: 'crashed-drone-marker',
            html: '<div style="background-color: #dc3545; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">✕</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          this.droneMarker.setIcon(crashedIcon);
          this.droneMarker.setPopupContent(`Drone ID: ${this.droneDetails?.id || 'Unknown'} - CRASHED`);
        }
        
        console.log(`Drone marker updated to: ${this.droneCoordinates}`);
      } else {
        this.addDroneMarker();
      }
    } catch (error) {
      console.error('Error updating drone position:', error);
    }
  }

  /**
   * Add destination marker with custom color
   */
  private addDestinationMarker(): void {
    if (!this.map || !this.orderDetails || !this.orderDetails.destination) return;
    try {
      const destCoords: L.LatLngExpression = [
        this.orderDetails.destination.latitude,
        this.orderDetails.destination.longitude
      ];
      
      const destinationIcon = L.divIcon({
        className: 'destination-marker',
        html: '<div style="background-color:#FF5722; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      
      this.destinationMarker = L.marker(destCoords, { icon: destinationIcon })
        .addTo(this.map)
        .bindPopup('Delivery Destination');
      
      console.log(`Destination marker added at: ${destCoords}`);
      
      // Fit map to include HQ, drone, and destination
      const points = [
        this.HQCoordinates,
        this.droneCoordinates,
        destCoords
      ];
      const bounds = L.latLngBounds(points);
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } catch (error) {
      console.error('Error adding destination marker:', error);
    }
  }

  //---------------------------------------------------
  // KEYBOARD CONTROLS
  //---------------------------------------------------
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (!this.keyboardEnabled || !this.droneDetails || this.isDroneDead ||
        (this.droneState !== 'delivering' && this.droneState !== 'returning')) return;
    
    let latChange = 0;
    let lngChange = 0;
    
    switch (event.key.toLowerCase()) {
      case 'w': latChange = this.MOVEMENT_INCREMENT; break;
      case 's': latChange = -this.MOVEMENT_INCREMENT; break;
      case 'a': lngChange = -this.MOVEMENT_INCREMENT; break;
      case 'd': lngChange = this.MOVEMENT_INCREMENT; break;
      default: return;
    }
    
    const newLatitude = this.droneDetails.latest_latitude + latChange;
    const newLongitude = this.droneDetails.latest_longitude + lngChange;
    
    // Check if new position is within 5km of HQ
    const distance = this.calculateDistance(newLatitude, newLongitude, this.HQlat, this.HQlng);
    if (distance > this.OPERATIONAL_RADIUS) {
      this.errorMessage = 'Cannot move drone: Outside 5km operational radius';
      console.warn(this.errorMessage);
      return;
    }
    
    // Check battery level before allowing movement
    if (this.droneDetails.battery_level <= 0) {
      this.errorMessage = 'Cannot move drone: Battery depleted';
      console.warn(this.errorMessage);
      return;
    }
    
    console.log(`Moving drone to: ${newLatitude}, ${newLongitude}`);
    this.updateDroneInDatabase(newLatitude, newLongitude);
  }

  /**
 * Update drone position in the database
 */
private updateDroneInDatabase(latitude: number, longitude: number): void {
  if (!this.droneDetails || this.isDroneDead) return;
  
  // Store the current position as the last position before moving
  this.updateLastDronePosition();
  
  // Ensure latitude is negative when sending to the database (convert back to positive for API)
  const apiLatitude = latitude < 0 ? -latitude : latitude;
  
  this.apiService.callApi('updateDrone', {
    id: this.droneDetails.id,
    latest_latitude: apiLatitude,
    latest_longitude: longitude,
    altitude: this.droneDetails.altitude,
    battery_level: this.droneDetails.battery_level,
    is_available: this.droneDetails.is_available,
    order_id: this.droneDetails.order_id
  }).subscribe({
    next: (response: any) => {
      if (response.success) {
        console.log('Drone position updated successfully:', response.data);
        // Convert the latitude back to negative for local use
        const rawLatitude = parseFloat(response.data.latest_latitude) || 0;
        const adjustedLatitude = rawLatitude > 0 ? -rawLatitude : rawLatitude;
        
        this.droneDetails!.latest_latitude = adjustedLatitude;
        this.droneDetails!.latest_longitude = longitude;
        this.updateDronePosition();
        
        // CHECK FOR DUST DEVIL COLLISIONS AFTER MOVEMENT
        this.checkDustDevilCollisions();
        
        // Check if drone reached destination while delivering (only if we have a real destination)
        if (this.droneState === 'delivering' && this.orderDetails && this.orderDetails.orderId) {
          if (this.isAtDestination(
            adjustedLatitude, 
            longitude, 
            this.orderDetails.destination.latitude, 
            this.orderDetails.destination.longitude
          )) {
            this.handleDeliveryCompleted();
          }
        } 
        // Check if drone reached HQ while returning
        else if (this.droneState === 'returning') {
          if (this.isAtHQ(adjustedLatitude, longitude)) {
            console.log('Drone has reached HQ! Completing return process...');
            this.handleReturnCompleted();
          } else {
            const latDiff = Math.abs(adjustedLatitude - this.HQlat);
            const lngDiff = Math.abs(longitude - this.HQlng);
            console.log(`Distance to HQ: lat=${latDiff}, lng=${lngDiff}`);
          }
        }
        
        // Clear any previous error messages on successful movement
        if (this.errorMessage && this.errorMessage.includes('Cannot move drone')) {
          this.errorMessage = null;
        }
      } else {
        this.errorMessage = 'Failed to update drone position: ' + response.message;
        console.error(this.errorMessage);
      }
    },
    error: (err) => {
      this.errorMessage = 'Error updating drone position: ' + err.message;
      console.error('Error updating drone position:', err);
    }
  });
}

  /**
   * Handle when the drone has arrived at the delivery destination
   */
  private handleDeliveryCompleted(): void {
    if (!this.droneDetails || !this.orderDetails || this.isDroneDead || !this.orderDetails.orderId) return;
    
    window.alert(`Package delivered successfully to ${this.orderDetails.customer}! Please fly the drone back to headquarters.`);
    this.droneState = 'delivered';
    
    this.apiService.callApi('updateDrone', {
      id: this.droneDetails.id,
      latest_latitude: -this.droneDetails.latest_latitude, // Convert to positive for API
      latest_longitude: this.droneDetails.latest_longitude,
      altitude: this.droneDetails.altitude,
      battery_level: this.droneDetails.battery_level,
      is_available: false,
      order_id: null
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          console.log('Drone updated for return journey:', response.data);
          this.droneDetails!.order_id = null;
          
          setTimeout(() => {
            if (!this.isDroneDead) {
              this.droneState = 'returning';
              this.keyboardEnabled = true;
              console.log('Drone state changed to: returning');
            }
          }, 1000); // 1 second delay
        } else {
          this.errorMessage = 'Failed to update drone for return journey: ' + response.message;
          console.error(this.errorMessage);
        }
      },
      error: (err) => {
        this.errorMessage = 'Error updating drone for return journey: ' + err.message;
        console.error(this.errorMessage);
      }
    });
    
    this.apiService.callApi('updateOrder', {
      customer_id: this.orderDetails.customerId,
      order_id: this.orderDetails.orderId,
      state: 'Delivered'
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          console.log('Order status updated to Delivered:', response.data);
        } else {
          this.errorMessage = 'Failed to update order status: ' + response.message;
          console.error(this.errorMessage);
        }
      },
      error: (err) => {
        this.errorMessage = 'Error updating order status: ' + err.message;
        console.error('Error updating order status:', err);
      }
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
 * Spawn dust devils (white circles) at random positions within operational radius
 */
private spawnDustDevils(): void {
  if (!this.map || !this.mapInitialized) {
    console.log('Map not ready for dust devils');
    return;
  }
  
  // Clear existing dust devils
  this.clearDustDevils();
  
  // Generate between 5 and 10 dust devils
  const dustDevilCount = Math.floor(Math.random() * 6) + 5; // 5-10 random count
  
  console.log(`Spawning ${dustDevilCount} dust devils`);
  
  for (let i = 0; i < dustDevilCount; i++) {
    const position = this.generateRandomPositionInRadius();
    this.createDustDevilAtPosition(position);
  }
  
  console.log(`Successfully spawned ${this.dustDevils.length} dust devils`);
}

/**
 * Generate a random position within the 5km operational radius
 */
private generateRandomPositionInRadius(): L.LatLngExpression {
  let randomLat: number;
  let randomLng: number;
  let distance: number;
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loops
  
  // Keep generating random positions until we find one within the operational radius
  do {
    // Generate random offset from HQ
    // Use a more accurate conversion: 1 degree ≈ 111km, so 5km ≈ 0.045 degrees
    const maxOffset = 0.045; // Roughly 5km in degrees
    const latOffset = (Math.random() - 0.5) * maxOffset;
    const lngOffset = (Math.random() - 0.5) * maxOffset;
    
    randomLat = this.HQlat + latOffset;
    randomLng = this.HQlng + lngOffset;
    
    distance = this.calculateDistance(randomLat, randomLng, this.HQlat, this.HQlng);
    attempts++;
    
    // If we can't find a position within operational radius after many attempts,
    // use a position closer to HQ
    if (attempts > maxAttempts) {
      const reducedOffset = 0.02; // Smaller radius
      randomLat = this.HQlat + (Math.random() - 0.5) * reducedOffset;
      randomLng = this.HQlng + (Math.random() - 0.5) * reducedOffset;
      break;
    }
  } while (distance > this.OPERATIONAL_RADIUS);
  
  console.log(`Generated dust devil position: [${randomLat}, ${randomLng}], distance from HQ: ${distance}m`);
  return [randomLat, randomLng];
}

  /**
   * Handle when the drone arrives back at HQ
   */
  private handleReturnCompleted(): void {
    if (!this.droneDetails || this.isDroneDead) return;
    
    window.alert('Drone has returned to headquarters successfully!');
    this.droneState = 'completed';
    this.keyboardEnabled = false;
    
    // Stop all intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.batteryDepletionInterval) {
      clearInterval(this.batteryDepletionInterval);
      this.batteryDepletionInterval = null;
    }
    
    this.apiService.callApi('updateDrone', {
      id: this.droneDetails.id,
      latest_latitude: -this.HQlat, // Convert to positive for API
      latest_longitude: this.HQlng,
      altitude: 0,
      battery_level: 100,
      is_available: true,
      order_id: null
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          console.log('Drone marked as returned and available:', response.data);
          this.droneDetails!.latest_latitude = this.HQlat;
          this.droneDetails!.latest_longitude = this.HQlng;
          this.droneDetails!.altitude = 0;
          this.droneDetails!.battery_level = 100;
          this.droneDetails!.is_available = true;
          this.updateDronePosition();
        } else {
          this.errorMessage = 'Failed to update drone after return: ' + response.message;
          console.error(this.errorMessage);
        }
      },
      error: (err) => {
        this.errorMessage = 'Error updating drone after return: ' + err.message;
        console.error('Error updating drone after return:', err);
      }
    });
  }

  /**
 * Create a dust devil circle at the specified position
 */
private createDustDevilAtPosition(position: L.LatLngExpression): void {
  if (!this.map) {
    console.error('Cannot create dust devil: map not available');
    return;
  }
  
  console.log(`Creating dust devil at position: ${position}`);
  
  try {
    const dustDevil = L.circle(position, {
      radius: 10, // Increased radius to 50 meters for better visibility
      color: '#FF4444', // Red border for better visibility
      weight: 3, // Thicker border
      fillColor: '#FFCCCC', // Light red fill
      fillOpacity: 0.5, // Increased opacity
      dashArray: '10, 5' // Dashed border for better visibility
    }).addTo(this.map);
    
    // Add popup to identify the dust devil
    dustDevil.bindPopup('⚠️ Dust Devil - Avoid!');
    
    // Store the dust devil and its position
    this.dustDevils.push(dustDevil);
    this.dustDevilPositions.push(position);
    
    console.log(`Dust devil created successfully at position: ${position}`);
  } catch (error) {
    console.error('Error creating dust devil:', error);
  }
}

/**
 * Clear all existing dust devils from the map
 */
private clearDustDevils(): void {
  console.log(`Clearing ${this.dustDevils.length} dust devils`);
  
  this.dustDevils.forEach((dustDevil, index) => {
    try {
      if (this.map && this.map.hasLayer(dustDevil)) {
        this.map.removeLayer(dustDevil);
      }
    } catch (error) {
      console.error(`Error removing dust devil ${index}:`, error);
    }
  });
  
  this.dustDevils = [];
  this.dustDevilPositions = [];
  console.log('All dust devils cleared');
}

/**
 * Check if drone has entered any dust devil and handle collision
 */
private checkDustDevilCollisions(): void {
  if (!this.droneDetails || this.isDroneDead || this.dustDevilPositions.length === 0) return;
  
  const dronePosition: L.LatLngExpression = [
    this.droneDetails.latest_latitude,
    this.droneDetails.latest_longitude
  ];
  
  // Check collision with each dust devil
  for (let i = 0; i < this.dustDevilPositions.length; i++) {
    const dustDevilPos = this.dustDevilPositions[i];
    const dustDevilLat = Array.isArray(dustDevilPos) ? dustDevilPos[0] : dustDevilPos.lat;
    const dustDevilLng = Array.isArray(dustDevilPos) ? dustDevilPos[1] : dustDevilPos.lng;
    
    const distance = this.calculateDistance(
      this.droneDetails.latest_latitude,
      this.droneDetails.latest_longitude,
      dustDevilLat,
      dustDevilLng
    );
    
    // Check if drone is within 50 meters of dust devil center (matching the visual radius)
    if (distance <= 50) {
      console.log(`Drone entered dust devil at position ${i}! Distance: ${distance}m`);
      this.handleDustDevilCollision();
      return; // Handle only one collision at a time
    }
  }
}

/**
 * Handle drone collision with dust devil - move up 10m and back
 */
private handleDustDevilCollision(): void {
  if (!this.droneDetails || this.isDroneDead) return;
  
  // Show alert to user
  window.alert('⚠️ DUST DEVIL DETECTED! ⚠️\n\nDrone is performing evasive maneuvers!\nClimbing 10 meters and reversing direction...');
  
  // Calculate reverse direction if we have a last position
  let reverseLat = this.droneDetails.latest_latitude;
  let reverseLng = this.droneDetails.latest_longitude;
  
  if (this.lastDronePosition) {
    const lastLat = Array.isArray(this.lastDronePosition) ? this.lastDronePosition[0] : this.lastDronePosition.lat;
    const lastLng = Array.isArray(this.lastDronePosition) ? this.lastDronePosition[1] : this.lastDronePosition.lng;
    
    // Calculate the direction the drone came from
    const latDiff = this.droneDetails.latest_latitude - lastLat;
    const lngDiff = this.droneDetails.latest_longitude - lastLng;
    
    // Move back in the opposite direction (2x the movement increment for a bigger step back)
    reverseLat = this.droneDetails.latest_latitude - (latDiff * 2);
    reverseLng = this.droneDetails.latest_longitude - (lngDiff * 2);
    
    // Ensure the reverse position is still within operational radius
    const distanceFromHQ = this.calculateDistance(reverseLat, reverseLng, this.HQlat, this.HQlng);
    if (distanceFromHQ > this.OPERATIONAL_RADIUS) {
      // If reverse position is out of bounds, just move slightly back
      reverseLat = this.droneDetails.latest_latitude - latDiff;
      reverseLng = this.droneDetails.latest_longitude - lngDiff;
    }
  } else {
    // If no last position, move slightly towards HQ
    const directionToHQ = {
      lat: (this.HQlat - this.droneDetails.latest_latitude) * 0.1,
      lng: (this.HQlng - this.droneDetails.latest_longitude) * 0.1
    };
    reverseLat += directionToHQ.lat;
    reverseLng += directionToHQ.lng;
  }
  
  // Update drone position with increased altitude and reverse movement
  const newAltitude = this.droneDetails.altitude + 5; // Climb 10 meters
  
  // CHECK IF NEW ALTITUDE EXCEEDS 30 METERS
  if (newAltitude > 30) {
    console.warn(`Evasive maneuver would exceed altitude limit (${newAltitude}m). Initiating emergency landing instead.`);
    
    // Set altitude to exactly 30m and trigger altitude violation
    this.droneDetails.altitude = 31; // Set to 31 to trigger the violation
    this.checkAltitudeLimit();
    return; // Exit early, altitude violation will handle the rest
  }
  
  // Convert latitude to positive for API call
  const apiLatitude = reverseLat < 0 ? -reverseLat : reverseLat;
  
  this.apiService.callApi('updateDrone', {
    id: this.droneDetails.id,
    latest_latitude: apiLatitude,
    latest_longitude: reverseLng,
    altitude: newAltitude,
    battery_level: this.droneDetails.battery_level,
    is_available: this.droneDetails.is_available,
    order_id: this.droneDetails.order_id
  }).subscribe({
    next: (response: any) => {
      if (response.success) {
        console.log('Drone successfully performed evasive maneuver:', response.data);
        
        // Update local drone details
        this.droneDetails!.latest_latitude = reverseLat; // Keep negative for local use
        this.droneDetails!.latest_longitude = reverseLng;
        this.droneDetails!.altitude = newAltitude;
        
        // Check altitude limit after update
        this.checkAltitudeLimit();
        
        // Update drone position on map (only if not dead from altitude violation)
        if (!this.isDroneDead) {
          this.updateDronePosition();
        }
        
        // Clear error message if dust devil collision was handled successfully
        if (!this.isDroneDead) {
          this.errorMessage = null;
        }
        
        console.log(`Drone moved to safe position: (${reverseLat}, ${reverseLng}) at altitude ${newAltitude}m`);
      } else {
        this.errorMessage = 'Failed to perform evasive maneuver: ' + response.message;
        console.error(this.errorMessage);
      }
    },
    error: (err) => {
      this.errorMessage = 'Error performing evasive maneuver: ' + err.message;
      console.error('Error performing evasive maneuver:', err);
    }
  });
}

/**
 * Store the current drone position as the last position (for reverse direction calculation)
 */
private updateLastDronePosition(): void {
  if (this.droneDetails) {
    this.lastDronePosition = [
      this.droneDetails.latest_latitude,
      this.droneDetails.latest_longitude
    ];
  }
}

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

private checkAltitudeLimit(): void {
  if (!this.droneDetails) return;
  
  // Check if drone exceeds 30 meters altitude
  if (this.droneDetails.altitude > 30) {
    console.log(`Drone exceeded altitude limit: ${this.droneDetails.altitude}m`);
    this.handleAltitudeViolation();
  }
}

private handleAltitudeViolation(): void {
  if (!this.droneDetails) return;
  
  // Show alert about altitude violation
  window.alert(`⚠️ ALTITUDE VIOLATION ⚠️\n\nDrone #${this.droneDetails.id} has exceeded the maximum altitude of 30 meters!\nCurrent altitude: ${this.droneDetails.altitude}m\n\nInitiating emergency landing and returning order to storage...`);
  
  // Set flags to prevent further operations
  this.isDroneDead = true;
  this.droneState = 'dead';
  this.keyboardEnabled = false;
  
  // Clear any existing intervals
  if (this.batteryDepletionInterval) {
    clearInterval(this.batteryDepletionInterval);
    this.batteryDepletionInterval = null;
  }
  
  // Step 1: Update order back to storage if there is an active order
  if (this.droneDetails.order_id && this.orderDetails && this.orderDetails.customerId) {
    this.apiService.callApi('updateOrder', {
      customer_id: this.orderDetails.customerId,
      order_id: this.droneDetails.order_id,
      state: 'Storage'
    }).subscribe({
      next: (orderResponse: any) => {
        if (orderResponse.success) {
          console.log('Order returned to storage due to altitude violation:', orderResponse.data);
        } else {
          console.error('Failed to return order to storage:', orderResponse.message);
        }
        
        // Step 2: Update drone after order is handled
        this.updateDroneAfterAltitudeViolation();
      },
      error: (err) => {
        console.error('Error returning order to storage:', err);
        // Still update drone even if order update failed
        this.updateDroneAfterAltitudeViolation();
      }
    });
  } else {
    // No active order, just update the drone
    this.updateDroneAfterAltitudeViolation();
  }
}

private updateDroneAfterAltitudeViolation(): void {
  if (!this.droneDetails) return;
  
  // Step 2: Update drone to crashed state
  this.apiService.callApi('updateDrone', {
    id: this.droneDetails.id,
    altitude: 0, // Set altitude to 0 (crashed)
    battery_level: this.droneDetails.battery_level,
    is_available: false,
    order_id: null, // Remove order assignment
    latest_latitude: -this.droneDetails.latest_latitude, // Convert to positive for API
    latest_longitude: this.droneDetails.latest_longitude
  }).subscribe({
    next: (droneResponse: any) => {
      if (droneResponse.success) {
        console.log('Drone updated after altitude violation:', droneResponse.data);
        
        // Update local drone details
        this.droneDetails!.altitude = 0;
        this.droneDetails!.is_available = false;
        this.droneDetails!.order_id = null;
        
        // Update map to show drone at ground level (crashed)
        this.updateDronePosition();
        
        // Set error message to indicate drone has crashed
        this.errorMessage = 'Drone has crashed due to altitude violation and is no longer operational.';
        
        // Clear all intervals to stop further processing
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }
        
      } else {
        console.error('Failed to update drone after altitude violation:', droneResponse.message);
        this.errorMessage = 'Failed to update drone status after crash: ' + droneResponse.message;
      }
    },
    error: (err) => {
      console.error('Error updating drone after altitude violation:', err);
      this.errorMessage = 'Error updating drone status after crash: ' + err.message;
    }
  });
}

  /**
   * Navigate back to dispatched orders view
   */
  returnToDispatched() {
    this.router.navigate(['/operator/dispatched-orders']);
  }
}