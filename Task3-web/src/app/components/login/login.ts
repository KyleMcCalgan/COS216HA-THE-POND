import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WebSocketService } from '../../services/websocket.service';
import { Subscription } from 'rxjs';

interface ServerResponse {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: Date;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  wsStatus = 'disconnected';
  serverResponses: ServerResponse[] = [];
  private wsSubscription?: Subscription;

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
    this.wsSubscription = this.webSocketService.messages$.subscribe(message => {
      // Add to responses
      this.addServerResponse('WebSocket', `Received message: ${message.action || 'Unknown action'}`, 'info');
      
      if (message.type === 'connection') {
        this.wsStatus = message.status;
        this.addServerResponse('Connection', `WebSocket status changed to: ${message.status}`, 
          message.status === 'connected' ? 'success' : 'warning');
      }
      
      // Handle login response from WebSocket if needed
      if (message.action === 'login_response') {
        this.loading = false;
        if (message.success) {
          // Handle successful login via WebSocket
          this.addServerResponse('Login', `Login successful: ${message.data?.username || 'Unknown user'}`, 'success');
          console.log('WebSocket login successful:', message.data);
        } else {
          this.error = message.message || 'Invalid username or password';
          this.addServerResponse('Login', `Login failed: ${message.message}`, 'error');
        }
      }
      
      // Handle server logs
      if (message.action === 'server_log') {
        this.addServerResponse('Server Log', message.message, message.type || 'info');
      }
      
      // Handle errors
      if (message.action === 'error') {
        this.addServerResponse('Error', message.message, 'error');
      }
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe to prevent memory leaks
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
  }

  // Convenience getter for easy access to form fields
  get f() { return this.loginForm.controls; }

  connectWebSocket(): void {
    this.wsStatus = 'connecting';
    this.addServerResponse('Connection', 'Connecting to WebSocket server...', 'info');
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
    this.addServerResponse('Login', 'Attempting to login via HTTP API...', 'info');

    // Call authentication service
    this.authService.login(this.f['username'].value, this.f['password'].value)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.addServerResponse('Login API', 'Login successful via HTTP API', 'success');
            
            // If login is successful, also send login via WebSocket
            if (this.wsStatus === 'connected') {
              this.addServerResponse('WebSocket', 'Sending login request via WebSocket...', 'info');
              this.webSocketService.sendMessage({
                action: 'login',
                username: this.f['username'].value,
                password: this.f['password'].value
              });
            } else {
              this.addServerResponse('WebSocket', 'Not connected. Cannot send login via WebSocket.', 'warning');
            }
            
            // Redirect to appropriate page based on user type
            const userType = response.data?.type;
            if (userType === 'Customer') {
              this.router.navigate(['/customer']);
            } else if (userType === 'Courier') {
              this.router.navigate(['/operator']);
            } else {
              this.router.navigate(['/login']);
            }
          } else {
            this.error = response.message || 'Invalid username or password';
            this.loading = false;
            this.addServerResponse('Login API', `Login failed: ${response.message}`, 'error');
          }
        },
        error: (error) => {
          this.error = error.message || 'An error occurred during login';
          this.loading = false;
          this.addServerResponse('Login API', `Error: ${error.message}`, 'error');
        }
      });
  }
  
  // Add a new server response to the list
  addServerResponse(title: string, message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
    this.serverResponses.unshift({
      title,
      message,
      type,
      timestamp: new Date()
    });
    
    // Keep only the last 10 responses to avoid clutter
    if (this.serverResponses.length > 10) {
      this.serverResponses.pop();
    }
  }
}