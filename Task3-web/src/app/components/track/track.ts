// src/app/components/track/track.component.ts
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
export class TrackComponent implements OnInit, AfterViewInit {
  orderId: string | null = null;
  orderDetails: OrderDetails | null = null;
  private map!: L.Map;
  private droneMarker: L.Marker | null = null;
  private destinationMarker: L.Marker | null = null;

  // Hatfield, Pretoria coordinates (precise center point)
  hatfieldLat: number = -25.7522; // Making this public so template can access it
  hatfieldLng: number = 28.2396; // Making this public so template can access it
  private hatfieldCoordinates: L.LatLngExpression = [this.hatfieldLat, this.hatfieldLng]; // Corner of Burnett St & Festival St in Hatfield

  // Mocked drone coordinates (near Hatfield Gautrain station)
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
        longitude: 28.2396 // University of Pretoria
      },
      droneId: 1
    };
  }

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap(): void {
    // Create the map instance
    this.map = L.map('map').setView(this.hatfieldCoordinates, 14);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Add a marker for the operation center in Hatfield
    const operationCenterMarker = L.marker([this.hatfieldLat, this.hatfieldLng], {
      icon: L.divIcon({
        className: 'operation-center-marker',
        html: '<div class="center-point"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    }).addTo(this.map);
    operationCenterMarker.bindPopup('Operation Center: Hatfield');

    // Add a 5km radius circle around Hatfield
    const radiusInMeters = 5000; // 5km radius
    const circle = L.circle([this.hatfieldLat, this.hatfieldLng], {
      radius: radiusInMeters,
      color: '#3E1314',
      weight: 2,
      fill: false,
      dashArray: '5, 10'
    }).addTo(this.map);

    // Add label for the circle
    const circleLabel = L.marker([this.hatfieldLat, this.hatfieldLng + 0.02], {
      icon: L.divIcon({
        className: 'radius-label',
        html: '<div>5km Operation Range</div>',
        iconSize: [120, 20],
        iconAnchor: [60, 10]
      })
    }).addTo(this.map);

    // Add drone marker with custom icon
    const droneIcon = L.icon({
      iconUrl: 'assets/drone-icon.png',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });

    // Fallback to default marker if icon loading fails
    this.droneMarker = L.marker(this.droneCoordinates, {
      icon: droneIcon,
      alt: 'Drone'
    }).addTo(this.map);
    
    this.droneMarker.bindPopup(`Drone ${this.orderDetails?.droneId || 'Unknown'}`);

    // Add destination marker
    if (this.orderDetails && this.orderDetails.destination) {
      const destCoords: L.LatLngExpression = [
        this.orderDetails.destination.latitude,
        this.orderDetails.destination.longitude
      ];
      
      this.destinationMarker = L.marker(destCoords)
        .addTo(this.map)
        .bindPopup('Delivery Destination');

      // Draw a path from drone to destination
      const path = L.polyline([this.droneCoordinates, destCoords], {
        color: '#4D9948',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 10'
      }).addTo(this.map);

      // Fit map to show both points and include the radius circle
      const bounds = L.latLngBounds([this.droneCoordinates, destCoords]);
      
      // Extend the bounds to include points on the circle edge (5km in each direction)
      const circleEdgeNorth = L.latLng(
        this.hatfieldLat + 0.045, // Approximate 5km in latitude
        this.hatfieldLng
      );
      const circleEdgeSouth = L.latLng(
        this.hatfieldLat - 0.045, // Approximate 5km in latitude
        this.hatfieldLng
      );
      const circleEdgeEast = L.latLng(
        this.hatfieldLat,
        this.hatfieldLng + 0.045 // Approximate 5km in longitude
      );
      const circleEdgeWest = L.latLng(
        this.hatfieldLat,
        this.hatfieldLng - 0.045 // Approximate 5km in longitude
      );
      
      bounds.extend(circleEdgeNorth);
      bounds.extend(circleEdgeSouth);
      bounds.extend(circleEdgeEast);
      bounds.extend(circleEdgeWest);
      
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  // Simulate drone movement (for demo purposes)
  simulateDroneMovement() {
    if (!this.droneMarker || !this.orderDetails) return;
    
    const targetLat = this.orderDetails.destination.latitude;
    const targetLng = this.orderDetails.destination.longitude;
    const currentPos = this.droneMarker.getLatLng();
    
    // Move drone 10% closer to destination
    const newLat = currentPos.lat + (targetLat - currentPos.lat) * 0.1;
    const newLng = currentPos.lng + (targetLng - currentPos.lng) * 0.1;
    
    this.droneMarker.setLatLng([newLat, newLng]);
  }

  returnToDispatched() {
    this.router.navigate(['/operator/dispatched-orders']);
  }

  checkBattery() {
    // Mock battery check - would come from API
    const batteryLevel = Math.floor(Math.random() * 41) + 60; // 60-100%
    alert(`Drone ${this.orderDetails?.droneId} Battery Status: ${batteryLevel}%`);
  }

  stopOrder() {
    // Would send API request to mark order as delivered
    alert(`Order ${this.orderId} marked as delivered`);
    this.router.navigate(['/operator/dispatched-orders']);
  }

  // Move drone when button is clicked (for demo)
  moveDrone() {
    this.simulateDroneMovement();
  }
}