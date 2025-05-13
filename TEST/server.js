// server.js - Simple Node.js server to test the PHP API
const express = require('express');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');
const readline = require('readline');

// Server configuration
const app = express();
const DEFAULT_PORT = 8080; // Default port if none is specified
const PORT = process.env.PORT || DEFAULT_PORT;

// Allow user to specify API URL 

const API_URL = 'http://localhost/COS216HA-THE-POND/Task1-api/api/index.php';

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
    console.log(`Sending request to API: ${API_URL}`);
    console.log(`Request body: ${JSON.stringify(req.body)}`);
    
    const response = await axios.post(API_URL, req.body);
    console.log(`API response received: ${JSON.stringify(response.data)}`);
    
    res.json(response.data);
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

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', apiUrl: API_URL });
});

// Start the server
const server = app.listen(PORT, () => {
  console.log('\n=== API TEST CLIENT ===');
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`API requests will be proxied to ${API_URL}`);
  console.log('\nCommands:');
  console.log('  q, quit, exit - Stop the server');
  console.log('  apiurl - Show current API URL');
  console.log('  help - Show available commands');
  console.log('\nOpen your browser and navigate to http://localhost:${PORT}');
  console.log('===============================\n');
});

// Setup readline interface for server commands
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'server> '
});

rl.prompt();

rl.on('line', (line) => {
  const command = line.trim().toLowerCase();
  
  switch (command) {
    case 'q':
    case 'quit':
    case 'exit':
      console.log('Shutting down server...');
      server.close(() => {
        console.log('Server stopped');
        rl.close();
        process.exit(0);
      });
      break;
      
    case 'apiurl':
      console.log(`Current API URL: ${API_URL}`);
      break;
      
    case 'help':
      console.log('\nAvailable commands:');
      console.log('  q, quit, exit - Stop the server');
      console.log('  apiurl - Show current API URL');
      console.log('  help - Show available commands');
      break;
      
    default:
      console.log(`Unknown command: ${line.trim()}`);
      console.log('Type "help" for available commands');
  }
  
  rl.prompt();
}).on('close', () => {
  console.log('Server console closed');
  process.exit(0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT (Ctrl+C). Shutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});