import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User } from '../models/user.model';
import { ApiResponse } from '../models/response.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly SERVER_URL = 'http://localhost:3000'; // Update with your NodeJS server port
  private currentUserSubject: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Try to load user from localStorage on startup
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(username: string, password: string): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(`${this.SERVER_URL}/api/proxy`, {
      type: 'login',
      username,
      password
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Store user details in localStorage and update BehaviorSubject
          localStorage.setItem('currentUser', JSON.stringify(response.data));
          this.currentUserSubject.next(response.data);
        }
      })
    );
  }

  logout(): void {
    // Remove user from localStorage and update BehaviorSubject
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }
}