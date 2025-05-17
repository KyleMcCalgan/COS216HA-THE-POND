import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

interface Product {
  id: number;
  title: string;
  brand: string;
  image_url?: string;
  categories?: string;
  dimensions?: string;
  is_available: boolean;
  distributor?: number;
  quantity: number;
  isSelected: boolean;
}

@Component({
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-order.html',
  styleUrls: ['./new-order.css']
})
export class NewOrder implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  selectedProducts: Product[] = [];
  loading = true;
  error = '';
  submitting = false;
  maxProducts = 7; // Maximum number of products allowed
  searchTerm = '';
  
  // HQ coordinates for destination calculation
  private readonly HQ_LAT = 25.7472;
  private readonly HQ_LNG = 28.2511;
  
  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit() {
    this.fetchProducts();
  }

  fetchProducts() {
    this.loading = true;
    
    this.apiService.callApi('getAllProducts', {}).subscribe({
      next: (response: any) => {
        this.loading = false;
        
        if (response.success && response.data) {
          console.log('Products loaded:', response.data);
          
          // Transform the API response to match our Product interface
          this.products = response.data.map((product: any) => ({
            ...product,
            quantity: 1,
            isSelected: false
          }));
          
          this.filterProducts(); // Initialize filtered products
        } else {
          this.error = response.message || 'Failed to load products';
          console.error('Failed to load products:', response.message);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error connecting to the server';
        console.error('Error fetching products:', err);
      }
    });
  }

  // Filter products based on search term
  filterProducts() {
    if (!this.searchTerm) {
      this.filteredProducts = [...this.products];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredProducts = this.products.filter(product => 
      product.title.toLowerCase().includes(term) || 
      product.brand.toLowerCase().includes(term) || 
      (product.categories && product.categories.toLowerCase().includes(term))
    );
  }

  // Check if a product is selected
  isProductSelected(productId: number): boolean {
    return this.selectedProducts.some(p => p.id === productId);
  }

  // Toggle product selection
  toggleProduct(product: Product) {
    const index = this.selectedProducts.findIndex(p => p.id === product.id);
    
    if (index === -1) {
      // Product is not selected yet
      if (this.selectedProducts.length >= this.maxProducts) {
        alert(`You can only select up to ${this.maxProducts} products.`);
        return;
      }
      
      // Clone the product and add to selected products
      const selectedProduct = {...product, quantity: 1};
      this.selectedProducts.push(selectedProduct);
    } else {
      // Product is already selected, remove it
      this.selectedProducts.splice(index, 1);
    }
  }

  // Remove a product from selection
  removeProduct(product: Product) {
    const index = this.selectedProducts.findIndex(p => p.id === product.id);
    if (index !== -1) {
      this.selectedProducts.splice(index, 1);
    }
  }

  // Increase product quantity
  increaseQuantity(product: Product) {
    // Check if adding one more would exceed total limit
    const currentTotal = this.getTotalItemCount();
    if (currentTotal >= 7) {
      alert('Maximum 7 items allowed in total.');
      return;
    }
    
    if (product.quantity < 7) {
      product.quantity++;
    }
  }

  // Decrease product quantity
  decreaseQuantity(product: Product) {
    if (product.quantity > 1) {
      product.quantity--;
    }
  }

  // Get count of selected products
  getTotalSelectedProducts(): number {
    return this.selectedProducts.length;
  }

  // Get total item count (sum of quantities)
  getTotalItemCount(): number {
    return this.selectedProducts.reduce((total, product) => total + product.quantity, 0);
  }

  // Generate random coordinates within 5km of HQ for the order
  private generateDestinationCoordinates(): {latitude: number, longitude: number} {
    // Random coordinates within 5km
    const radius = 0.045; // Approximately 5km in degrees
    const u = Math.random();
    const v = Math.random();
    const w = radius * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    const x = w * Math.cos(t);
    const y = w * Math.sin(t);
    
    return {
      latitude: this.HQ_LAT + y,
      longitude: this.HQ_LNG + x
    };
  }

  // Submit the order
  submitOrder() {
    if (this.selectedProducts.length === 0) {
      alert('Please select at least one product.');
      return;
    }
    
    // Check the total item count
    const totalItems = this.getTotalItemCount();
    if (totalItems > 7) {
      alert(`Your order contains ${totalItems} items. The maximum allowed is 7.`);
      return;
    }
    
    this.submitting = true;
    
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // Format products for the API
    const orderProducts = this.selectedProducts.map(product => ({
      id: product.id,
      quantity: product.quantity
    }));
    
    // Generate destination coordinates
    const destination = this.generateDestinationCoordinates();
    
    console.log('Submitting order with products:', orderProducts);
    console.log('Destination:', destination);
    
    // Create a new order
    this.apiService.callApi('createOrder', {
      customer_id: currentUser.id,
      products: orderProducts,
      destination_latitude: destination.latitude,
      destination_longitude: destination.longitude
    }).subscribe({
      next: (response: any) => {
        this.submitting = false;
        
        if (response.success && response.data) {
          alert('Your order has been placed successfully!');
          this.router.navigate(['/customer']);
        } else {
          this.error = response.message || 'Failed to create order';
          console.error('Failed to create order:', response.message);
        }
      },
      error: (err) => {
        this.submitting = false;
        this.error = 'Error connecting to the server';
        console.error('Error creating order:', err);
      }
    });
  }

  // Cancel and return to customer dashboard
  cancelOrder() {
    this.router.navigate(['/customer']);
  }
}