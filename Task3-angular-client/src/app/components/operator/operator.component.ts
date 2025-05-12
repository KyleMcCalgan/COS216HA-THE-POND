// src/app/components/operator/operator.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-operator',
  standalone: true,
  templateUrl: './operator.html',
  styleUrls: ['./operator.css']
})
export class OperatorComponent {
  // Placeholder for drones and orders (to be fetched from API later)
  drones = [
    { id: 1, isAvailable: true, batteryLevel: 100, operator: null },
    { id: 2, isAvailable: false, batteryLevel: 60, operator: 'JohnDoe' }
  ];

  orders = [
    { orderId: 'CS-1234567890', products: ['Book', 'Pen'], status: 'Storage' },
    { orderId: 'CS-0987654321', products: ['Laptop Charger'], status: 'Storage' }
  ];

  selectDrone(droneId: number) {
    alert(`Drone ${droneId} selected`);
    // Later, this will handle drone selection logic
  }

  loadOrder(orderId: string) {
    alert(`Order ${orderId} loaded onto drone`);
    // Later, this will handle loading orders onto the drone
  }
}