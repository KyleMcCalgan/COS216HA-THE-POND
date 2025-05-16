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
            
            // Update or initialize the map with drone marker
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
    // Only handle keys if keyboard controls are enabled
    if (!this.keyboardEnabled || !this.droneDetails) return;
    
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
}