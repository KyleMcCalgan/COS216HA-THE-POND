/**
 * Enhanced NodeJS WebSocket Server for Courier System
 * 
 * This file creates a WebSocket server that interacts with the PHP API,
 * communicates with connected clients, and implements all required functionality.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');
const readline = require('readline');
const cors = require('cors');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server
const server = http.createServer(app);

// Set up the WebSocket server
const wss = new WebSocket.Server({ server });

// Local API URL
const API_URL = 'http://localhost/COS216HA-THE-POND/Task1-api/api/index.php';

// Store connected clients with their usernames
const clients = new Map();

// Store order delivery status
const deliveringOrders = new Map();

// Store connection timestamps
const connectionTimestamps = new Map();

// Store database changes (for monitoring)
const databaseChanges = [];

// Create a function to broadcast server logs
function broadcastServerLog(message, type = 'info') {
    const logMessage = JSON.stringify({
        action: 'server_log',
        message: message,
        type: type,
        timestamp: new Date().toISOString()
    });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(logMessage);
        }
    });
}

// Override console.log to broadcast logs
const originalConsoleLog = console.log;
console.log = function() {
    // Call the original console.log
    originalConsoleLog.apply(console, arguments);
    
    // Convert arguments to a string
    const message = Array.from(arguments).join(' ');
    
    // Broadcast to all connected clients
    broadcastServerLog(message, 'info');
};

// Override console.error for error messages
const originalConsoleError = console.error;
console.error = function() {
    // Call the original console.error
    originalConsoleError.apply(console, arguments);
    
    // Convert arguments to a string
    const message = Array.from(arguments).join(' ');
    
    // Broadcast to all connected clients
    broadcastServerLog(message, 'error');
};

// Function to call the PHP API
async function callApi(type, data = {}) {
    try {
        console.log(`Calling API endpoint: ${type} with data:`, data);
        const response = await axios.post(API_URL, {
            type: type,
            ...data
        });
        
        // Track database changes for certain operations
        if (['createUser', 'createOrder', 'createDrone', 'updateOrder', 'updateDrone'].includes(type)) {
            databaseChanges.push({
                timestamp: new Date().toISOString(),
                operation: type,
                success: response.data.success,
                details: response.data.success ? response.data.data : response.data.message
            });
        }
        
        console.log(`API Response (${type}):`, response.data);
        return response.data;
    } catch (error) {
        console.error(`API Error (${type}):`, error.message);
        return { success: false, error: error.message };
    }
}

// Route to serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to provide connection info to client
app.get('/api/connection-info', (req, res) => {
    res.json({
        apiUrl: API_URL
    });
});

// Enhanced debug info route with more detailed information
app.get('/api/debug-info', async (req, res) => {
    const connectedUsers = [];
    
    clients.forEach((userData, client) => {
        if (userData && userData.username) {
            connectedUsers.push({
                username: userData.username,
                userType: userData.userType,
                userId: userData.userId,
                connectedAt: connectionTimestamps.get(userData.username),
                lastActive: userData.lastActive || connectionTimestamps.get(userData.username)
            });
        }
    });
    
    // Get drone status information
    let droneStatus = [];
    try {
        const droneResult = await callApi('getAllDrones');
        if (droneResult.success) {
            droneStatus = droneResult.data;
        }
    } catch (error) {
        console.error('Error fetching drone status for debug:', error);
    }
    
    res.json({
        connectedUsers: connectedUsers,
        deliveringOrders: Array.from(deliveringOrders.entries()).map(([id, order]) => order),
        databaseChanges: databaseChanges.slice(-20), // Last 20 changes
        serverUptime: process.uptime(),
        droneStatus: droneStatus,
        serverTime: new Date().toISOString(),
        apiUrl: API_URL,
        activeConnections: wss.clients.size
    });
});

// Route to proxy API requests
app.post('/api/proxy', async (req, res) => {
    try {
        const type = req.body.type;
        console.log(`Proxying request to API: ${type}`);
        
        const response = await callApi(type, req.body);
        
        // Special handling for updateOrder when state changes to Out_for_delivery
        if (type === 'updateOrder' && 
            response.success && 
            req.body.state === 'Out_for_delivery') {
            
            const orderKey = `${req.body.customer_id}-${req.body.order_id}`;
            deliveringOrders.set(orderKey, {
                customer_id: req.body.customer_id,
                order_id: req.body.order_id,
                tracking_num: response.data.tracking_num || 'Unknown',
                start_time: new Date().toISOString(),
                destination: {
                    latitude: response.data.destination_latitude,
                    longitude: response.data.destination_longitude
                }
            });
            
            console.log(`Order ${orderKey} is now being delivered`);
            broadcastOrderUpdate();
        }
        
        // When order is delivered, remove from delivering orders
        if (type === 'updateOrder' && 
            response.success && 
            req.body.state === 'Delivered') {
            
            const orderKey = `${req.body.customer_id}-${req.body.order_id}`;
            if (deliveringOrders.has(orderKey)) {
                deliveringOrders.delete(orderKey);
                console.log(`Order ${orderKey} has been delivered`);
                broadcastOrderUpdate();
            }
        }
        
        res.json(response);
    } catch (error) {
        console.error('API request error:', error.message);
        
        let errorResponse = {
            success: false,
            message: `API error: ${error.message}`,
            data: null
        };
        
        if (error.response) {
            console.error('Error response data:', error.response.data);
            errorResponse.data = error.response.data;
            res.status(error.response.status).json(errorResponse);
        } else if (error.request) {
            console.error('No response received from API');
            res.status(500).json({
                success: false,
                message: 'No response received from API server. Make sure the API is running at ' + API_URL,
                data: null
            });
        } else {
            res.status(500).json(errorResponse);
        }
    }
});

// Broadcast order updates to all connected WebSocket clients
function broadcastOrderUpdate() {
    const orders = Array.from(deliveringOrders.values());
    const message = JSON.stringify({
        action: 'delivering_orders_update',
        orders: orders
    });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Broadcast drone updates to all connected WebSocket clients
async function broadcastDroneStatus() {
    try {
        const droneData = await callApi('getAllDrones');
        
        if (droneData.success) {
            const message = JSON.stringify({
                action: 'drone_status_update',
                drones: droneData.data
            });
            
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
    } catch (error) {
        console.error('Error fetching drone status:', error);
    }
}

// Schedule periodic broadcasts of drone status
setInterval(broadcastDroneStatus, 60000); // Every minute

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');
    
    // Handle messages from clients
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received WebSocket message:', data);
            
            // Handle different message types
            switch (data.action) {
                case 'login':
                    // Call login API
                    const loginResult = await callApi('login', {
                        username: data.username,
                        password: data.password
                    });
                    
                    if (loginResult.success) {
                        // Store the client with their user info
                        const userData = {
                            userId: loginResult.data.id,
                            username: data.username,
                            userType: loginResult.data.type,
                            lastActive: new Date().toISOString()
                        };
                        
                        clients.set(ws, userData);
                        connectionTimestamps.set(data.username, new Date().toISOString());
                        console.log(`User ${data.username} logged in as ${loginResult.data.type} via WebSocket`);
                    }
                    
                    // Send response back to client
                    ws.send(JSON.stringify({
                        action: 'login_response',
                        success: loginResult.success,
                        data: loginResult.data,
                        message: loginResult.message
                    }));
                    break;
                
                case 'getOrders':
                case 'getDrones':
                case 'getDebugInfo':
                    // Update last active timestamp
                    const clientData = clients.get(ws);
                    if (clientData) {
                        clientData.lastActive = new Date().toISOString();
                    }
                    break;
                    
                default:
                    ws.send(JSON.stringify({
                        action: 'error',
                        message: 'Unknown WebSocket action'
                    }));
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            ws.send(JSON.stringify({
                action: 'error',
                message: 'Server error: ' + error.message
            }));
        }
    });
    
    // Send initial data to client
    ws.send(JSON.stringify({
        action: 'connection_established',
        serverTime: new Date().toISOString()
    }));
    
    // Send current orders and drone status to new client
    if (deliveringOrders.size > 0) {
        const orders = Array.from(deliveringOrders.values());
        ws.send(JSON.stringify({
            action: 'delivering_orders_update',
            orders: orders
        }));
    }
    
    // Get and send drone status to the new client
    broadcastDroneStatus().catch(error => {
        console.error('Error sending initial drone status to client:', error);
    });
    
    // Handle disconnections
    ws.on('close', () => {
        const clientData = clients.get(ws);
        if (clientData) {
            console.log(`User ${clientData.username} disconnected from WebSocket`);
        } else {
            console.log('Unauthenticated client disconnected from WebSocket');
        }
        clients.delete(ws);
    });
});

// Create command line interface for server commands
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'server> '
});

// Process server commands
rl.on('line', (input) => {
    const commandFull = input.trim();
    const command = commandFull.split(' ')[0].toUpperCase();
    const args = commandFull.substring(command.length).trim();
    
    switch (command) {
        case 'QUIT':
            console.log('Shutting down server...');
            
            // Notify all clients
            wss.clients.forEach(client => {
                client.send(JSON.stringify({
                    action: 'server_shutdown',
                    message: 'Server is shutting down'
                }));
                client.close();
            });
            
            // Close server and exit
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
            break;
            
        case 'CURRENTLY_DELIVERING':
            console.log('Currently delivering orders:');
            if (deliveringOrders.size === 0) {
                console.log('  No orders currently being delivered');
            } else {
                let i = 1;
                deliveringOrders.forEach(order => {
                    console.log(`  ${i++}. Order ID: ${order.order_id}, Tracking: ${order.tracking_num}, Customer ID: ${order.customer_id}`);
                });
            }
            break;
            
        case 'DRONE_STATUS':
            console.log('Fetching drone status...');
            callApi('getAllDrones')
                .then(result => {
                    if (result.success) {
                        console.log('Current drone status:');
                        if (result.data.length === 0) {
                            console.log('  No drones found');
                        } else {
                            result.data.forEach((drone, index) => {
                                console.log(`  ${index + 1}. Drone ID: ${drone.id}, Battery: ${drone.battery_level}%, Available: ${drone.is_available ? 'Yes' : 'No'}`);
                                console.log(`     Location: (${drone.latest_latitude}, ${drone.latest_longitude}), Altitude: ${drone.altitude}m`);
                                if (drone.operator) {
                                    console.log(`     Operator: ${drone.operator.username} (ID: ${drone.operator.id})`);
                                }
                            });
                        }
                        
                        // Also broadcast drone status to all clients
                        broadcastDroneStatus();
                    } else {
                        console.log('Failed to fetch drone status:', result.message);
                    }
                })
                .catch(error => {
                    console.error('Error fetching drone status:', error);
                });
            break;
            
        case 'KILL':
            if (!args) {
                console.log('Usage: KILL <username>');
                break;
            }
            
            const username = args;
            console.log(`Attempting to kill connection for user: ${username}`);
            
            // Find the client with this username and close their connection
            let found = false;
            for (const [client, userData] of clients.entries()) {
                if (userData && userData.username === username) {
                    console.log(`Closing connection for ${username}`);
                    client.send(JSON.stringify({
                        action: 'connection_killed',
                        message: 'Your connection has been terminated by the server'
                    }));
                    client.close();
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                console.log(`No active connection found for user: ${username}`);
            }
            break;
            
        case 'TEST_API':
            // Test the API connection
            console.log('Testing API connection...');
            callApi('test')
                .then(result => {
                    console.log('API test result:', result);
                })
                .catch(error => {
                    console.error('API test error:', error);
                });
            break;
            
        case 'LIST_CLIENTS':
            // List all connected clients
            console.log('Connected clients:');
            if (clients.size === 0) {
                console.log('  No clients connected');
            } else {
                let i = 1;
                for (const [_, userData] of clients.entries()) {
                    if (userData && userData.username) {
                        const timestamp = connectionTimestamps.get(userData.username) || 'Unknown';
                        console.log(`  ${i++}. ${userData.username} (${userData.userType}) - Connected at: ${timestamp}`);
                    }
                }
            }
            break;
            
        case 'API_URL':
            // Show current API URL
            console.log(`Current API URL: ${API_URL}`);
            break;
            
        case 'INFO':
            // Show server information
            const address = server.address();
            console.log(`Server information:`);
            console.log(`  Running on port: ${address.port}`);
            console.log(`  API URL: ${API_URL}`);
            console.log(`  Active WebSocket connections: ${wss.clients.size}`);
            console.log(`  Orders being delivered: ${deliveringOrders.size}`);
            console.log(`  Server uptime: ${Math.floor(process.uptime())} seconds`);
            break;
            
        case 'BROADCAST':
            // Broadcast a message to all connected clients
            if (!args) {
                console.log('Usage: BROADCAST <message>');
                break;
            }
            
            console.log(`Broadcasting message to all clients: "${args}"`);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        action: 'server_log',
                        message: `SERVER BROADCAST: ${args}`,
                        type: 'info',
                        timestamp: new Date().toISOString()
                    }));
                }
            });
            break;
            
        case 'CLEAR_CHANGES':
            // Clear database changes history
            console.log('Clearing database changes history...');
            databaseChanges.length = 0;
            console.log('Database changes history cleared');
            break;
            
        case 'HELP':
            console.log('Available commands:');
            console.log('  QUIT - Shutdown the server');
            console.log('  CURRENTLY_DELIVERING - Show orders being delivered');
            console.log('  DRONE_STATUS - Show status of all drones');
            console.log('  KILL <username> - Disconnect a specific user');
            console.log('  TEST_API - Test the API connection');
            console.log('  LIST_CLIENTS - List all connected clients');
            console.log('  API_URL - Show current API URL');
            console.log('  INFO - Show server information');
            console.log('  BROADCAST <message> - Send a message to all connected clients');
            console.log('  CLEAR_CHANGES - Clear database changes history');
            console.log('  HELP - Show this help message');
            break;
            
        default:
            console.log(`Unknown command: ${commandFull}`);
            console.log('Type "HELP" for available commands');
    }
    
    rl.prompt();
});

// Choose port based on user input (excluding reserved ports)
const selectPort = () => {
    rl.question('Enter port number (1024-49151, excluding reserved ports): ', (portStr) => {
        const port = parseInt(portStr);
        
        // List of reserved ports
        const reservedPorts = [80, 443, 3306, 22, 21, 25, 110];
        
        // Validate port
        if (isNaN(port) || port < 1024 || port > 49151) {
            console.log('Invalid port. Please enter a number between 1024 and 49151.');
            selectPort();
            return;
        }
        
        // Check if port is reserved
        if (reservedPorts.includes(port)) {
            console.log(`Port ${port} is reserved. Please choose another port.`);
            selectPort();
            return;
        }
        
        // Start server
        server.listen(port, () => {
            console.log(`\n=== COURIER SYSTEM SERVER ===`);
            console.log(`Server running on port ${port}`);
            console.log(`Connected to API at: ${API_URL}`);
            console.log(`WebSocket server active`);
            console.log('\nAvailable commands:');
            console.log('  QUIT - Shutdown the server');
            console.log('  CURRENTLY_DELIVERING - Show orders being delivered');
            console.log('  DRONE_STATUS - Show status of all drones');
            console.log('  KILL <username> - Disconnect a specific user');
            console.log('  TEST_API - Test the API connection');
            console.log('  LIST_CLIENTS - List all connected clients');
            console.log('  BROADCAST <message> - Send a message to all clients');
            console.log('  HELP - Show all available commands');
            console.log('\nOpen your browser to test the API:');
            console.log(`  http://localhost:${port}`);
            console.log('===============================\n');
            
            rl.prompt();
        });
    });
};

// Start the server
selectPort();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Shutting down server...');
    wss.clients.forEach(client => client.close());
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});