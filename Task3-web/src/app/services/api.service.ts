import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/response.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly SERVER_URL = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  // Generic method to call NodeJS server API proxy
  callApi<T>(type: string, data: any = {}): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.SERVER_URL}/api/proxy`, {
      type,
      ...data
    });
  }

  // Get server connection info
  getConnectionInfo(): Observable<any> {
    return this.http.get(`${this.SERVER_URL}/api/connection-info`);
  }

  // Get debug info
  getDebugInfo(): Observable<any> {
    return this.http.get(`${this.SERVER_URL}/api/debug-info`);
  }
}