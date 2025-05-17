import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-customer-track',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './customer-track.html',
  styleUrls: ['./customer-track.css']
})
export class CustomerTrack implements OnInit, AfterViewInit, OnDestroy {
  orderId: string | null = null;
  orderDetails: any = null;
  droneDetails: any = null;
  loading = true;
  error = '';
  private map: L.Map | null = null;
  private droneMarker: L.Marker | null = null;
  private destinationMarker: L.Marker | null = null;
  private mapInitialized: boolean = false;
  private updateInterval: any = null;
  
  // Tracking steps for the timeline
  trackingSteps = [
    { name: 'Order Placed', completed: false, timestamp: null as string | null },
    { name: 'Processing', completed: false, timestamp: null as string | null },
    { name: 'Dispatched', completed: false, timestamp: null as string | null },
    { name: 'Out for Delivery', completed: false, timestamp: null as string | null },
    { name: 'Delivered', completed: false, timestamp: null as string | null }
  ];

  // Location coordinates
  // Hatfield, Pretoria coordinates (precise center point)
  hatfieldLat: number = -25.7522;
  hatfieldLng: number = 28.2396;
  private hatfieldCoordinates: L.LatLngExpression = [this.hatfieldLat, this.hatfieldLng];

  // Headquarters coordinates
  HQlat: number = -25.7472;
  HQlng: number = 28.2511;
  private HQCoordinates: L.LatLngExpression = [this.HQlat, this.HQlng];

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.orderId = params.get('orderId');
      if (this.orderId) {
        this.fetchOrderAndDroneData();
        this.startDronePositionUpdates();
      } else {
        this.error = 'Order ID is missing';
        this.loading = false;
      }
    });
  }

  ngAfterViewInit() {
    // Initialize map with a longer delay to ensure DOM is ready
    setTimeout(() => {
      this.initMap();
    }, 500); // Increased from 100ms to 500ms
  }

  ngOnDestroy() {
    // Clean up the map if it exists
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    
    // Clear any intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  private fetchOrderAndDroneData() {
    this.loading = true;
    
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // First fetch order details - CHANGED from getOrderDetails to getOrder
    // Adding customer_id parameter to fix the error
    this.apiService.callApi('getOrder', {
      order_id: this.orderId,
      user_id: currentUser.id || 1,
      user_type: 'Customer',
      customer_id: currentUser.id || 1  // Add customer_id parameter
    }).subscribe({
      next: (response: any) => {
        console.log('API response data:', response);
        
        if (response.success && response.data) {
          this.orderDetails = response.data;
          this.updateTrackingSteps();
          
          // Now fetch drone data
          this.fetchDroneData();
        } else {
          this.loading = false;
          this.error = response.message || 'Failed to load order details';
          console.error('Failed to load order details:', response.message);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error connecting to the server';
        console.error('Error fetching order details:', err);
      }
    });
  }

  private fetchDroneData() {
    this.apiService.callApi('getAllDrones', {}).subscribe({
      next: (dronesResponse: any) => {
        this.loading = false;
        
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
              latest_latitude: parseFloat(foundDrone.latest_latitude) || 0,
              latest_longitude: parseFloat(foundDrone.latest_longitude) || 0,
              battery_level: parseInt(foundDrone.battery_level) || 0
            };
            
            // If map is already initialized, update it with drone position
            if (this.mapInitialized && this.map) {
              this.updateMapWithDroneAndDestination();
            }
          }
        } else {
          console.error('Failed to load drones:', dronesResponse.message);
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading drones:', err);
      }
    });
  }

  private updateTrackingSteps() {
    if (!this.orderDetails || !this.orderDetails.state) return;

    const status = this.orderDetails.state.toLowerCase();
    
    // Update tracking steps based on order state
    if (status === 'placed' || status === 'pending') {
      this.trackingSteps[0].completed = true;
      this.trackingSteps[0].timestamp = this.orderDetails.created_at || new Date().toISOString();
    } else if (status === 'processing') {
      this.trackingSteps[0].completed = true;
      this.trackingSteps[1].completed = true;
      this.trackingSteps[0].timestamp = this.orderDetails.created_at || new Date().toISOString();
      this.trackingSteps[1].timestamp = this.orderDetails.updated_at || new Date().toISOString();
    } else if (status === 'dispatched') {
      this.trackingSteps[0].completed = this.trackingSteps[1].completed = this.trackingSteps[2].completed = true;
      this.trackingSteps[0].timestamp = this.orderDetails.created_at || new Date().toISOString();
      this.trackingSteps[1].timestamp = this.orderDetails.processing_time || new Date().toISOString();
      this.trackingSteps[2].timestamp = this.orderDetails.dispatch_time || this.orderDetails.updated_at || new Date().toISOString();
    } else if (status === 'shipping' || status === 'out for delivery') {
      this.trackingSteps[0].completed = this.trackingSteps[1].completed = this.trackingSteps[2].completed = this.trackingSteps[3].completed = true;
      this.trackingSteps[0].timestamp = this.orderDetails.created_at || new Date().toISOString();
      this.trackingSteps[1].timestamp = this.orderDetails.processing_time || new Date().toISOString();
      this.trackingSteps[2].timestamp = this.orderDetails.dispatch_time || new Date().toISOString();
      this.trackingSteps[3].timestamp = this.orderDetails.shipping_time || this.orderDetails.updated_at || new Date().toISOString();
    } else if (status === 'delivered' || status === 'completed') {
      this.trackingSteps.forEach(step => step.completed = true);
      this.trackingSteps[0].timestamp = this.orderDetails.created_at || new Date().toISOString();
      this.trackingSteps[1].timestamp = this.orderDetails.processing_time || new Date().toISOString();
      this.trackingSteps[2].timestamp = this.orderDetails.dispatch_time || new Date().toISOString();
      this.trackingSteps[3].timestamp = this.orderDetails.shipping_time || new Date().toISOString();
      this.trackingSteps[4].timestamp = new Date().toISOString();
    }
  }

  private initMap(): void {
    try {
      console.log('Initializing map');
      
      // Check if map container exists
      const mapElement = document.getElementById('customer-map');
      if (!mapElement) {
        console.error('Map container element not found');
        // Try again after a short delay if element isn't found
        setTimeout(() => this.initMap(), 1000);
        return;
      }
      
      console.log('Map container found, creating Leaflet map');
      
      // Create the map instance centered on HQ coordinates
      this.map = L.map('customer-map').setView(this.HQCoordinates, 14);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      // Add headquarters marker
      this.addHeadquartersMarker();
      
      // Add 5km operational radius circle
      this.addOperationalRadiusCircle();
      
      // Add drone and destination markers if we have the data
      if (this.droneDetails && this.orderDetails) {
        this.updateMapWithDroneAndDestination();
      }
      
      // Mark map as initialized
      this.mapInitialized = true;
      console.log('Map initialization complete');
      
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

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

  private updateMapWithDroneAndDestination(): void {
    if (!this.map || !this.droneDetails || !this.orderDetails) return;

    try {
      // Add destination marker if we have destination coordinates
      if (this.orderDetails.destination_latitude && this.orderDetails.destination_longitude) {
        // Get destination coordinates
        const destCoords: L.LatLngExpression = [
          -Math.abs(parseFloat(this.orderDetails.destination_latitude)),
          parseFloat(this.orderDetails.destination_longitude)
        ];
        
        // Custom destination icon with red color
        const destinationIcon = L.divIcon({
          className: 'destination-marker',
          html: '<div style="background-color:#FF5722; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        
        // Add or update destination marker
        if (this.destinationMarker) {
          this.destinationMarker.setLatLng(destCoords);
        } else {
          this.destinationMarker = L.marker(destCoords, { icon: destinationIcon })
            .addTo(this.map)
            .bindPopup('Delivery Destination');
        }
        
        console.log(`Destination marker added at: ${destCoords}`);
      }
      
      // Add or update drone marker
      const droneCoords: L.LatLngExpression = [
        -Math.abs(this.droneDetails.latest_latitude),
        this.droneDetails.latest_longitude
      ];
      
      // Create drone icon
      const droneIcon = L.divIcon({
        className: 'drone-marker',
        html: '<div style="background-color:#2196F3; width:10px; height:10px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      
      if (this.droneMarker) {
        this.droneMarker.setLatLng(droneCoords);
      } else {
        this.droneMarker = L.marker(droneCoords, { icon: droneIcon })
          .addTo(this.map)
          .bindPopup('Delivery Drone');
      }
      
      console.log(`Drone marker added at: ${droneCoords}`);
      
      // Calculate bounds to include all points
      const points = [
        this.HQCoordinates
      ];
      
      // Add destination and drone coords if they exist
      if (this.destinationMarker) {
        points.push(this.destinationMarker.getLatLng());
      }
      
      if (this.droneMarker) {
        points.push(this.droneMarker.getLatLng());
      }
      
      // Create bounds and fit map to them
      const bounds = L.latLngBounds(points);
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      
    } catch (error) {
      console.error('Error updating map with drone and destination:', error);
    }
  }

  // Start periodic updates of drone position (every 30 seconds)
  startDronePositionUpdates(): void {
    this.updateInterval = setInterval(() => {
      if (this.orderId) {
        this.fetchDroneData();
      }
    }, 30000); // 30 seconds
  }
}