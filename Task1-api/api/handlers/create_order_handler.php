<?php
/**
 * Create Order Handler
 * 
 * Your Name, Surname, Student Number
 * 
 * This handler adds a new order to the database.
 */

/**
 * Handle create order request
 */
function handleCreateOrder($data) {
    // Check if required fields are provided
    if (!isset($data['customer_id']) || 
        !isset($data['products']) || 
        !isset($data['destination_latitude']) || 
        !isset($data['destination_longitude'])) {
        
        apiResponse(false, null, 'Missing required order information.');
        exit;
    }

    // Extract and validate order data
    $customerId = intval($data['customer_id']);
    $destinationLatitude = floatval($data['destination_latitude']);
    $destinationLongitude = floatval($data['destination_longitude']);
    $products = $data['products'];
    
    // Validate coordinates (must be within 5km radius of HQ)
    global $hqLatitude, $hqLongitude;
    $distance = calculateDistance($hqLatitude, $hqLongitude, $destinationLatitude, $destinationLongitude);
    if ($distance > 5000) {
        apiResponse(false, null, 'Destination is outside the 5km operation radius.');
        exit;
    }
    
    // Validate products array
    if (!is_array($products) || count($products) === 0) {
        apiResponse(false, null, 'Products must be a non-empty array.');
        exit;
    }
    
    // Check total number of products (max 7)
    $totalQuantity = 0;
    foreach ($products as $product) {
        if (!isset($product['id']) || !isset($product['quantity'])) {
            apiResponse(false, null, 'Each product must have an id and quantity.');
            exit;
        }
        
        if ($product['quantity'] <= 0) {
            apiResponse(false, null, 'Product quantities must be positive.');
            exit;
        }
        
        $totalQuantity += $product['quantity'];
    }
    
    if ($totalQuantity > 7) {
        apiResponse(false, null, 'Total product quantity exceeds the maximum of 7 items per order.');
        exit;
    }
    
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Start transaction
        $conn->begin_transaction();
        
        // Check if customer exists and is of type 'Customer'
        $customerStmt = $conn->prepare("SELECT id FROM Users WHERE id = ? AND type = 'Customer'");
        $customerStmt->bind_param("i", $customerId);
        $customerStmt->execute();
        $customerResult = $customerStmt->get_result();
        
        if ($customerResult->num_rows === 0) {
            $customerStmt->close();
            $conn->rollback();
            apiResponse(false, null, 'Invalid customer ID or user is not a customer.');
            exit;
        }
        $customerStmt->close();
        
        // Generate tracking number (CS- followed by 8 random characters)
        $trackingNum = 'CS-' . substr(str_shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 8);
        
        // Set default state to 'Storage'
        $state = 'Storage';
        
        // Set delivery date to current date/time
        $deliveryDate = date('Y-m-d H:i:s');
        
        // Insert order - let the database auto-increment the order_id
        $orderStmt = $conn->prepare("INSERT INTO Orders (customer_id, tracking_num, destination_latitude, destination_longitude, state, delivery_date) 
                                    VALUES (?, ?, ?, ?, ?, ?)");
        $orderStmt->bind_param("isddss", $customerId, $trackingNum, $destinationLatitude, $destinationLongitude, $state, $deliveryDate);
        
        if (!$orderStmt->execute()) {
            $orderStmt->close();
            $conn->rollback();
            apiResponse(false, null, 'Failed to create order: ' . $orderStmt->error);
            exit;
        }
        
        // Get the auto-generated order_id
        $orderId = $conn->insert_id;
        $orderStmt->close();
        
        // Verify all products exist before adding them to the order
        foreach ($products as $product) {
            $productId = intval($product['id']);
            
            $productStmt = $conn->prepare("SELECT id, is_available FROM Products WHERE id = ?");
            $productStmt->bind_param("i", $productId);
            $productStmt->execute();
            $productResult = $productStmt->get_result();
            
            if ($productResult->num_rows === 0) {
                $productStmt->close();
                $conn->rollback();
                apiResponse(false, null, 'Product with ID ' . $productId . ' does not exist.');
                exit;
            }
            
            $productRow = $productResult->fetch_assoc();
            if ($productRow['is_available'] != 1) {
                $productStmt->close();
                $conn->rollback();
                apiResponse(false, null, 'Product with ID ' . $productId . ' is not available.');
                exit;
            }
            
            $productStmt->close();
        }
        
        // Insert order products
        $orderProductStmt = $conn->prepare("INSERT INTO Orders_Products (order_id, product_id, quantity) VALUES (?, ?, ?)");
        
        foreach ($products as $product) {
            $productId = intval($product['id']);
            $quantity = intval($product['quantity']);
            
            $orderProductStmt->bind_param("iii", $orderId, $productId, $quantity);
            
            if (!$orderProductStmt->execute()) {
                $orderProductStmt->close();
                $conn->rollback();
                apiResponse(false, null, 'Failed to add product to order: ' . $orderProductStmt->error);
                exit;
            }
        }
        
        $orderProductStmt->close();
        
        // Commit transaction
        $conn->commit();
        
        // Prepare response data
        $orderData = [
            'customer_id' => $customerId,
            'order_id' => $orderId,
            'tracking_num' => $trackingNum,
            'destination_latitude' => $destinationLatitude,
            'destination_longitude' => $destinationLongitude,
            'state' => $state,
            'delivery_date' => $deliveryDate,
            'products' => $products
        ];
        
        apiResponse(true, $orderData, 'Order created successfully.');
        
        // Close connection
        $conn->close();
        
    } catch (Exception $e) {
        // Rollback transaction on error
        if (isset($conn) && $conn->ping()) {
            $conn->rollback();
            $conn->close();
        }
        
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}