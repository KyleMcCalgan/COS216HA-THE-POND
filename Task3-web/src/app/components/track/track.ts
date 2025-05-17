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
  private batteryDepletionInterval: any = null; // New interval for battery depletion
  private errorMessage: string | null = null;

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
    // Get order ID from route parameters
    this.orderId = this.route.snapshot.paramMap.get('orderId');
    
    if (!this.orderId) {
      this.errorMessage = 'No order ID provided';
      console.error(this.errorMessage);
      return;
    }

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
            this.errorMessage = `Order with ID ${this.orderId} not found`;
            console.error(this.errorMessage);
            this.isLoading = false;
          }
        } else {
          this.errorMessage = 'Failed to load orders: ' + (ordersResponse.message || 'Unknown error');
          console.error(this.errorMessage);
          this.isLoading = false;
        }
      },
      error: (err) => {
        this.errorMessage = 'Error loading orders: ' + err.message;
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
    
    // Convert latitude to negative for southern hemisphere
    const rawLatitude = parseFloat(orderData.destination_latitude) || 0;
    const adjustedLatitude = rawLatitude > 0 ? -rawLatitude : rawLatitude;
    
    // Create order details object
    this.orderDetails = {
      orderId: this.orderId || '0',
      products: productsList,
      customer: orderData.customer?.username || `Customer #${orderData.customer_id}`,
      customerId: orderData.customer_id,
      trackingNum: orderData.tracking_num || 'Unknown',
      destination: {
        latitude: adjustedLatitude,
        longitude: parseFloat(orderData.destination_longitude) || 0
      },
      droneId: 0 // Will be updated when we find the drone
    };
    
    console.log('Processed order details with adjusted latitude:', this.orderDetails);
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
            // Convert latitude to negative for southern hemisphere
            const rawLatitude = parseFloat(foundDrone.latest_latitude) || 0;
            const adjustedLatitude = rawLatitude > 0 ? -rawLatitude : rawLatitude;
            
            this.droneDetails = {
              id: parseInt(foundDrone.id),
              is_available: foundDrone.is_available === true,
              latest_latitude: adjustedLatitude,
              latest_longitude: parseFloat(foundDrone.latest_longitude) || 0,
              altitude: parseFloat(foundDrone.altitude) || 0,
              battery_level: parseInt(foundDrone.battery_level) || 100, // Default to 100% if not provided
              current_operator_id: foundDrone.current_operator_id,
              order_id: foundDrone.order_id || foundDrone.Order_ID
            };
            
            // Update order details with drone ID
            if (this.orderDetails) {
              this.orderDetails.droneId = this.droneDetails.id;
            }
            
            // Start battery depletion if the drone is in use
            this.startBatteryDepletion();
            
            // Determine if drone is delivering or returning
            this.determineDroneState();
            
            // Update drone coordinates
            this.updateDroneCoordinates();
            
            // Update or initialize the map with drone marker
            this.updateMapWithDronePosition();
            
            // Enable keyboard controls if the drone is not returning, delivered, or completed
            this.keyboardEnabled = this.droneState === 'delivering' || this.droneState === 'returning';
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
            if (returningDrones.length > 0) {
              const returningDrone = returningDrones[0];
              
              // Convert latitude to negative for southern hemisphere
              const rawLatitude = parseFloat(returningDrone.latest_latitude) || 0;
              const adjustedLatitude = rawLatitude > 0 ? -rawLatitude : rawLatitude;
              
              this.droneDetails = {
                id: parseInt(returningDrone.id),
                is_available: returningDrone.is_available === true,
                latest_latitude: adjustedLatitude,
                latest_longitude: parseFloat(returningDrone.latest_longitude) || 0,
                altitude: parseFloat(returningDrone.altitude) || 0,
                battery_level: parseInt(returningDrone.battery_level) || 100, // Default to 100% if not provided
                current_operator_id: returningDrone.current_operator_id,
                order_id: null
              };
              
              // Update order details with drone ID
              if (this.orderDetails) {
                this.orderDetails.droneId = this.droneDetails.id;
              }
              
              // Start battery depletion if the drone is in use
              this.startBatteryDepletion();
              
              // Set state to returning
              this.droneState = 'returning';
              
              // Update drone coordinates
              this.updateDroneCoordinates();
              
              // Update or initialize the map with drone marker
              this.updateMapWithDronePosition();
              
              // Enable keyboard controls for returning drone
              this.keyboardEnabled = true;
            } else {
              this.errorMessage = 'No drone found for this order, and no returning drones';
              console.error(this.errorMessage);
            }
          }
        } else {
          this.errorMessage = 'Failed to load drones: ' + (dronesResponse.message || 'Unknown error');
          console.error(this.errorMessage);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Error loading drones: ' + err.message;
        console.error('Error loading drones:', err);
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
    if (this.droneDetails && (this.droneState === 'delivering' || this.droneState === 'returning')) {
      this.batteryDepletionInterval = setInterval(() => {
        if (this.droneDetails && this.droneDetails.battery_level > 0) {
          this.droneDetails.battery_level -= 1;
          if (this.droneDetails.battery_level <= 0) {
            this.droneDetails.battery_level = 0;
            this.keyboardEnabled = false; // Disable movement if battery is depleted
            clearInterval(this.batteryDepletionInterval);
            this.errorMessage = 'Drone battery depleted. Please return to HQ.';
            console.warn(this.errorMessage);
          }
          this.updateDroneInDatabase(this.droneDetails.latest_latitude, this.droneDetails.latest_longitude);
        }
      }, this.BATTERY_DEPLETION_INTERVAL_MS);
    }
  }

  /**
   * Determine the drone's state based on its properties
   */
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
    if (isAtHQ && !isDroneAssignedToOrder) {
      // Drone is at HQ with no order -> completed
      this.droneState = 'completed';
      this.keyboardEnabled = false;
      if (this.batteryDepletionInterval) {
        clearInterval(this.batteryDepletionInterval);
      }
    } else if (!isDroneAssignedToOrder && !isDroneAvailable && isAtDestination) {
      // Drone is at destination, no order, not available -> delivered
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
      case 'returning': return 'Drone has already delivered the package';
      case 'delivered': return 'Package has been delivered';
      case 'completed': return 'Mission completed';
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
      if (this.orderDetails && this.orderDetails.destination) {
        this.addDestinationMarker();
      }
      if (this.droneDetails) {
        this.addDroneMarker();
      }
      
      this.mapInitialized = true;
      console.log('Map initialization complete');
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
        html: '<div style="background-color: red; width: 20px; height: 20px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      
      L.marker(hqLatLng as L.LatLngExpression, { icon: customHQIcon })
        .addTo(this.map)
        .bindPopup('Headquarters');
      
      L.circle(hqLatLng as L.LatLngExpression, {
        radius: 200,
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
      this.updateDroneCoordinates();
      if (this.droneMarker) {
        this.droneMarker.setLatLng(this.droneCoordinates);
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
    if (!this.keyboardEnabled || !this.droneDetails || 
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
    
    console.log(`Moving drone to: ${newLatitude}, ${newLongitude}`);
    this.updateDroneInDatabase(newLatitude, newLongitude);
  }

  /**
   * Update drone position in the database
   */
  private updateDroneInDatabase(latitude: number, longitude: number): void {
    if (!this.droneDetails) return;
    // Ensure latitude is negative when sending to the database (convert back to positive for API)
    const apiLatitude = latitude < 0 ? -latitude : latitude;
    
    this.apiService.callApi('updateDrone', {
      id: this.droneDetails.id,
      latest_latitude: apiLatitude,
      latest_longitude: longitude,
      altitude: this.droneDetails.altitude,
      battery_level: this.droneDetails.battery_level,
      is_available: this.droneDetails.is_available
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
          
          if (this.droneState === 'delivering' && this.orderDetails) {
            if (this.isAtDestination(
              adjustedLatitude, 
              longitude, 
              this.orderDetails.destination.latitude, 
              this.orderDetails.destination.longitude
            )) {
              this.handleDeliveryCompleted();
            }
          } else if (this.droneState === 'returning') {
            if (this.isAtHQ(adjustedLatitude, longitude)) {
              console.log('Drone has reached HQ! Completing return process...');
              this.handleReturnCompleted();
            } else {
              const latDiff = Math.abs(adjustedLatitude - this.HQlat);
              const lngDiff = Math.abs(longitude - this.HQlng);
              console.log(`Distance to HQ: lat=${latDiff}, lng=${lngDiff}`);
            }
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
    if (!this.droneDetails || !this.orderDetails) return;
    
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
            this.droneState = 'returning';
            this.keyboardEnabled = true;
            console.log('Drone state changed to: returning');
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

  /**
   * Handle when the drone arrives back at HQ
   */
  private handleReturnCompleted(): void {
    if (!this.droneDetails) return;
    
    window.alert('Drone has returned to headquarters successfully!');
    this.droneState = 'completed';
    this.keyboardEnabled = false;
    
    // Stop periodic updates
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
   * Navigate back to dispatched orders view
   */
  returnToDispatched() {
    this.router.navigate(['/operator/dispatched-orders']);
  }
}