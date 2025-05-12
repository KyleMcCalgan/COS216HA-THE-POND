// src/app/components/dispatch/dispatch.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // For ngModel

interface Drone {
  id: number;
  isAvailable: boolean;
  batteryLevel: number;
  operator: string;
}

@Component({
  selector: 'app-dispatch',
  standalone: true,
  imports: [CommonModule, FormsModule], // Add FormsModule for ngModel
  templateUrl: './dispatch.html',
  styleUrls: ['./dispatch.css']
})
export class DispatchComponent implements OnInit {
  orderId: string | null = null;
  orderDetails: { orderId: string; products: string[]; status: string } | null = null;
  availableDrones: Drone[] = []; // Placeholder for available drones
  selectedDroneId: number | null = null; // To store the selected drone ID

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.orderId = this.route.snapshot.paramMap.get('orderId');
    // Placeholder order details (to be fetched from API later)
    this.orderDetails = {
      orderId: this.orderId || 'Unknown',
      products: ['Placeholder Product'],
      status: 'Storage'
    };

    // Placeholder available drones (to be fetched from API later)
    this.availableDrones = [
      { id: 1, isAvailable: true, batteryLevel: 80, operator: 'JohnDoe' },
      { id: 2, isAvailable: true, batteryLevel: 65, operator: 'JaneDoe' },
      { id: 3, isAvailable: false, batteryLevel: 40, operator: 'SamSmith' }
    ];
  }

  dispatchOrder() {
    if (this.selectedDroneId === null) {
      alert('Please select a drone to dispatch the order.');
      return;
    }

    // Placeholder logic for dispatching (to be replaced with API call)
    alert(`Order ${this.orderId} dispatched with Drone ${this.selectedDroneId}`);
    
    // Update the order status (in a real app, this would be an API call)
    if (this.orderDetails) {
      this.orderDetails.status = 'Out_for_delivery';
    }

    // Update drone availability (in a real app, this would be an API call)
    const selectedDrone = this.availableDrones.find(drone => drone.id === this.selectedDroneId);
    if (selectedDrone) {
      selectedDrone.isAvailable = false;
    }

    // Navigate back to the Operator Dashboard
    this.router.navigate(['/operator']);
  }

  cancel() {
    this.router.navigate(['/operator']);
  }
}