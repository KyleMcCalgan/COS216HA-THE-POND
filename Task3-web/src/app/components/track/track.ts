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

// Define drone operation states
enum DroneState {
  DELIVERING = 'DELIVERING',   // On the way to deliver package
  RETURNING = 'RETURNING',     // Coming back to HQ after delivery
  DELIVERED = 'DELIVERED',     // Just delivered the package (transition state)
  COMPLETED = 'COMPLETED'      // Returned to HQ (mission complete)
}

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
  private map: L.Map | null = null;
  private droneMarker: L.Marker | null = null;
  private destinationMarker: L.Marker | null = null;
  private isLoading: boolean = true;
  private keyboardEnabled: boolean = false;
  private mapInitialized: boolean = false;
  
  // Drone state tracking
  droneState: DroneState = DroneState.DELIVERING;
  stateMessage: string = '';
  showStateMessage: boolean = false;

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
  private readonly MOVEMENT_INCREMENT: number = 0.001;
  
  // Distance threshold for reaching destination (in meters)
  private readonly DESTINATION_THRESHOLD: number = 30;

  //---------------------------------------------------
  // CONSTRUCTOR & LIFECYCLE HOOKS
  //---------------------------------------------------
  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private apiService: ApiService
  ) {}

  /**
   * Initialize component and load order data
   */
  ngOnInit() {
    // Get order ID from route parameters
    this.orderId = this.route.snapshot.paramMap.get('orderId');
    
    if (!this.orderId) {
      console.error('No order ID provided');
      return;
    }

    console.log(`Fetching data for order ID: ${this.orderId}`);
    this.loadOrderAndDroneData();
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
            
            // Update drone coordinates
            this.updateDroneCoordinates();
            
            // Determine initial drone state
            this.determineInitialDroneState();
            
            // Update or initialize the map with drone position
            this.updateMapWithDronePosition();
            
            // Enable keyboard controls
            this.keyboardEnabled = true;
          } else {
            console.error('No drone found for this order');
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

  /**
   * Determine the initial drone state based on its position and availability
   */
  private determineInitialDroneState(): void {
    if (!this.droneDetails || !this.orderDetails) return;
    
    // Check if drone is at the destination (already delivered)
    const distanceToDestination = this.calculateDistance(
      -Math.abs(this.droneDetails.latest_latitude),
      this.droneDetails.latest_longitude,
      -Math.abs(this.orderDetails.destination.latitude),
      this.orderDetails.destination.longitude
    );
    
    // Check if drone is at HQ
    const distanceToHQ = this.calculateDistance(
      -Math.abs(this.droneDetails.latest_latitude),
      this.droneDetails.latest_longitude,
      this.HQlat,
      this.HQlng
    );
    
    console.log(`Distance to destination: ${distanceToDestination}m`);
    console.log(`Distance to HQ: ${distanceToHQ}m`);
    
    // Determine state based on position
    if (distanceToDestination <= this.DESTINATION_THRESHOLD) {
      // Drone is at destination - should be returning
      this.droneState = DroneState.RETURNING;
      this.stateMessage = 'Package delivered! Return to headquarters.';
      this.showStateMessage = true;
    } else if (distanceToHQ <= this.DESTINATION_THRESHOLD) {
      // Drone is at HQ - either hasn't left yet or has returned
      if (this.droneDetails.is_available) {
        // If available, it has completed the mission
        this.droneState = DroneState.COMPLETED;
        this.stateMessage = 'Mission complete! Drone has returned to headquarters.';
        this.showStateMessage = true;
      } else {
        // If not available, it hasn't left yet
        this.droneState = DroneState.DELIVERING;
        this.stateMessage = 'Start delivery by moving the drone to the destination.';
        this.showStateMessage = true;
      }
    } else {
      // Drone is somewhere in between - determine state by comparing distances
      if (distanceToDestination < distanceToHQ) {
        // Closer to destination than HQ - likely delivering
        this.droneState = DroneState.DELIVERING;
        this.stateMessage = 'Drone is en route to delivery destination.';
        this.showStateMessage = true;
      } else {
        // Closer to HQ than destination - likely returning
        this.droneState = DroneState.RETURNING;
        this.stateMessage = 'Drone is returning to headquarters.';
        this.showStateMessage = true;
      }
    }
    
    console.log(`Initial drone state: ${this.droneState}`);
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
    
    // Clean up the map if it exists
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  //---------------------------------------------------
  // MAP INITIALIZATION
  //---------------------------------------------------
  /**
   * Initialize the Leaflet map with markers and boundaries
   */
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
  private addHeadquartersMarker(): void {
    if (!this.map) return;
    
    try {
      const headquartersMarker = L.marker([this.HQlat, this.HQlng])
        .addTo(this.map)
        .bindPopup('Headquarters');
      
      console.log('HQ marker added');
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
      
      // Check if drone has reached destination or HQ
      this.checkDroneLocation();
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
  // LOCATION & STATE TRACKING
  //---------------------------------------------------
  
  /**
   * Check if drone has reached the destination or returned to HQ
   */
  private checkDroneLocation(): void {
    if (!this.droneDetails || !this.orderDetails) return;
    
    // Get drone coordinates (already inverted for map display)
    const droneLat = (this.droneCoordinates as number[])[0];
    const droneLng = (this.droneCoordinates as number[])[1];
    
    // Calculate distance to destination
    const destLat = -Math.abs(this.orderDetails.destination.latitude);
    const destLng = this.orderDetails.destination.longitude;
    const distanceToDestination = this.calculateDistance(droneLat, droneLng, destLat, destLng);
    
    // Calculate distance to HQ
    const distanceToHQ = this.calculateDistance(droneLat, droneLng, this.HQlat, this.HQlng);
    
    console.log(`Distance to destination: ${distanceToDestination}m`);
    console.log(`Distance to HQ: ${distanceToHQ}m`);
    
    // Check current state and potential transitions
    switch (this.droneState) {
      case DroneState.DELIVERING:
        // Check if we've reached the destination
        if (distanceToDestination <= this.DESTINATION_THRESHOLD) {
          this.handlePackageDelivered();
        }
        break;
        
      case DroneState.RETURNING:
        // Check if we've returned to HQ
        if (distanceToHQ <= this.DESTINATION_THRESHOLD) {
          this.handleReturnedToHQ();
        }
        break;
    }
  }
  
  /**
   * Handle package delivery completion
   */
  private handlePackageDelivered(): void {
    // Update drone state
    this.droneState = DroneState.DELIVERED;
    this.stateMessage = 'Package delivered! Return to headquarters.';
    this.showStateMessage = true;
    
    // Show notification
    this.showNotification('Package delivered!', 'Package has been successfully delivered to the destination. Time to return to headquarters.');
    
    // After a short delay, transition to RETURNING state
    setTimeout(() => {
      this.droneState = DroneState.RETURNING;
    }, 2000);
  }
  
  /**
   * Handle drone returning to headquarters
   */
  private handleReturnedToHQ(): void {
    // Update drone state
    this.droneState = DroneState.COMPLETED;
    this.stateMessage = 'Mission complete! Drone has returned to headquarters.';
    this.showStateMessage = true;
    
    // Show notification
    this.showNotification('Mission complete!', 'Drone has safely returned to headquarters.');
    
    // Reset drone in database
    this.resetDroneInDatabase();
  }
  
  /**
   * Calculate distance between two coordinates in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in meters
    
    return distance;
  }
  
  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
  
  /**
   * Show notification message
   */
  private showNotification(title: string, message: string): void {
    // You can implement this with a more sophisticated UI notification
    // For now, use browser alert
    alert(`${title}\n\n${message}`);
  }
  
  /**
   * Reset drone in database after mission completion
   */
  private resetDroneInDatabase(): void {
    if (!this.droneDetails) return;
    
    console.log('Resetting drone in database...');
    
    // Update drone with reset values
    this.apiService.callApi('updateDrone', {
      id: this.droneDetails.id,
      is_available: true,
      order_id: null,  // Remove order ID
      latest_latitude: Math.abs(this.HQlat),  // HQ coordinates without negative
      latest_longitude: this.HQlng,
      altitude: 0,
      battery_level: 100  // Reset battery
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          console.log('Drone reset successfully in database:', response.data);
          
          // Update local drone details
          this.droneDetails!.is_available = true;
          this.droneDetails!.order_id = null;
          this.droneDetails!.latest_latitude = Math.abs(this.HQlat);
          this.droneDetails!.latest_longitude = this.HQlng;
          this.droneDetails!.altitude = 0;
          this.droneDetails!.battery_level = 100;
          
          // Disable keyboard controls after mission complete
          this.keyboardEnabled = false;
        } else {
          console.error('Failed to reset drone in database:', response.message);
        }
      },
      error: (err) => {
        console.error('Error resetting drone in database:', err);
      }
    });
  }

  //---------------------------------------------------
  // KEYBOARD CONTROLS
  //---------------------------------------------------
  
  /**
   * Handle keyboard events for drone movement
   */
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Only handle keys if keyboard controls are enabled and mission is not complete
    if (!this.keyboardEnabled || !this.droneDetails || this.droneState === DroneState.COMPLETED) return;
    
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
        } else {
          console.error('Failed to update drone position:', response.message);
        }
      },
      error: (err) => {
        console.error('Error updating drone position:', err);
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
  
  //---------------------------------------------------
  // GETTERS FOR TEMPLATE
  //---------------------------------------------------
  
  /**
   * Get current drone state display text
   */
  getDroneStateText(): string {
    switch (this.droneState) {
      case DroneState.DELIVERING:
        return 'Delivering Package';
      case DroneState.RETURNING:
        return 'Returning to HQ';
      case DroneState.DELIVERED:
        return 'Package Delivered';
      case DroneState.COMPLETED:
        return 'Mission Complete';
      default:
        return 'Unknown';
    }
  }
  
  /**
   * Get CSS class for drone state display
   */
  getDroneStateClass(): string {
    switch (this.droneState) {
      case DroneState.DELIVERING:
        return 'state-delivering';
      case DroneState.RETURNING:
        return 'state-returning';
      case DroneState.DELIVERED:
        return 'state-delivered';
      case DroneState.COMPLETED:
        return 'state-completed';
      default:
        return '';
    }
  }
}