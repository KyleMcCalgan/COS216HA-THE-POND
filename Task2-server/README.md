# Task 2: Multi-User NodeJS Server - README

## Overview
This NodeJS server implements a multi-user WebSocket server for the Courier System, enabling real-time communication between clients and the PHP API. The server handles concurrent connections, manages drone operations, and provides comprehensive command-line controls.

## Architecture
```
[Angular Client] <--WebSocket--> [NodeJS Server] <--HTTP--> [PHP API/MySQL DB]
```

## Key Features
- **Multi-User WebSocket Server**: Supports concurrent client connections
- **Real-time Communication**: Live updates for drone status and orders
- **Command-Line Interface**: Comprehensive server management commands
- **API Integration**: Seamless PHP API interaction with authentication
- **Port Management**: Dynamic port selection with reserved port validation

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Dependencies Installation
```bash
npm install express ws axios body-parser readline cors
```

### Required Files Structure
```
Task2-server/
├── server.js          # Main server file
├── package.json        # Dependencies
├── public/
│   └── index.html     # Test interface (optional)
└── README.md          # This file
```

## Running the Server

### Start the Server
```bash
node server.js
```

### Port Configuration
- The server will prompt for a port number
- Valid range: 1024-49151
- Reserved ports (80, 443, 3306, 22, 21, 25, 110) are blocked
- If port is in use, try a different port

### Example Startup
```
Enter port number (1024-49151, excluding reserved ports): 3000
=== COURIER SYSTEM SERVER ===
Server running on port 3000
Connected to API at: https://wheatley.cs.up.ac.za/u24648826/...
WebSocket server active
```

## Server Commands

### Core Commands (Required by Spec)

#### `CURRENTLY_DELIVERING`
**Specification Requirement**: Show orders currently being delivered with:
- Order ID
- Product names/titles in the order
- Destination coordinates [latitude, longitude]
- Intended recipient details

**Current Implementation**: Shows drones that are currently delivering
**Status**: ⚠️ Partially implemented - shows drone info but missing order product details

#### `KILL <username>`
**Specification Requirement**: Close connection based on username, track socket ID to username mapping
**Implementation**: ✅ Fully implemented - finds and closes specific user connections

#### `QUIT`
**Specification Requirement**: Broadcast shutdown notice to all connections, then close all connections
**Implementation**: ✅ Fully implemented - notifies all clients before shutdown

#### `DRONE_STATUS`
**Specification Requirement**: Return drone information including:
- Battery level
- Altitude
- Current operator
- GPS coordinates

**Implementation**: ✅ Fully implemented - comprehensive drone status display

### Additional Management Commands

#### Drone Categories
- `AVAILABLE` - Show available drones
- `WAITING_TO_DELIVER` - Show drones loaded and ready at HQ
- `RETURNING` - Show drones returning to base
- `DEAD` - Show crashed/dead drones

#### System Management
- `LIST_CLIENTS` - Show all connected users
- `INFO` - Display server statistics
- `BROADCAST <message>` - Send message to all clients
- `TEST_API` - Test PHP API connectivity
- `HELP` - Show all available commands

## Database Update Strategy

### **Chosen Approach: Hybrid (Update Everytime + Interval Monitoring)**

**Rationale for Choice:**
Our implementation uses a hybrid approach that combines the best of both strategies:

1. **Immediate Updates for Critical Operations**:
   - Order state changes (Storage → Out_for_delivery → Delivered)
   - Drone availability changes
   - User authentication events

2. **Periodic Updates for Status Monitoring**:
   - Drone position updates (every 60 seconds)
   - System health checks
   - Connection status verification

**Why This is Better:**
- **Responsiveness**: Critical events are processed immediately
- **Efficiency**: Reduces unnecessary API calls for non-critical updates
- **Reliability**: Periodic checks ensure data consistency
- **Performance**: Balances real-time requirements with server resources

**Alternative Considered:**
- **Every Time Updates**: Would ensure maximum data freshness but could overwhelm the API with requests
- **Interval Only**: Would be more efficient but might miss critical state changes

## Authentication Configuration

### API Credentials
The server uses Basic Authentication to connect to the PHP API:


⚠️ **Security Note**: For production, credentials should be stored in environment variables

### Wheatley URL Format
```
https://username:password@wheatley.cs.up.ac.za/uXXXXXXXX/path_to_api
```

## WebSocket Message Format

### Client to Server
```json
{
  "action": "login",
  "username": "user123",
  "password": "password"
}
```

### Server to Client
```json
{
  "action": "login_response",
  "success": true,
  "data": {...},
  "message": "Login successful"
}
```

## Error Handling

### Connection Loss Management
**Specification Requirement**: Handle lost sockets (client disconnections)

**Implementation**: ✅ The server handles:
- Normal disconnections with cleanup
- Unexpected client drops
- Courier disconnection during drone operations (with order reset)

### Lost Courier Handling
When a courier operating a drone disconnects:
1. ⚠️ **Partially Implemented**: Notifies customers of delivery postponement
2. ⚠️ **Partially Implemented**: Resets "Out_for_delivery" orders to "Storage"
3. ⚠️ **Missing**: Automatic drone crash handling in database

## Drone Categorization Logic

The server categorizes drones based on:
- `is_available` flag
- `order_id` presence
- `altitude` level

### Categories:
1. **AVAILABLE**: `is_available = true` AND `order_id = null`
2. **CURRENTLY_DELIVERING**: `is_available = false` AND `order_id != null`
3. **WAITING_TO_DELIVER**: `is_available = true` AND `order_id != null`
4. **RETURNING**: `is_available = false` AND `order_id = null` AND `altitude ≤ 30`
5. **DEAD**: `is_available = false` AND `altitude > 30`

## API Endpoints Used

### Core Endpoints
- `login` - User authentication
- `getAllDrones` - Fetch drone information
- `getAllOrders` - Fetch order information
- `updateOrder` - Modify order status
- `updateDrone` - Modify drone status
- `createOrder` - Add new orders
- `createDrone` - Add new drones

## Testing the Server

### Using WebSocket Tester
Recommended testing tool: https://www.piesocket.com/websocket-tester

### Test Commands
1. Connect to `ws://localhost:<port>`
2. Send login message
3. Test various actions

### Debug Information
Access debug info at: `http://localhost:<port>/api/debug-info`

## Known Limitations

### Specification Gaps
1. **CURRENTLY_DELIVERING Command**: Missing order product details and recipient information
2. **Automatic Courier System Flow**: Missing simulation of drone movement and automatic notifications
3. **Real-time Position Updates**: Missing continuous drone position tracking during delivery

### Recommendations for Full Compliance
1. Enhance `CURRENTLY_DELIVERING` to fetch and display:
   - Product names from Orders_Products table
   - Customer destination details
   - Real-time delivery progress

2. Implement automatic courier system flow:
   - Simulate drone movement between coordinates
   - Send real-time notifications to customers
   - Automatic state transitions based on drone position

3. Add comprehensive error handling for all edge cases mentioned in specification

## Troubleshooting

### Common Issues

#### Port Already in Use
```
Error: listen EADDRINUSE :::3000
```
**Solution**: Choose a different port number

#### API Connection Failed
```
API Error: Request failed with status code 401
```
**Solution**: Check username/password in server.js

#### WebSocket Connection Failed
**Solution**: Ensure server is running and port is accessible

### Debug Mode
Enable verbose logging by setting:
```javascript
console.log = originalConsoleLog; // Remove broadcast logging temporarily
```

## Performance Considerations

### Memory Management
- Client connections are properly cleaned up on disconnect
- Database change history is limited to last 20 entries
- Periodic garbage collection for closed connections

### Scalability
- Current implementation supports moderate concurrent users
- For high-load scenarios, consider connection pooling
- Database connection optimization recommended

## Security Considerations

⚠️ **Important Security Notes**:
1. Credentials are currently hardcoded (development only)
2. No input validation on commands
3. No rate limiting on API calls
4. No encryption on WebSocket communications

### Production Recommendations
- Use environment variables for credentials
- Implement input sanitization
- Add rate limiting
- Use WSS (WebSocket Secure) protocol
- Implement user session management

## Conclusion

This implementation provides a solid foundation for the multi-user courier system server with most specification requirements met. The hybrid database update strategy ensures both responsiveness and efficiency. Future enhancements should focus on completing the courier system flow automation and improving the CURRENTLY_DELIVERING command to fully match specification requirements.

---

**Authors**: [Your Name and Student Number]
**Course**: COS 216
**Date**: February 2025
**Version**: 1.0