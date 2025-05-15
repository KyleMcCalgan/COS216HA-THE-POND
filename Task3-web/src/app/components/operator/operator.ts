import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WebSocketService } from '../../services/websocket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-operator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './operator.html',
  styleUrls: ['./operator.css']
})
export class Operator implements OnInit, OnDestroy {
  outstandingOrders: any[] = [];
  dispatchedDrones: any[] = [];
  private wsSubscription: Subscription | null = null;

  constructor(private router: Router, private webSocketService: WebSocketService) {}

  ngOnInit() {
    // Connect to WebSocket
    this.webSocketService.connect();

    // Subscribe to WebSocket messages
    this.wsSubscription = this.webSocketService.messages$.subscribe((message: any) => {
      this.handleWebSocketMessage(message);
    });

    // Request initial data
    this.fetchOutstandingOrders();
    this.fetchDispatchedDrones();
  }

  ngOnDestroy() {
    // Unsubscribe and disconnect WebSocket
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    this.webSocketService.disconnect();
  }

  // Fetch outstanding orders
  private fetchOutstandingOrders() {
    this.webSocketService.sendMessage({
      action: 'getOrders'
    });
  }

  // Fetch dispatched drones
  private fetchDispatchedDrones() {
    this.webSocketService.sendMessage({
      action: 'getDrones'
    });
  }

  // Handle incoming WebSocket messages
  private handleWebSocketMessage(message: any) {
    switch (message.action) {
      case 'connection_established':
        console.log('WebSocket connection established');
        break;

      case 'delivering_orders_update':
        // Update outstanding orders (filter for Pending, Processing, Out_for_delivery)
        this.outstandingOrders = message.orders.filter((order: any) =>
          ['Pending', 'Processing', 'Out_for_delivery'].includes(order.status)
        ).map((order: any) => ({
          orderId: order.order_id,
          products: order.products || [], // Adjust based on API response
          status: order.status,
          deliveryAddress: order.destination?.address || 'Unknown',
          customer: order.customer_name || 'Unknown'
        }));
        break;

      case 'drone_status_update':
        // Update dispatched drones
        this.dispatchedDrones = message.drones.map((drone: any) => ({
          id: drone.id,
          isAvailable: drone.is_available,
          batteryLevel: drone.battery_level,
          operator: drone.operator?.username || 'Unassigned'
        }));
        break;

      case 'error':
        console.error('WebSocket error:', message.message);
        break;

      default:
        console.log('Unhandled WebSocket message:', message);
    }
  }

  viewOrderHistory() {
    this.router.navigate(['/operator/order-history']);
  }

  viewDispatchedOrders() {
    this.router.navigate(['/operator/dispatched-orders']);
  }

  trackOrder(orderId: string) {
    this.router.navigate(['/operator/track', orderId]);
  }

  processOrder(orderId: string) {
    // Send update to API via WebSocket
    this.webSocketService.sendMessage({
      action: 'updateOrder',
      order_id: orderId,
      state: 'Processing' // Example: Move to Processing state
    });
    this.router.navigate(['/operator/dispatch', orderId]);
  }
}