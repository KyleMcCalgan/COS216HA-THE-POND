<?php
/**
 * Update Order Handler
 * 
 * Your Name, Surname, Student Number
 * 
 * This handler updates the relevant fields in the Orders table.
 */

/**
 * Handle update order request
 */
function handleUpdateOrder($data) {
    // Check if required fields are provided
    if (!isset($data['customer_id']) || !isset($data['order_id'])) {
        apiResponse(false, null, 'Customer ID and Order ID are required.');
        exit;
    }
    
    $customerId = intval($data['customer_id']);
    $orderId = intval($data['order_id']);
    
    // Check if at least one field to update is provided
    if (!isset($data['destination_latitude']) && 
        !isset($data['destination_longitude']) && 
        !isset($data['state'])) {
        
        apiResponse(false, null, 'No fields to update were provided.');
        exit;
    }
    
    // Build update query dynamically based on provided fields
    $updateFields = [];
    $bindTypes = "";
    $bindParams = [];
    
    // Destination latitude and longitude
    if (isset($data['destination_latitude']) && isset($data['destination_longitude'])) {
        $destinationLatitude = floatval($data['destination_latitude']);
        $destinationLongitude = floatval($data['destination_longitude']);
        
        // Validate coordinates (must be within 5km radius of HQ)
        global $hqLatitude, $hqLongitude;
        $distance = calculateDistance($hqLatitude, $hqLongitude, $destinationLatitude, $destinationLongitude);
        if ($distance > 5000) {
            apiResponse(false, null, 'Destination is outside the 5km operation radius.');
            exit;
        }
        
        $updateFields[] = "destination_latitude = ?";
        $bindTypes .= "d";
        $bindParams[] = $destinationLatitude;
        
        $updateFields[] = "destination_longitude = ?";
        $bindTypes .= "d";
        $bindParams[] = $destinationLongitude;
    } else if (isset($data['destination_latitude']) || isset($data['destination_longitude'])) {
        // Both latitude and longitude must be provided together
        apiResponse(false, null, 'Both destination latitude and longitude must be provided together.');
        exit;
    }
    
    // State
    if (isset($data['state'])) {
        $state = $data['state'];
        
        // Validate state
        $validStates = ['Storage', 'Out_for_delivery', 'Delivered'];
        if (!in_array($state, $validStates)) {
            apiResponse(false, null, 'Invalid state. Must be one of: ' . implode(', ', $validStates));
            exit;
        }
        
        $updateFields[] = "state = ?";
        $bindTypes .= "s";
        $bindParams[] = $state;
    }
    
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Check if order exists
        $checkStmt = $conn->prepare("SELECT customer_id, order_id FROM Orders WHERE customer_id = ? AND order_id = ?");
        $checkStmt->bind_param("ii", $customerId, $orderId);
        $checkStmt->execute();
        
        if ($checkStmt->get_result()->num_rows === 0) {
            $checkStmt->close();
            $conn->close();
            apiResponse(false, null, 'Order not found.');
            exit;
        }
        
        $checkStmt->close();
        
        // Build the SQL query
        $sql = "UPDATE Orders SET " . implode(", ", $updateFields) . " WHERE customer_id = ? AND order_id = ?";
        
        // Add customer_id and order_id to bind parameters
        $bindTypes .= "ii";
        $bindParams[] = $customerId;
        $bindParams[] = $orderId;
        
        // Prepare and execute the statement
        $stmt = $conn->prepare($sql);
        
        // Create reference array for bind_param
        $bindParamRefs = [];
        $bindParamRefs[] = &$bindTypes;
        
        foreach ($bindParams as $key => $value) {
            $bindParamRefs[] = &$bindParams[$key];
        }
        
        call_user_func_array([$stmt, 'bind_param'], $bindParamRefs);
        
        // Execute the statement
        if ($stmt->execute()) {
            // Check if any rows were affected
            if ($stmt->affected_rows > 0) {
                // Fetch the updated order data
                $stmt->close();
                
                $fetchStmt = $conn->prepare("SELECT * FROM Orders WHERE customer_id = ? AND order_id = ?");
                $fetchStmt->bind_param("ii", $customerId, $orderId);
                $fetchStmt->execute();
                $result = $fetchStmt->get_result();
                
                if ($result->num_rows > 0) {
                    $orderData = $result->fetch_assoc();
                    
                    // Get order products
                    $fetchStmt->close();
                    
                    $productsStmt = $conn->prepare("SELECT op.product_id, op.quantity, p.title, p.brand 
                                                  FROM Orders_Products op 
                                                  JOIN Products p ON op.product_id = p.id 
                                                  WHERE op.order_id = ?");
                    $productsStmt->bind_param("i", $orderId);
                    $productsStmt->execute();
                    $productsResult = $productsStmt->get_result();
                    
                    $products = [];
                    while ($product = $productsResult->fetch_assoc()) {
                        $products[] = $product;
                    }
                    
                    $orderData['products'] = $products;
                    $productsStmt->close();
                    
                    apiResponse(true, $orderData, 'Order updated successfully.');
                } else {
                    $fetchStmt->close();
                    apiResponse(false, null, 'Failed to fetch updated order data.');
                }
            } else {
                // No rows were affected (data might be the same)
                $stmt->close();
                apiResponse(true, null, 'No changes were made. The data may be the same as existing values.');
            }
        } else {
            $stmt->close();
            apiResponse(false, null, 'Failed to update order: ' . $stmt->error);
        }
        
        // Close connection
        $conn->close();
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}