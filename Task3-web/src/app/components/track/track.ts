import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

/**
 * Interface for Order Details
 */
interface OrderDetails {
  products: string[];
  customer: string;
  destination: { latitude: number; longitude: number };
  droneId: number;
}

@Component({
  selector: 'app-track',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './track.html',
  styleUrls: ['./track.css']
})
export class Track implements OnInit, AfterViewInit {
  //---------------------------------------------------
  // PROPERTIES
  //---------------------------------------------------
  orderId: string | null = null;
  orderDetails: OrderDetails | null = null;
  private map!: L.Map;
  private droneMarker: L.Marker | null = null;
  private destinationMarker: L.Marker | null = null;

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

  // Mocked drone coordinates (to be replaced with API data)
  private droneCoordinates: L.LatLngExpression = [-25.7470, 28.2295];

  //---------------------------------------------------
  // CONSTRUCTOR & LIFECYCLE HOOKS
  //---------------------------------------------------
  constructor(private route: ActivatedRoute, private router: Router) {}

  /**
   * Initialize component and load order data
   */
  ngOnInit() {
    // Get order ID from route parameters
    this.orderId = this.route.snapshot.paramMap.get('orderId');
    
    // Mock order details (will be replaced with API call)
    this.orderDetails = {
      products: ['Laptop', 'Mouse'],
      customer: 'John Doe',
      destination: { 
        latitude: -25.7522, 
        longitude: 28.2396
      },
      droneId: 1
    };
  }

  /**
   * Initialize map after view has been initialized
   */
  ngAfterViewInit() {
    this.initMap();
  }

  //---------------------------------------------------
  // MAP INITIALIZATION
  //---------------------------------------------------
  /**
   * Initialize the Leaflet map with markers and boundaries
   */
  private initMap(): void {
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
    
    // Add drone marker
    this.addDroneMarker();
    
    // Add destination marker if order details exist
    if (this.orderDetails && this.orderDetails.destination) {
      this.addDestinationMarker();
    }
  }

  //---------------------------------------------------
  // MARKER CREATION METHODS
  //---------------------------------------------------

  /**
   * Add headquarters marker to the map
   */
  private addHeadquartersMarker(): void {
    const headquartersMarker = L.marker([this.HQlat, this.HQlng])
      .addTo(this.map)
      .bindPopup('Headquarters');
  }

  /**
   * Add 5km operational radius circle around HQ
   */
  private addOperationalRadiusCircle(): void {
    const radiusInMeters = 5000;
    const circle = L.circle(this.HQCoordinates, {
      radius: radiusInMeters,
      color: '#3E1314',
      weight: 2,
      fill: false,
      dashArray: '5, 10'
    }).addTo(this.map);
  }

  /**
   * Add drone marker to the map
   */
  private addDroneMarker(): void {
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
  }

  /**
   * Add destination marker with custom color
   */
  private addDestinationMarker(): void {
    if (!this.orderDetails || !this.orderDetails.destination) return;
    
    // Get destination coordinates
    const destCoords: L.LatLngExpression = [
      this.orderDetails.destination.latitude,
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
    
    // Calculate bounds to include all points
    const bounds = L.latLngBounds([
      this.HQCoordinates, 
      this.hatfieldCoordinates, 
      this.droneCoordinates, 
      destCoords
    ]);

    // First fit bounds to see all markers
    this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });

    // Then explicitly set the view back to HQ with a slight delay to ensure it takes effect
    setTimeout(() => {
      this.map.setView(this.HQCoordinates, 14);
    }, 100);
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