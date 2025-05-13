/**
 * Simple NodeJS WebSocket Server for Courier System
 * Your Name, Surname, Student Number
 * 
 * This file creates a WebSocket server that interacts with the PHP API
 * and communicates with connected clients.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const readline = require('readline');
const cors = require('cors');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Set up the WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients with their usernames
const clients = new Map();

// Local API URL (using your XAMPP setup)
const API_URL = 'http://localhost/COS216HA-THE-POND/Task1-api/api/index.php';

// Function to call the PHP API
async function callApi(type, data = {}) {
    try {
        console.log(`Calling API endpoint: ${type} with data:`, data);
        const response = await axios.post(API_URL, {
            type: type,
            ...data
        });
        console.log(`API Response (${type}):`, response.data);
        return response.data;
    } catch (error) {
        console.error(`API Error (${type}):`, error.message);
        return { success: false, error: error.message };
    }
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Handle messages from clients
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString()); // Convert Buffer to string
            console.log('Received:', data);
            
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
                        clients.set(ws, {
                            userId: loginResult.data.id,
                            username: data.username,
                            userType: loginResult.data.type
                        });
                        console.log(`User ${data.username} logged in as ${loginResult.data.type}`);
                    }
                    
                    // Send response back to client
                    ws.send(JSON.stringify({
                        action: 'login_response',
                        success: loginResult.success,
                        data: loginResult.data,
                        message: loginResult.message
                    }));
                    break;
                    
                case 'getAllOrders':
                    const user = clients.get(ws);
                    if (!user) {
                        ws.send(JSON.stringify({
                            action: 'error',
                            message: 'Not logged in'
                        }));
                        break;
                    }
                    
                    const ordersResult = await callApi('getAllOrders', {
                        userId: user.userId,
                        userType: user.userType
                    });
                    
                    ws.send(JSON.stringify({
                        action: 'orders_data',
                        success: ordersResult.success,
                        data: ordersResult.data,
                        message: ordersResult.message
                    }));
                    break;
                    
                case 'getAllDrones':
                    const dronesResult = await callApi('getAllDrones');
                    
                    ws.send(JSON.stringify({
                        action: 'drones_data',
                        success: dronesResult.success,
                        data: dronesResult.data,
                        message: dronesResult.message
                    }));
                    break;
                
                // Testing API connection
                case 'testApi':
                    const testResult = await callApi('test');
                    ws.send(JSON.stringify({
                        action: 'test_response',
                        success: testResult.success,
                        data: testResult.data,
                        message: testResult.message
                    }));
                    break;
                    
                default:
                    ws.send(JSON.stringify({
                        action: 'error',
                        message: 'Unknown action'
                    }));
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                action: 'error',
                message: 'Server error: ' + error.message
            }));
        }
    });
    
    // Handle disconnections
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// Create command line interface for server commands
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Process server commands
rl.on('line', (input) => {
    const command = input.trim().toUpperCase();
    
    if (command === 'QUIT') {
        console.log('Shutting down server...');
        
        // Notify all clients
        for (const client of wss.clients) {
            client.send(JSON.stringify({
                action: 'server_shutdown',
                message: 'Server is shutting down'
            }));
            client.close();
        }
        
        // Close server and exit
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    } else if (command === 'CURRENTLY_DELIVERING') {
        console.log('Currently delivering orders:');
        // In the future, this would call your API to get currently delivering orders
        // For now, just log that it was called
    } else if (command === 'DRONE_STATUS') {
        console.log('Fetching drone status...');
        // In the future, this would call your API to get drone status
        // For now, just log that it was called
    } else if (command.startsWith('KILL ')) {
        const username = command.substring(5);
        console.log(`Attempting to kill connection for user: ${username}`);
        
        // Find the client with this username and close their connection
        for (const [client, userData] of clients.entries()) {
            if (userData.username === username) {
                console.log(`Closing connection for ${username}`);
                client.close();
                break;
            }
        }
    } else if (command === 'TEST_API') {
        // Test the API connection
        console.log('Testing API connection...');
        callApi('test')
            .then(result => {
                console.log('API test result:', result);
            })
            .catch(error => {
                console.error('API test error:', error);
            });
    } else if (command === 'LIST_CLIENTS') {
        // List all connected clients
        console.log('Connected clients:');
        if (clients.size === 0) {
            console.log('  No clients connected');
        } else {
            let i = 1;
            for (const [_, userData] of clients.entries()) {
                console.log(`  ${i++}. ${userData.username} (${userData.userType})`);
            }
        }
    } else {
        console.log('Unknown command. Available commands:');
        console.log('  QUIT - Shutdown the server');
        console.log('  CURRENTLY_DELIVERING - Show orders being delivered');
        console.log('  DRONE_STATUS - Show status of all drones');
        console.log('  KILL <username> - Disconnect a specific user');
        console.log('  TEST_API - Test the API connection');
        console.log('  LIST_CLIENTS - List all connected clients');
    }
});

// Choose port based on user input
const selectPort = () => {
    rl.question('Enter port number (1024-49151): ', (portStr) => {
        const port = parseInt(portStr);
        
        // Validate port
        if (isNaN(port) || port < 1024 || port > 49151) {
            console.log('Invalid port. Please enter a number between 1024 and 49151.');
            selectPort();
            return;
        }
        
        // Start server
        server.listen(port, () => {
            console.log(`WebSocket server running on port ${port}`);
            console.log(`Connected to API at: ${API_URL}`);
            console.log('Available commands:');
            console.log('  QUIT - Shutdown the server');
            console.log('  CURRENTLY_DELIVERING - Show orders being delivered');
            console.log('  DRONE_STATUS - Show status of all drones');
            console.log('  KILL <username> - Disconnect a specific user');
            console.log('  TEST_API - Test the API connection');
            console.log('  LIST_CLIENTS - List all connected clients');
        });
    });
};

// Start the server
selectPort();