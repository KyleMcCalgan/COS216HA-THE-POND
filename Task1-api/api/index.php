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
    
    //helper function for testing purposes
    case 'createUser':
        require_once './handlers/create_user_handler.php';
        handleCreateUser($postData);
        break;
        
    case 'createOrder':
        require_once './handlers/create_order_handler.php';
        handleCreateOrder($postData);
        break;
        
    case 'updateOrder':
        require_once './handlers/update_order_handler.php';
        handleUpdateOrder($postData);
        break;
    
    //has some funky functionality when used by a courier it gets all, when used by 
    //a user it gets only their orders
    case 'getAllOrders':
        require_once './handlers/get_all_orders_handler.php';
        handleGetAllOrders($postData);
        break;

    //additional case not in spec
    case 'getOrder':
        require_once './handlers/get_order_handler.php';
        handleGetOrder($postData);
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

    // New handler for getting all products
    case 'getAllProducts':
        require_once './handlers/get_all_products_handler.php';
        handleGetAllProducts($postData);
        break;
        
    case 'test':
        require_once './handlers/test_handler.php';
        handleTest();
        break;
    
    //additional helper case not in spec
    case 'getAllCouriers':
        require_once './handlers/get_all_couriers_handler.php';
        handleGetAllCouriers($postData);
        break;

    default:
        apiResponse(false, null, 'Invalid action type: ' . $actionType);
        break;
}