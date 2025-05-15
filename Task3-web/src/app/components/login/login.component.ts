import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  wsStatus = 'disconnected';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    // Initialize form
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    // Connect to WebSocket
    this.connectWebSocket();

    // Subscribe to WebSocket messages
    this.webSocketService.messages$.subscribe(message => {
      if (message.type === 'connection') {
        this.wsStatus = message.status;
      }
      
      // Handle login response from WebSocket if needed
      if (message.action === 'login_response') {
        this.loading = false;
        if (message.success) {
          // Handle successful login via WebSocket
          console.log('WebSocket login successful:', message.data);
        } else {
          this.error = message.message || 'Invalid username or password';
        }
      }
    });
  }

  // Convenience getter for easy access to form fields
  get f() { return this.loginForm.controls; }

  connectWebSocket(): void {
    this.wsStatus = 'connecting';
    this.webSocketService.connect();
  }

  onSubmit(): void {
    this.submitted = true;

    // Stop here if form is invalid
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';

    // Call authentication service
    this.authService.login(this.f['username'].value, this.f['password'].value)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // If login is successful, also send login via WebSocket
            if (this.wsStatus === 'connected') {
              this.webSocketService.sendMessage({
                action: 'login',
                username: this.f['username'].value,
                password: this.f['password'].value
              });
            }
            
            // Redirect to appropriate page based on user type
            const userType = response.data?.type;
            if (userType === 'Customer') {
              this.router.navigate(['/customer']);
            } else if (userType === 'Courier') {
              this.router.navigate(['/courier']);
            } else {
              this.router.navigate(['/home']);
            }
          } else {
            this.error = response.message || 'Invalid username or password';
            this.loading = false;
          }
        },
        error: (error) => {
          this.error = error.message || 'An error occurred during login';
          this.loading = false;
        }
      });
  }
}