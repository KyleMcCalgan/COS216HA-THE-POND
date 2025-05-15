// src/app/components/dispatch/dispatch.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Drone {
  id: number;
  isAvailable: boolean;
  batteryLevel: number;
  operator: string;
}

@Component({
  selector: 'app-dispatch',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dispatch.html',
  styleUrls: ['./dispatch.css']
})
export class Dispatch implements OnInit {
  orderId: string | null = null;
  orderDetails: { orderId: string; products: string[]; status: string } | null = null;
  availableDrones: Drone[] = [];
  selectedDroneId: number | null = null;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.orderId = this.route.snapshot.paramMap.get('orderId');
    this.orderDetails = {
      orderId: this.orderId || 'Unknown',
      products: ['Placeholder Product'],
      status: 'Storage'
    };
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
    alert(`Order ${this.orderId} dispatched with Drone ${this.selectedDroneId}`);
    if (this.orderDetails) {
      this.orderDetails.status = 'Out_for_delivery';
    }
    const selectedDrone = this.availableDrones.find(drone => drone.id === this.selectedDroneId);
    if (selectedDrone) {
      selectedDrone.isAvailable = false;
    }
    this.router.navigate(['/operator']);
  }

  cancel() {
    this.router.navigate(['/operator']);
  }
}