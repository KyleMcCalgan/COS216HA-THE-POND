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
  orderId: string | number;
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
type DroneState = 'waiting' | 'delivering' | 'returning' | 'delivered' | 'completed';

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
  orderId: string | null = null;
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

  // Location coordinates
  //---------------------------------------------------
  // Hatfield, Pretoria coordinates (precise center point)
  hatfieldLat: number = -25.7522;
  hatfieldLng: number = 28.2396;
  private hatfieldCoordinates: L.LatLngExpression = [this.hatfieldLat, this.hatfieldLng];

  // Headquarters coordinates
  HQlat: number = -25.7472;
  HQlng: number = 28.2511;
  private HQCoordinates: L.LatLngExpression = [this.HQlat, this.HQlng];

  // Drone coordinates (will be updated from API)
  private droneCoordinates: L.LatLngExpression = [this.HQlat, this.HQlng];

  // Movement increment for WASD keys
  private readonly MOVEMENT_INCREMENT: number = 0.0001;

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
  // Get order ID from route parameters
  this.orderId = this.route.snapshot.paramMap.get('orderId');
  
  if (!this.orderId) {
    console.error('No order ID provided');
    return;
  }

  // Ensure HQ coordinates are NEGATIVE for southern hemisphere
  // (Do NOT use Math.abs here)
  console.log(`HQ coordinates: (${this.HQlat}, ${this.HQlng})`);
  console.log(`Fetching data for order ID: ${this.orderId}`);
  
  this.loadOrderAndDroneData();
  
  // Set up automatic refreshing
  this.updateInterval = setInterval(() => {
    this.fetchDroneData();
  }, 10000); // Refresh drone data every 10 seconds
}

  /**
   * Fetch order and drone data from API
   */
  private loadOrderAndDroneData() {
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // First fetch all orders to get the specific order details
    this.apiService.callApi('getAllOrders', {
      user_id: currentUser.id || 1,
      user_type: currentUser.type || 'Courier'
    }).subscribe({
      next: (ordersResponse: any) => {
        if (ordersResponse.success && ordersResponse.data) {
          console.log('All orders response:', ordersResponse.data);
          
          // Find the order with matching order_id
          const foundOrder = ordersResponse.data.find((order: any) => 
            order.order_id == this.orderId
          );
          
          if (foundOrder) {
            console.log('Found order:', foundOrder);
            this.processOrderDetails(foundOrder);
            
            // Now fetch all drones to find the one assigned to this order
            this.fetchDroneData();
          } else {
            console.error(`Order with ID ${this.orderId} not found`);
            this.isLoading = false;
          }
        } else {
          console.error('Failed to load orders:', ordersResponse.message);
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.isLoading = false;
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
    
    // Create order details object
    this.orderDetails = {
      orderId: this.orderId || '0',
      products: productsList,
      customer: orderData.customer?.username || `Customer #${orderData.customer_id}`,
      customerId: orderData.customer_id,
      trackingNum: orderData.tracking_num || 'Unknown',
      destination: {
        latitude: parseFloat(orderData.destination_latitude) || 0,
        longitude: parseFloat(orderData.destination_longitude) || 0
      },
      droneId: 0 // Will be updated when we find the drone
    };
    
    console.log('Processed order details:', this.orderDetails);
  }

  /**
   * Fetch drones data from API
   */
  private fetchDroneData() {
    this.apiService.callApi('getAllDrones', {}).subscribe({
      next: (dronesResponse: any) => {
        this.isLoading = false;
        if (dronesResponse.success && dronesResponse.data) {
          console.log('All drones response:', dronesResponse.data);
          
          // Find the drone with this order ID
          const foundDrone = dronesResponse.data.find((drone: any) => {
            const droneOrderId = drone.order_id || drone.Order_ID;
            return droneOrderId == this.orderId;
          });
          
          // If we found a drone assigned to this order
          if (foundDrone) {
            console.log('Found drone for this order:', foundDrone);
            this.droneDetails = {
              id: parseInt(foundDrone.id),
              is_available: foundDrone.is_available === true,
              latest_latitude: parseFloat(foundDrone.latest_latitude) || 0,
              latest_longitude: parseFloat(foundDrone.latest_longitude) || 0,
              altitude: parseFloat(foundDrone.altitude) || 0,
              battery_level: parseInt(foundDrone.battery_level) || 0,
              current_operator_id: foundDrone.current_operator_id,
              order_id: foundDrone.order_id || foundDrone.Order_ID
            };
            
            // Update order details with drone ID
            if (this.orderDetails) {
              this.orderDetails.droneId = this.droneDetails.id;
            }
            
            // Determine if drone is delivering or returning
            this.determineDroneState();
            
            // Update drone coordinates
            this.updateDroneCoordinates();
            
            // Update or initialize the map with drone marker
            this.updateMapWithDronePosition();
            
            // Enable keyboard controls if the drone is not returning, delivered, or completed
            this.keyboardEnabled = this.droneState === 'delivering';
          } 
          // If we didn't find a drone assigned to this order, check if any drone is returning
          else {
            // Get all drones that are not available, with no order ID (returning drones)
            const returningDrones = dronesResponse.data.filter((drone: any) => {
              const droneOrderId = drone.order_id || drone.Order_ID;
              return !drone.is_available && !droneOrderId;
            });
            
            console.log('Returning drones:', returningDrones);
            
            // If we have any returning drones, assume it's for this order
            // This is a simplification - in a real system we'd track which order a returning drone completed
            if (returningDrones.length > 0) {
              const returningDrone = returningDrones[0];
              
              this.droneDetails = {
                id: parseInt(returningDrone.id),
                is_available: returningDrone.is_available === true,
                latest_latitude: parseFloat(returningDrone.latest_latitude) || 0,
                latest_longitude: parseFloat(returningDrone.latest_longitude) || 0,
                altitude: parseFloat(returningDrone.altitude) || 0,
                battery_level: parseInt(returningDrone.battery_level) || 0,
                current_operator_id: returningDrone.current_operator_id,
                order_id: null
              };
              
              // Update order details with drone ID
              if (this.orderDetails) {
                this.orderDetails.droneId = this.droneDetails.id;
              }
              
              // Set state to returning
              this.droneState = 'returning';
              
              // Update drone coordinates
              this.updateDroneCoordinates();
              
              // Update or initialize the map with drone marker
              this.updateMapWithDronePosition();
              
              // Enable keyboard controls for returning drone so user can pilot it back to HQ
              this.keyboardEnabled = true;
            } else {
              console.error('No drone found for this order, and no returning drones');
            }
          }
        } else {
          console.error('Failed to load drones:', dronesResponse.message);
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading drones:', err);
      }
    });
  }

  private determineDroneState() {
    if (!this.droneDetails || !this.orderDetails) return;
    
    const isDroneAssignedToOrder = this.droneDetails.order_id != null;
    const isDroneAvailable = this.droneDetails.is_available;
    
    // Check if the drone is at the destination
    const isAtDestination = this.isAtDestination(
      this.droneDetails.latest_latitude, 
      this.droneDetails.latest_longitude,
      this.orderDetails.destination.latitude,
      this.orderDetails.destination.longitude
    );
    
    // Check if the drone is at HQ
    const isAtHQ = this.isAtHQ(
      this.droneDetails.latest_latitude, 
      this.droneDetails.latest_longitude
    );
    
    console.log(`State determination: isDroneAssignedToOrder=${isDroneAssignedToOrder}, isDroneAvailable=${isDroneAvailable}, isAtDestination=${isAtDestination}, isAtHQ=${isAtHQ}`);
    
    // Determine the state based on multiple factors
    if (isDroneAssignedToOrder && !isDroneAvailable) {
      // If drone has an order and is not available, it's delivering
      this.droneState = 'delivering';
      this.keyboardEnabled = true; // Enable keyboard for delivery
    } else if (!isDroneAssignedToOrder && !isDroneAvailable && isAtDestination) {
      // If drone is at destination, has no order, and is not available, it just completed delivery
      this.droneState = 'delivered';
      this.keyboardEnabled = true; // Keep keyboard enabled for return journey
    } else if (!isDroneAssignedToOrder && !isDroneAvailable && !isAtHQ) {
      // If drone has no order, is not available, and is not at HQ, it's returning
      this.droneState = 'returning';
      this.keyboardEnabled = true; // Keep keyboard enabled for return journey
    } else if (!isDroneAssignedToOrder && !isDroneAvailable && isAtHQ) {
      // If drone is at HQ, has no order, and is not available, it has completed its mission
      this.droneState = 'completed';
      this.keyboardEnabled = false; // Disable keyboard when completed
    } else if (isDroneAssignedToOrder && isDroneAvailable) {
      // If drone has an order but is still available, it's waiting to start delivery
      this.droneState = 'waiting';
      this.keyboardEnabled = false; // Not yet started, keyboard disabled
    } else {
      // Default to delivering if we can't determine state
      this.droneState = 'delivering';
      this.keyboardEnabled = true; // Enable keyboard for default state
    }
    
    console.log(`Drone state determined: ${this.droneState}, keyboard enabled: ${this.keyboardEnabled}`);
  }

  /**
   * Check if drone is at the destination (within tolerance)
   */
  private isAtDestination(droneLat: number, droneLong: number, destLat: number, destLong: number): boolean {
    // Use a small tolerance for position comparisons (0.0001 degrees is about 11 meters)
    const tolerance = 0.0001;
    return Math.abs(droneLat - destLat) < tolerance && Math.abs(droneLong - destLong) < tolerance;
  }

/**
 * Check if drone is at HQ (within tolerance)
 */
private isAtHQ(droneLat: number, droneLong: number): boolean {
  // Use a small tolerance for position comparisons
  const tolerance = 0.001; // Increased tolerance to about 100 meters
  
  // Log for debugging
  console.log(`Checking if drone at HQ: Drone(${droneLat}, ${droneLong}) vs HQ(${this.HQlat}, ${this.HQlng})`);
  console.log(`Distance: lat=${Math.abs(droneLat - this.HQlat)}, lng=${Math.abs(droneLong - this.HQlng)}`);
  
  return Math.abs(droneLat - this.HQlat) < tolerance && Math.abs(droneLong - this.HQlng) < tolerance;
}

  /**
   * Get the appropriate label text for the current drone state
   */
  getStateLabelText(): string {
    switch (this.droneState) {
      case 'waiting':
        return 'WAITING TO START';
      case 'delivering':
        return 'DELIVERING';
      case 'returning':
        return 'RETURNING TO BASE';
      case 'delivered':
        return 'DELIVERED';
      case 'completed':
        return 'COMPLETED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Get the appropriate message text for the current drone state
   */
  getStateMessageText(): string {
    switch (this.droneState) {
      case 'waiting':
        return 'Drone is waiting to start the delivery mission.';
      case 'delivering':
        return 'Drone is on its way to the delivery destination.';
      case 'returning':
        return 'Drone has completed the delivery and is returning to base.';
      case 'delivered':
        return 'Drone has arrived at the delivery destination.';
      case 'completed':
        return 'Drone has returned to base and completed the mission.';
      default:
        return '';
    }
  }

  /**
   * Get an estimated time text based on drone state
   */
  getEstimatedTimeText(): string {
    // This would be a more complex calculation in a real system
    // For now, just return a placeholder based on state
    switch (this.droneState) {
      case 'waiting':
        return 'Not yet started';
      case 'delivering':
        return 'Approximately 5-10 minutes';
      case 'returning':
        return 'Drone has already delivered the package';
      case 'delivered':
        return 'Package has been delivered';
      case 'completed':
        return 'Mission completed';
      default:
        return 'Unknown';
    }
  }

  /**
   * Update drone coordinates from API data
   */
  private updateDroneCoordinates(): void {
    if (this.droneDetails) {
      // Convert coordinates (invert latitude for southern hemisphere)
      this.droneCoordinates = [
        -Math.abs(this.droneDetails.latest_latitude), 
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
      // If the map hasn't been initialized yet, we'll do it in afterViewInit
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
    // Disable keyboard controls
    this.keyboardEnabled = false;
    
    // Clear update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Clean up the map if it exists
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
    
    // Check if map container exists
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map container element not found');
      return;
    }
    
    console.log('Map container found, creating Leaflet map');
    console.log(`Using HQ coordinates for map: ${this.HQCoordinates}`);
    
    // Create the map instance centered on HQ coordinates
    this.map = L.map('map').setView(this.HQCoordinates, 14);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Add headquarters marker
    this.addHeadquartersMarker();
    
    // Add 5km operational radius circle
    this.addOperationalRadiusCircle();
    
    // Add destination marker if order details exist
    if (this.orderDetails && this.orderDetails.destination) {
      this.addDestinationMarker();
    }
    
    // Add drone marker if we have drone details
    if (this.droneDetails) {
      this.addDroneMarker();
    }
    
    // Mark map as initialized
    this.mapInitialized = true;
    console.log('Map initialization complete');
    
  } catch (error) {
    console.error('Error initializing map:', error);
  }
}

  //---------------------------------------------------
  // MARKER CREATION METHODS
  //---------------------------------------------------

  /**
   * Add headquarters marker to the map
   */
/**
 * Add headquarters marker to the map
 */
/**
 * Add headquarters marker to the map with a visible red square
 */
private addHeadquartersMarker(): void {
  if (!this.map) return;
  
  try {
    // Use the positive HQ coordinates for the marker
    const hqLatLng = [this.HQlat, this.HQlng];
    console.log(`Adding HQ marker at coordinates: ${hqLatLng}`);
    
    // Create a custom div icon (red square)
    const customHQIcon = L.divIcon({
      className: 'custom-hq-marker',
      html: '<div style="background-color: red; width: 20px; height: 20px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    // Create marker with custom icon
    const headquartersMarker = L.marker(hqLatLng as L.LatLngExpression, {
      icon: customHQIcon
    })
    .addTo(this.map)
    .bindPopup('Headquarters');
    
    // Add a simple circle around HQ for better visibility
    const hqCircle = L.circle(hqLatLng as L.LatLngExpression, {
      radius: 200,  // 200 meters
      color: 'red',
      fillColor: 'red',
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
    const radiusInMeters = 5000;
    console.log(`Adding operational radius circle at: ${this.HQCoordinates}`);
    
    const circle = L.circle(this.HQCoordinates, {
      radius: radiusInMeters,
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
      // Create drone icon with fallback if image not found
      let droneIcon: L.Icon | L.DivIcon;
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
      
      // Add drone marker to map
      this.droneMarker = L.marker(this.droneCoordinates, { icon: droneIcon })
        .addTo(this.map)
        .bindPopup(`Drone ID: ${this.orderDetails?.droneId || 'Unknown'}`);
      
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
      // Update drone coordinates
      this.updateDroneCoordinates();
      
      // Update marker position if it exists, otherwise create it
      if (this.droneMarker) {
        this.droneMarker.setLatLng(this.droneCoordinates);
        console.log(`Drone marker updated to: ${this.droneCoordinates}`);
      } else {
        // Create marker if it doesn't exist
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
      // Get destination coordinates (invert latitude for southern hemisphere)
      const destCoords: L.LatLngExpression = [
        -Math.abs(this.orderDetails.destination.latitude),
        this.orderDetails.destination.longitude
      ];
      
      // Custom destination icon with red color
      const destinationIcon = L.divIcon({
        className: 'destination-marker',
        html: '<div style="background-color:#FF5722; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      
      // Add destination marker to map
      this.destinationMarker = L.marker(destCoords, { icon: destinationIcon })
        .addTo(this.map)
        .bindPopup('Delivery Destination');
      
      console.log(`Destination marker added at: ${destCoords}`);
      
      // Calculate bounds to include all points
      const points = [
        this.HQCoordinates,
        this.hatfieldCoordinates,
        this.droneCoordinates,
        destCoords
      ];
      
      // Create bounds and fit map to them
      const bounds = L.latLngBounds(points);
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      
      // Then explicitly set the view back to HQ with a slight delay
      setTimeout(() => {
        if (this.map) {
          this.map.setView(this.HQCoordinates, 14);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error adding destination marker:', error);
    }
  }

  //---------------------------------------------------
  // KEYBOARD CONTROLS
  //---------------------------------------------------
  
  /**
 * Handle keyboard events for drone movement
 */
@HostListener('window:keydown', ['$event'])
handleKeyDown(event: KeyboardEvent): void {
  // Only handle keys if keyboard controls are enabled and drone is in a movable state (delivering or returning)
  if (!this.keyboardEnabled || !this.droneDetails || 
      (this.droneState !== 'delivering' && this.droneState !== 'returning')) return;
  
  let latChange = 0;
  let lngChange = 0;
  
  // Determine which key was pressed and calculate position change
  switch (event.key.toLowerCase()) {
    case 'w': // Move north (decrease latitude)
      latChange = -this.MOVEMENT_INCREMENT;
      break;
    case 's': // Move south (increase latitude)
      latChange = this.MOVEMENT_INCREMENT;
      break;
    case 'a': // Move west (decrease longitude)
      lngChange = -this.MOVEMENT_INCREMENT;
      break;
    case 'd': // Move east (increase longitude)
      lngChange = this.MOVEMENT_INCREMENT;
      break;
    default:
      return; // Exit if not a movement key
  }
  
  // Calculate new position
  const newLatitude = this.droneDetails.latest_latitude + latChange;
  const newLongitude = this.droneDetails.latest_longitude + lngChange;
  
  console.log(`Moving drone to: ${newLatitude}, ${newLongitude}`);
  
  // Update drone position in the database
  this.updateDroneInDatabase(newLatitude, newLongitude);
}
  
  /**
   * Update drone position in the database
   */
  /**
 * Update drone position in the database
 */
private updateDroneInDatabase(latitude: number, longitude: number): void {
  if (!this.droneDetails) return;
  
  // Call API to update drone position
  this.apiService.callApi('updateDrone', {
    id: this.droneDetails.id,
    latest_latitude: latitude,
    latest_longitude: longitude,
    // Include other properties to maintain their values
    altitude: this.droneDetails.altitude,
    battery_level: this.droneDetails.battery_level,
    is_available: this.droneDetails.is_available
  }).subscribe({
    next: (response: any) => {
      if (response.success) {
        console.log('Drone position updated successfully:', response.data);
        
        // Update local drone details
        this.droneDetails!.latest_latitude = latitude;
        this.droneDetails!.latest_longitude = longitude;
        
        // Update map marker
        this.updateDronePosition();
        
        if (this.droneState === 'delivering' && this.orderDetails) {
          // Check if drone has reached destination during delivery
          if (this.isAtDestination(
            latitude, 
            longitude, 
            this.orderDetails.destination.latitude, 
            this.orderDetails.destination.longitude
          )) {
            // Drone has reached destination, show notification and update state
            this.handleDeliveryCompleted();
          }
        } 
        else if (this.droneState === 'returning') {
          // Check if drone has reached HQ during return journey
          if (this.isAtHQ(latitude, longitude)) {
            console.log('Drone has reached HQ! Completing return process...');
            // Drone has reached HQ, complete the mission
            this.handleReturnCompleted();
          } else {
            console.log('Drone not yet at HQ, continuing return journey');
            // Calculate distance to HQ for debugging
            const latDiff = Math.abs(latitude - this.HQlat);
            const lngDiff = Math.abs(longitude - this.HQlng);
            console.log(`Distance to HQ: lat=${latDiff}, lng=${lngDiff}`);
          }
        }
      } else {
        console.error('Failed to update drone position:', response.message);
      }
    },
    error: (err) => {
      console.error('Error updating drone position:', err);
    }
  });
}
  
  /**
   * Handle when the drone has arrived at the delivery destination
   */
  private handleDeliveryCompleted(): void {
    if (!this.droneDetails || !this.orderDetails) return;
    
    // Show popup alert (fulfilling first bullet point)
    window.alert(`Package delivered successfully to ${this.orderDetails.customer}!`);
    
    // Update drone state to delivered
    this.droneState = 'delivered';
    
    // Update drone in database:
    // 1. Set order_id to null (delivery completed) - fulfilling second bullet point
    // 2. Keep is_available as false (drone is still in operation, returning to base)
    this.apiService.callApi('updateDrone', {
      id: this.droneDetails.id,
      latest_latitude: this.droneDetails.latest_latitude,
      latest_longitude: this.droneDetails.latest_longitude,
      altitude: this.droneDetails.altitude,
      battery_level: this.droneDetails.battery_level,
      is_available: false,  // Keep as false since it's still in operation
      order_id: null  // Remove the order_id as delivery is complete
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          console.log('Drone updated for return journey:', response.data);
          
          // Update local drone details
          this.droneDetails!.order_id = null;
          
          // After a brief delay, update the state to returning
          setTimeout(() => {
            this.droneState = 'returning';
            
            // Keep keyboard controls enabled for returning drone (fulfilling third bullet point)
            this.keyboardEnabled = true;
            
            // Show message to user about returning to HQ
            window.alert('Package delivered! Please fly the drone back to headquarters.');
            
            // Update UI
            console.log('Drone state changed to: returning');
          }, 3000); // 3 second delay to let user see "delivered" state
          
        } else {
          console.error('Failed to update drone for return journey:', response.message);
        }
      },
      error: (err) => {
        console.error('Error updating drone for return journey:', err);
      }
    });
    
    // Also update the order status to "Delivered" in the database
    this.apiService.callApi('updateOrder', {
      customer_id: this.orderDetails.customerId,
      order_id: this.orderDetails.orderId,
      state: 'Delivered'
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          console.log('Order status updated to Delivered:', response.data);
        } else {
          console.error('Failed to update order status:', response.message);
        }
      },
      error: (err) => {
        console.error('Error updating order status:', err);
      }
    });
  }

  /**
 * Handle when the drone arrives back at HQ
 */
private handleReturnCompleted(): void {
  if (!this.droneDetails) return;
  
  // Show popup alert when drone reaches HQ (fulfilling fourth bullet point)
  window.alert('Drone has returned to headquarters successfully!');
  
  // Update drone state
  this.droneState = 'completed';
  
  // Disable keyboard controls now that mission is complete (fulfilling sixth bullet point)
  this.keyboardEnabled = false;
  
  // Update drone in database (fulfilling fifth bullet point):
  // 1. Set altitude to 0
  // 2. Reset battery to 100%
  // 3. Set is_available to true (drone is available for new deliveries)
  this.apiService.callApi('updateDrone', {
    id: this.droneDetails.id,
    latest_latitude: this.HQlat,  // Force exact HQ coordinates
    latest_longitude: this.HQlng, // Force exact HQ coordinates
    altitude: 0,  // Set altitude to 0 as the drone has landed
    battery_level: 100,  // Reset battery to 100%
    is_available: true,  // Make drone available again
    order_id: null
  }).subscribe({
    next: (response: any) => {
      if (response.success) {
        console.log('Drone marked as returned and available:', response.data);
        
        // Update local drone details
        this.droneDetails!.latest_latitude = this.HQlat;
        this.droneDetails!.latest_longitude = this.HQlng;
        this.droneDetails!.altitude = 0;
        this.droneDetails!.battery_level = 100;
        this.droneDetails!.is_available = true;
        
        // Update map
        this.updateDronePosition();
        
      } else {
        console.error('Failed to update drone after return:', response.message);
      }
    },
    error: (err) => {
      console.error('Error updating drone after return:', err);
    }
  });
}

  //---------------------------------------------------
  // NAVIGATION
  //---------------------------------------------------
  /**
   * Navigate back to dispatched orders view
   */
  returnToDispatched() {
    this.router.navigate(['/operator/dispatched-orders']);
  }
}