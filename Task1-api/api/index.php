<?php
/**
 * Centralized API Endpoint
 * 
 * Your Name, Surname, Student Number
 * 
 * This file handles all API requests through a single endpoint.
 */

// Include configuration files
require_once '../config/database.php';
require_once '../config/config.php';
require_once './utils/response_utils.php';

// Allow cross-origin requests (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed. Please use POST.');
    exit;
}

// Get input data
$postData = json_decode(file_get_contents('php://input'), true);

// If JSON parsing failed, try form data
if (!$postData) {
    $postData = $_POST;
}

// Check if action type is specified
if (!isset($postData['type'])) {
    apiResponse(false, null, 'Action type is required.');
    exit;
}

// Get the action type
$actionType = $postData['type'];

// Route to the appropriate handler based on action type
switch ($actionType) {
    case 'login':
        require_once './handlers/login_handler.php';
        handleLogin($postData);
        break;
        
    case 'createOrder':
        require_once './handlers/create_order_handler.php';
        handleCreateOrder($postData);
        break;
        
    case 'updateOrder':
        require_once './handlers/update_order_handler.php';
        handleUpdateOrder($postData);
        break;
        
    case 'getAllOrders':
        require_once './handlers/get_all_orders_handler.php';
        handleGetAllOrders($postData);
        break;
        
    case 'createDrone':
        require_once './handlers/create_drone_handler.php';
        handleCreateDrone($postData);
        break;
        
    case 'updateDrone':
        require_once './handlers/update_drone_handler.php';
        handleUpdateDrone($postData);
        break;
        
    case 'getAllDrones':
        require_once './handlers/get_all_drones_handler.php';
        handleGetAllDrones($postData);
        break;
        
    case 'test':
        require_once './handlers/test_handler.php';
        handleTest();
        break;
        
    default:
        apiResponse(false, null, 'Invalid action type: ' . $actionType);
        break;
}