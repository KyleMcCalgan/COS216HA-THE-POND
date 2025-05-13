document.addEventListener('DOMContentLoaded', function() {
    // WebSocket connection
    let ws = null;
    const serverLog = document.getElementById('server-log');
    
    // Function to add log entry
    function addLogEntry(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.classList.add(`log-${type}`);
        entry.textContent = `[${timestamp}] ${message}`;
        serverLog.appendChild(entry);
        serverLog.scrollTop = serverLog.scrollHeight;
    }
    
    // Function to connect to WebSocket
    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        
        // Update WebSocket status
        const wsStatus = document.getElementById('websocket-status');
        wsStatus.textContent = 'Connecting...';
        wsStatus.className = 'connecting';
        
        // Create WebSocket connection
        ws = new WebSocket(wsUrl);
        
        // WebSocket event handlers
        ws.onopen = function() {
            wsStatus.textContent = 'Connected';
            wsStatus.className = 'connected';
            addLogEntry('WebSocket connection established', 'success');
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                addLogEntry(`WebSocket message received: ${data.action}`, 'info');
                
                // Handle different message types
                switch (data.action) {
                    case 'connection_established':
                        addLogEntry(`Server time: ${data.serverTime}`, 'info');
                        break;
                        
                    case 'login_response':
                        if (data.success) {
                            addLogEntry(`Login successful: ${data.data.username}`, 'success');
                        } else {
                            addLogEntry(`Login failed: ${data.message}`, 'error');
                        }
                        break;
                        
                    case 'delivering_orders_update':
                        updateDeliveringOrders(data.orders);
                        break;
                        
                    case 'drone_status_update':
                        addLogEntry(`Received drone status update: ${data.drones.length} drones`, 'info');
                        break;
                        
                    case 'server_log':
                        // Handle server log messages
                        addLogEntry(`SERVER: ${data.message}`, data.type || 'info');
                        break;
                        
                    case 'connection_killed':
                        wsStatus.textContent = 'Disconnected (killed by server)';
                        wsStatus.className = 'disconnected';
                        addLogEntry(`Connection killed by server: ${data.message}`, 'error');
                        ws = null;
                        break;
                        
                    case 'server_shutdown':
                        wsStatus.textContent = 'Disconnected (server shutdown)';
                        wsStatus.className = 'disconnected';
                        addLogEntry(`Server shutdown: ${data.message}`, 'warning');
                        ws = null;
                        break;
                        
                    case 'error':
                        addLogEntry(`Server error: ${data.message}`, 'error');
                        break;
                }
            } catch (error) {
                addLogEntry(`Error parsing WebSocket message: ${error.message}`, 'error');
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        ws.onclose = function() {
            wsStatus.textContent = 'Disconnected';
            wsStatus.className = 'disconnected';
            addLogEntry('WebSocket connection closed', 'warning');
            ws = null;
        };
        
        ws.onerror = function(error) {
            wsStatus.textContent = 'Error';
            wsStatus.className = 'disconnected';
            addLogEntry(`WebSocket error: ${error.message}`, 'error');
            console.error('WebSocket error:', error);
        };
    }
    
    // Function to update delivering orders table
    function updateDeliveringOrders(orders) {
        const ordersTable = document.getElementById('delivering-orders');
        
        if (orders && orders.length > 0) {
            let html = '';
            orders.forEach(order => {
                const destCoords = order.destination ? 
                    `${order.destination.latitude}, ${order.destination.longitude}` : 
                    'Unknown';
                    
                html += `
                <tr>
                    <td>${order.order_id}</td>
                    <td>${order.customer_id}</td>
                    <td>${order.tracking_num}</td>
                    <td>${order.start_time}</td>
                    <td>${destCoords}</td>
                </tr>`;
            });
            ordersTable.innerHTML = html;
            addLogEntry(`Updated delivering orders: ${orders.length} orders`, 'info');
        } else {
            ordersTable.innerHTML = '<tr><td colspan="5">No orders being delivered</td></tr>';
        }
    }
    
    // Function to update active users table
    function updateActiveUsers(users) {
        const usersTable = document.getElementById('active-users');
        
        if (users && users.length > 0) {
            let html = '';
            users.forEach(user => {
                html += `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.userType}</td>
                    <td>${user.userId}</td>
                    <td>${user.connectedAt}</td>
                    <td>${user.lastActive}</td>
                </tr>`;
            });
            usersTable.innerHTML = html;
        } else {
            usersTable.innerHTML = '<tr><td colspan="5">No active users</td></tr>';
        }
    }
    
    // Function to update database changes table
    function updateDatabaseChanges(changes) {
        const changesTable = document.getElementById('db-changes');
        
        if (changes && changes.length > 0) {
            let html = '';
            changes.forEach(change => {
                const details = typeof change.details === 'object' ? 
                    JSON.stringify(change.details) : change.details;
                    
                html += `
                <tr>
                    <td>${change.timestamp}</td>
                    <td>${change.operation}</td>
                    <td>${change.success ? 'Yes' : 'No'}</td>
                    <td>${details}</td>
                </tr>`;
            });
            changesTable.innerHTML = html;
        } else {
            changesTable.innerHTML = '<tr><td colspan="4">No database changes recorded</td></tr>';
        }
    }
    
    // Function to fetch server debug information
    async function getServerInfo() {
        addLogEntry('Fetching server debug information...', 'info');
        
        try {
            const response = await fetch('/api/debug-info');
            const data = await response.json();
            
            // Update the UI with the data
            updateActiveUsers(data.connectedUsers);
            updateDeliveringOrders(data.deliveringOrders);
            updateDatabaseChanges(data.databaseChanges);
            
            addLogEntry(`Server uptime: ${data.serverUptime} seconds`, 'info');
            addLogEntry('Server information updated successfully', 'success');
            
            return data;
        } catch (error) {
            addLogEntry(`Error fetching server info: ${error.message}`, 'error');
            console.error('Error fetching server info:', error);
            return null;
        }
    }
    
    // Connect WebSocket button
    document.getElementById('connectWebSocketBtn').addEventListener('click', function() {
        if (!ws) {
            connectWebSocket();
        } else {
            addLogEntry('WebSocket already connected', 'warning');
        }
    });
    
    // Get server info button
    document.getElementById('getServerInfoBtn').addEventListener('click', function() {
        getServerInfo();
    });
    
    // Clear log button
    document.getElementById('clearLogBtn').addEventListener('click', function() {
        serverLog.innerHTML = '';
        addLogEntry('Log cleared', 'info');
    });
    
    // Get API connection info
    fetch('/api/connection-info')
        .then(response => response.json())
        .then(data => {
            document.getElementById('api-url-display').textContent = `Connected to API: ${data.apiUrl}`;
        })
        .catch(error => {
            document.getElementById('api-url-display').textContent = `Error connecting to API: ${error.message}`;
        });
        
    // Navigation
    const navButtons = document.querySelectorAll('.nav-button');
    const sections = document.querySelectorAll('.section-content');

    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            
            // Remove active class from all buttons and sections
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked button and corresponding section
            this.classList.add('active');
            document.getElementById(sectionId).classList.add('active');
        });
    });

    // Function to make API requests
    async function makeApiRequest(data) {
        const responseElement = document.getElementById('response');
        responseElement.textContent = 'Sending request...';
        
        try {
            const response = await fetch('/api/proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            responseElement.textContent = JSON.stringify(result, null, 2);
            
            // Log the API request in debug panel
            addLogEntry(`API Request: ${data.type}`, 'info');
            if (result.success) {
                addLogEntry(`API Response: Success`, 'success');
            } else {
                addLogEntry(`API Response: Failed - ${result.message}`, 'error');
            }
            
            // Update debug info after API requests that might change state
            if (['createUser', 'createOrder', 'createDrone', 'updateOrder', 'updateDrone'].includes(data.type)) {
                setTimeout(getServerInfo, 1000); // Delay to allow server to process
            }
            
            return result;
        } catch (error) {
            responseElement.textContent = `Error: ${error.message}`;
            addLogEntry(`API Error: ${error.message}`, 'error');
            console.error('Error making API request:', error);
        }
    }

    // Test Connection
    document.getElementById('testConnectionBtn').addEventListener('click', function() {
        makeApiRequest({ type: 'test' });
    });

    // Login
    document.getElementById('loginBtn').addEventListener('click', function() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        // First, call the API via HTTP
        makeApiRequest({ 
            type: 'login',
            username: username,
            password: password
        }).then(apiResponse => {
            // If WebSocket is connected, also send login via WebSocket
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    action: 'login',
                    username: username,
                    password: password
                }));
                addLogEntry(`Sent login request via WebSocket: ${username}`, 'info');
            } else {
                addLogEntry('WebSocket not connected. Login only processed via HTTP API.', 'warning');
            }
        });
    });

    // Create User
    document.getElementById('createUserBtn').addEventListener('click', function() {
        const username = document.getElementById('createUsername').value;
        const password = document.getElementById('createPassword').value;
        const email = document.getElementById('createEmail').value;
        const userType = document.getElementById('createUserType').value;
        
        makeApiRequest({ 
            type: 'createUser',
            username: username,
            password: password,
            email: email,
            user_type: userType
        });
    });

    // Get All Couriers
    document.getElementById('getAllCouriersBtn').addEventListener('click', function() {
        makeApiRequest({ type: 'getAllCouriers' });
    });

    // Create Order
    document.getElementById('createOrderBtn').addEventListener('click', function() {
        const customerId = document.getElementById('orderCustomerId').value;
        const destLat = document.getElementById('orderDestLat').value;
        const destLong = document.getElementById('orderDestLong').value;
        const productsInput = document.getElementById('orderProducts').value;
        
        let products;
        try {
            products = JSON.parse(productsInput);
        } catch (e) {
            document.getElementById('response').textContent = `Error parsing products JSON: ${e.message}`;
            addLogEntry(`Error parsing products JSON: ${e.message}`, 'error');
            return;
        }
        
        makeApiRequest({ 
            type: 'createOrder',
            customer_id: parseInt(customerId),
            destination_latitude: parseFloat(destLat),
            destination_longitude: parseFloat(destLong),
            products: products
        });
    });

    // Get All Orders
    document.getElementById('getAllOrdersBtn').addEventListener('click', function() {
        const userId = document.getElementById('getAllOrdersUserId').value;
        const userType = document.getElementById('getAllOrdersUserType').value;
        
        makeApiRequest({ 
            type: 'getAllOrders',
            user_id: parseInt(userId),
            user_type: userType
        });
    });

    // Get Specific Order
    document.getElementById('getOrderBtn').addEventListener('click', function() {
        const customerId = document.getElementById('getOrderCustomerId').value;
        const orderId = document.getElementById('getOrderId').value;
        
        makeApiRequest({ 
            type: 'getOrder',
            customer_id: parseInt(customerId),
            order_id: parseInt(orderId)
        });
    });

    // Update Order
    document.getElementById('updateOrderBtn').addEventListener('click', function() {
        const customerId = document.getElementById('updateOrderCustomerId').value;
        const orderId = document.getElementById('updateOrderId').value;
        const destLat = document.getElementById('updateOrderDestLat').value;
        const destLong = document.getElementById('updateOrderDestLong').value;
        const state = document.getElementById('updateOrderState').value;
        
        const data = {
            type: 'updateOrder',
            customer_id: parseInt(customerId),
            order_id: parseInt(orderId)
        };
        
        // Only add fields that have values
        if (destLat && destLong) {
            data.destination_latitude = parseFloat(destLat);
            data.destination_longitude = parseFloat(destLong);
        }
        
        if (state) {
            data.state = state;
        }
        
        makeApiRequest(data);
    });

    // Create Drone
    document.getElementById('createDroneBtn').addEventListener('click', function() {
        const isAvailable = document.getElementById('droneIsAvailable').value === 'true';
        const latitude = document.getElementById('droneLatitude').value;
        const longitude = document.getElementById('droneLongitude').value;
        const altitude = document.getElementById('droneAltitude').value;
        const batteryLevel = document.getElementById('droneBatteryLevel').value;
        const operatorId = document.getElementById('droneOperatorId').value;
        
        const data = {
            type: 'createDrone',
            is_available: isAvailable,
            latest_latitude: parseFloat(latitude),
            latest_longitude: parseFloat(longitude),
            altitude: parseFloat(altitude),
            battery_level: parseInt(batteryLevel)
        };
        
        if (operatorId) {
            data.current_operator_id = parseInt(operatorId);
        }
        
        makeApiRequest(data);
    });

    // Get All Drones
    document.getElementById('getAllDronesBtn').addEventListener('click', function() {
        makeApiRequest({ type: 'getAllDrones' });
    });

    // Update Drone
    document.getElementById('updateDroneBtn').addEventListener('click', function() {
        const droneId = document.getElementById('updateDroneId').value;
        const isAvailable = document.getElementById('updateDroneIsAvailable').value;
        const latitude = document.getElementById('updateDroneLatitude').value;
        const longitude = document.getElementById('updateDroneLongitude').value;
        const altitude = document.getElementById('updateDroneAltitude').value;
        const batteryLevel = document.getElementById('updateDroneBatteryLevel').value;
        const operatorId = document.getElementById('updateDroneOperatorId').value;
        
        const data = {
            type: 'updateDrone',
            id: parseInt(droneId)
        };
        
        // Only add fields that have values
        if (isAvailable !== '') {
            data.is_available = isAvailable === 'true';
        }
        
        if (latitude && longitude) {
            data.latest_latitude = parseFloat(latitude);
            data.latest_longitude = parseFloat(longitude);
        }
        
        if (altitude) {
            data.altitude = parseFloat(altitude);
        }
        
        if (batteryLevel) {
            data.battery_level = parseInt(batteryLevel);
        }
        
        if (operatorId === 'null') {
            data.current_operator_id = null;
        } else if (operatorId) {
            data.current_operator_id = parseInt(operatorId);
        }
        
        makeApiRequest(data);
    });
    
    // Initialize UI with a welcome message
    addLogEntry('Debug panel initialized. Welcome to the Couriers API Test Client!', 'info');
    addLogEntry('Click "Connect WebSocket" to establish a WebSocket connection.', 'info');
    
    // Auto-refresh debug info every 30 seconds
    setInterval(function() {
        if (document.getElementById('debug').classList.contains('active')) {
            getServerInfo();
            addLogEntry('Auto-refreshed server information', 'info');
        }
    }, 30000);
});