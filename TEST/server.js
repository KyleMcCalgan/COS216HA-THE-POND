/**
 * Simple NodeJS API Test Client for Courier System
 * 
 * This file creates a server that serves a web interface to test the PHP API
 * and provides a command line interface for server control.
 */

const express = require('express');
const http = require('http');
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

// Route to proxy API requests
app.post('/api/proxy', async (req, res) => {
    try {
        const type = req.body.type;
        console.log(`Proxying request to API: ${type}`);
        
        const response = await callApi(type, req.body);
        res.json(response);
    } catch (error) {
        console.error('API request error:', error.message);
        
        let errorResponse = {
            success: false,
            message: `API error: ${error.message}`,
            data: null
        };
        
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Error response data:', error.response.data);
            errorResponse.data = error.response.data;
            res.status(error.response.status).json(errorResponse);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from API');
            res.status(500).json({
                success: false,
                message: 'No response received from API server. Make sure the API is running at ' + API_URL,
                data: null
            });
        } else {
            // Something happened in setting up the request that triggered an Error
            res.status(500).json(errorResponse);
        }
    }
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
        
        // Close server and exit
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
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
    } else if (command === 'API_URL') {
        // Show current API URL
        console.log(`Current API URL: ${API_URL}`);
    } else if (command === 'INFO') {
        // Show server information
        const address = server.address();
        console.log(`Server information:`);
        console.log(`  Running on port: ${address.port}`);
        console.log(`  API URL: ${API_URL}`);
        console.log(`  Web interface: http://localhost:${address.port}`);
    } else {
        console.log('Unknown command. Available commands:');
        console.log('  QUIT - Shutdown the server');
        console.log('  TEST_API - Test the API connection');
        console.log('  API_URL - Show current API URL');
        console.log('  INFO - Show server information');
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
            console.log(`\n=== API TEST CLIENT ===`);
            console.log(`Server running on http://localhost:${port}`);
            console.log(`Connected to API at: ${API_URL}`);
            console.log('\nAvailable commands:');
            console.log('  QUIT - Shutdown the server');
            console.log('  TEST_API - Test the API connection');
            console.log('  API_URL - Show current API URL');
            console.log('  INFO - Show server information');
            console.log('\nOpen your browser and navigate to:');
            console.log(`  http://localhost:${port}`);
            console.log('===========================\n');
        });
    });
};

// Start the server
selectPort();