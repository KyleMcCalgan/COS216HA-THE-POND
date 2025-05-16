import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

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
  orderId: string | null = null;
  orderDetails: OrderDetails | null = null;
  private map!: L.Map;
  private droneMarker: L.Marker | null = null;
  private destinationMarker: L.Marker | null = null;

  // Hatfield, Pretoria coordinates (precise center point)
  hatfieldLat: number = -25.7522;
  hatfieldLng: number = 28.2396;
  private hatfieldCoordinates: L.LatLngExpression = [this.hatfieldLat, this.hatfieldLng];

  HQlat: number = -25.7472;
  HQlng: number = 28.2511;
  private HQCoordinates: L.LatLngExpression = [this.HQlat, this.HQlng];

  // Mocked drone coordinates need to change to API
  private droneCoordinates: L.LatLngExpression = [-25.7470, 28.2295];

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
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

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap(): void {
    // Create the map instance centered on HQ coordinates
    this.map = L.map('map').setView(this.HQCoordinates, 14);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Add a marker for the operation center in Hatfield
    const operationCenterMarker = L.marker([this.hatfieldLat, this.hatfieldLng])
      .addTo(this.map)
      .bindPopup('Operation Center: Hatfield');

    // Add a marker for the headquarters
    const headquartersMarker = L.marker([this.HQlat, this.HQlng])
      .addTo(this.map)
      .bindPopup('Headquarters');

    // Add a 5km radius circle around Headquarters
    const radiusInMeters = 5000;
    const circle = L.circle(this.HQCoordinates, {
      radius: radiusInMeters,
      color: '#3E1314',
      weight: 2,
      fill: false,
      dashArray: '5, 10'
    }).addTo(this.map);

    // Add drone marker with custom icon or fallback
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

    // Add destination marker
    if (this.orderDetails && this.orderDetails.destination) {
      const destCoords: L.LatLngExpression = [
        this.orderDetails.destination.latitude,
        this.orderDetails.destination.longitude
      ];
      this.destinationMarker = L.marker(destCoords)
        .addTo(this.map)
        .bindPopup('Delivery Destination');

      // Fit bounds to show all markers, but enforce HQ center afterward
      const bounds = L.latLngBounds([this.HQCoordinates, this.hatfieldCoordinates, this.droneCoordinates, destCoords]);
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      // Explicitly set the center back to HQ to override fitBounds adjustment
      this.map.setView(this.HQCoordinates, 14);
    }
  }

  returnToDispatched() {
    this.router.navigate(['/operator/dispatched-orders']);
  }
}