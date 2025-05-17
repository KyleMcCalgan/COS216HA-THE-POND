import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-customer-track',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customer-track.html',
  styleUrls: ['./customer-track.css']
})
export class CustomerTrack implements OnInit {
  orderId: string | null = null;
  orderDetails: any = null;
  loading = true;
  error = '';
  trackingSteps = [
    { name: 'Order Placed', completed: false, timestamp: null },
    { name: 'Processing', completed: false, timestamp: null },
    { name: 'Dispatched', completed: false, timestamp: null },
    { name: 'Out for Delivery', completed: false, timestamp: null },
    { name: 'Delivered', completed: false, timestamp: null }
  ];

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.orderId = params.get('orderId');
      if (this.orderId) {
        this.fetchOrderDetails(this.orderId);
      } else {
        this.error = 'Order ID is missing';
        this.loading = false;
      }
    });
  }

  private fetchOrderDetails(orderId: string) {
    this.loading = true;
    
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // Use API service to get order details
    this.apiService.callApi('getOrderDetails', {
      order_id: orderId,
      user_id: currentUser.id || 1,
      user_type: 'Customer'
    }).subscribe({
      next: (response: any) => {
        this.loading = false;
        console.log('API response data:', response);
        
        if (response.success && response.data) {
          this.orderDetails = response.data;
          this.updateTrackingSteps();
        } else {
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
      this.trackingSteps[4].timestamp = this.orderDetails.delivery_time || this.orderDetails.updated_at || new Date().toISOString();
    }
  }
}