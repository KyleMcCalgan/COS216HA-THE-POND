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
  private hqMarker: L.Marker | null = null;
  private mapInitialized: boolean = false;
  private updateInterval: any = null;
  
  // HQ coordinates
  private readonly HQ_LAT = 25.7472;
  private readonly HQ_LNG = 28.2511;
  private readonly HQ_COORDINATES: L.LatLngExpression = [-25.7472, 28.2511];

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.orderId = params.get('orderId');
      if (this.orderId) {
        this.fetchOrderDetails();
        this.startPeriodicUpdates();
      } else {
        this.error = 'Order ID is missing';
        this.loading = false;
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initMap();
    }, 500);
  }

  ngOnDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private fetchOrderDetails() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    this.apiService.callApi('getOrder', {
      order_id: this.orderId,
      customer_id: currentUser.id,
      user_id: currentUser.id,
      user_type: 'Customer'
    }).subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.orderDetails = response.data;
          this.fetchDroneData();
        } else {
          this.loading = false;
          this.error = response.message || 'Failed to load order details';
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
      next: (response: any) => {
        this.loading = false;
        
        if (response.success && response.data) {
          // Find drone assigned to this order
          const assignedDrone = response.data.find((drone: any) => {
            const droneOrderId = drone.order_id || drone.Order_ID;
            return droneOrderId == this.orderId;
          });
          
          if (assignedDrone) {
            // Convert latitude to negative (southern hemisphere)
            const lat = parseFloat(assignedDrone.latest_latitude);
            this.droneDetails = {
              id: assignedDrone.id,
              latest_latitude: lat > 0 ? -lat : lat,
              latest_longitude: parseFloat(assignedDrone.latest_longitude),
              battery_level: assignedDrone.battery_level,
              altitude: assignedDrone.altitude,
              is_available: assignedDrone.is_available
            };
          } else {
            // Check for returning drones (might have delivered this order)
            const returningDrones = response.data.filter((drone: any) => {
              const droneOrderId = drone.order_id || drone.Order_ID;
              return !drone.is_available && !droneOrderId;
            });
            
            if (returningDrones.length > 0) {
              const drone = returningDrones[0];
              const lat = parseFloat(drone.latest_latitude);
              this.droneDetails = {
                id: drone.id,
                latest_latitude: lat > 0 ? -lat : lat,
                latest_longitude: parseFloat(drone.latest_longitude),
                battery_level: drone.battery_level,
                altitude: drone.altitude,
                is_available: drone.is_available,
                returning: true
              };
            }
          }
          
          if (this.mapInitialized) {
            this.updateMapMarkers();
          }
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error fetching drone data:', err);
      }
    });
  }

  private startPeriodicUpdates() {
    this.updateInterval = setInterval(() => {
      if (this.orderId) {
        this.fetchDroneData();
      }
    }, 30000); // Update every 30 seconds
  }

  private initMap(): void {
    try {
      const mapElement = document.getElementById('customer-map');
      if (!mapElement) {
        console.error('Map container not found');
        return;
      }

      this.map = L.map('customer-map').setView(this.HQ_COORDINATES, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      // Add operational radius circle
      L.circle(this.HQ_COORDINATES, {
        radius: 5000,
        color: '#3E1314',
        weight: 2,
        fill: false,
        dashArray: '5, 10'
      }).addTo(this.map);

      this.updateMapMarkers();
      this.mapInitialized = true;
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private updateMapMarkers(): void {
    if (!this.map) return;

    // Add/update HQ marker
    if (!this.hqMarker) {
      const hqIcon = L.divIcon({
        className: 'hq-marker',
        html: '<div style="background-color: #4D9948; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      
      this.hqMarker = L.marker(this.HQ_COORDINATES, { icon: hqIcon })
        .addTo(this.map)
        .bindPopup('Courier Headquarters');
    }

    // Add/update destination marker
    if (this.orderDetails && !this.destinationMarker) {
      const destLat = parseFloat(this.orderDetails.destination_latitude);
      const destLng = parseFloat(this.orderDetails.destination_longitude);
      const destCoords: L.LatLngExpression = [
        destLat > 0 ? -destLat : destLat,
        destLng
      ];
      
      const destIcon = L.divIcon({
        className: 'destination-marker',
        html: '<div style="background-color: #FF5722; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      
      this.destinationMarker = L.marker(destCoords, { icon: destIcon })
        .addTo(this.map)
        .bindPopup('Delivery Destination');
    }

    // Add/update drone marker
    if (this.droneDetails) {
      const droneCoords: L.LatLngExpression = [
        this.droneDetails.latest_latitude,
        this.droneDetails.latest_longitude
      ];
      
      // Try to use custom drone image, fallback to icon if image fails
      let droneIcon: L.Icon | L.DivIcon;
      try {
        droneIcon = L.icon({
          iconUrl: 'assets/drone-icon.png',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });
      } catch (e) {
        // Fallback to div icon if image fails to load
        droneIcon = L.divIcon({
          className: 'drone-marker',
          html: '<div style="background-color: #2196F3; width: 12px; height: 12px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
      }
      
      if (this.droneMarker) {
        this.droneMarker.setLatLng(droneCoords);
        this.droneMarker.setIcon(droneIcon);
      } else {
        this.droneMarker = L.marker(droneCoords, { icon: droneIcon })
          .addTo(this.map)
          .bindPopup(`Delivery Drone #${this.droneDetails.id}`);
      }
      
      // Fit map to show all markers
      const group = new L.FeatureGroup();
      if (this.hqMarker) group.addLayer(this.hqMarker);
      if (this.destinationMarker) group.addLayer(this.destinationMarker);
      if (this.droneMarker) group.addLayer(this.droneMarker);
      
      if (group.getLayers().length > 0) {
        this.map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }

  getOrderStatus(): string {
    if (!this.orderDetails) return 'Loading...';
    
    const state = this.orderDetails.state?.toLowerCase();
    switch (state) {
      case 'storage': return 'Order Confirmed';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      default: return this.orderDetails.state || 'Unknown';
    }
  }

  getOrderStatusClass(): string {
    if (!this.orderDetails) return '';
    
    const state = this.orderDetails.state?.toLowerCase();
    switch (state) {
      case 'storage': return 'status-pending';
      case 'out_for_delivery': return 'status-delivering';
      case 'delivered': return 'status-delivered';
      default: return '';
    }
  }

  getDroneStatus(): string {
    if (!this.droneDetails) return 'No drone assigned';
    
    if (this.droneDetails.returning) {
      return 'Returning to headquarters';
    }
    
    if (this.droneDetails.is_available) {
      return 'Preparing for delivery';
    } else {
      return 'En route to destination';
    }
  }

  getEstimatedDelivery(): string {
    if (!this.orderDetails) return 'N/A';
    
    const state = this.orderDetails.state?.toLowerCase();
    switch (state) {
      case 'storage': return 'Waiting for dispatch';
      case 'out_for_delivery': return '10-15 minutes';
      case 'delivered': return 'Delivered';
      default: return 'Unknown';
    }
  }

  getDroneDistance(): string {
    if (!this.droneDetails || !this.orderDetails) return 'N/A';
    
    const droneLat = this.droneDetails.latest_latitude;
    const droneLng = this.droneDetails.latest_longitude;
    const destLat = parseFloat(this.orderDetails.destination_latitude);
    const destLng = parseFloat(this.orderDetails.destination_longitude);
    
    // Convert destination to negative if needed (southern hemisphere)
    const adjustedDestLat = destLat > 0 ? -destLat : destLat;
    
    const distance = this.calculateDistance(droneLat, droneLng, adjustedDestLat, destLng);
    
    if (distance < 1000) {
      return `${Math.round(distance)}m away`;
    } else {
      return `${(distance / 1000).toFixed(1)}km away`;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  formatProducts(): string {
    if (!this.orderDetails?.products) return 'No products';
    
    return this.orderDetails.products.map((p: any) => {
      if (p.title) {
        return `${p.title} (${p.quantity || 1}x)`;
      }
      return `Product (${p.quantity || 1}x)`;
    }).join(', ');
  }
}