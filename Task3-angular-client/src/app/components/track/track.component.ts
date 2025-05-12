// src/app/components/track/track.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common'; // Import CommonModule

interface OrderDetails {
  products: string[];
  customer: string;
  destination: { latitude: number; longitude: number };
  droneId: number;
}

@Component({
  selector: 'app-track',
  standalone: true,
  imports: [CommonModule], // Add CommonModule to imports
  templateUrl: './track.html',
  styleUrls: ['./track.css']
})
export class TrackComponent implements OnInit {
  orderId: string | null = null;
  orderDetails: OrderDetails | null = null;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.orderId = this.route.snapshot.paramMap.get('orderId');
    // Placeholder logic (no test data yet)
  }

  returnToDispatched() {
    this.router.navigate(['/operator/dispatched-orders']);
  }

  checkBattery() {
    alert('Battery status: Placeholder');
  }

  stopOrder() {
    alert(`Order ${this.orderId} marked as delivered`);
    this.router.navigate(['/operator/dispatched-orders']);
  }
}