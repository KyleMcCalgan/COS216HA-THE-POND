<?php
/**
 * Get Order Handler
 * 
 * Your Name, Surname, Student Number
 * 
 * This handler returns a single order by customer_id and order_id.
 */

/**
 * Handle get order request
 */
function handleGetOrder($data) {
    // Check if required fields are provided
    if (!isset($data['customer_id']) || !isset($data['order_id'])) {
        apiResponse(false, null, 'Customer ID and Order ID are required.');
        exit;
    }
    
    $customerId = intval($data['customer_id']);
    $orderId = intval($data['order_id']);
    
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Get order
        $orderStmt = $conn->prepare("SELECT * FROM Orders WHERE customer_id = ? AND order_id = ?");
        $orderStmt->bind_param("ii", $customerId, $orderId);
        $orderStmt->execute();
        $orderResult = $orderStmt->get_result();
        
        if ($orderResult->num_rows === 0) {
            $orderStmt->close();
            $conn->close();
            apiResponse(false, null, 'Order not found.');
            exit;
        }
        
        $order = $orderResult->fetch_assoc();
        $orderStmt->close();
        
        // Get products for this order
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
        
        $productsStmt->close();
        
        // Add products to order data
        $order['products'] = $products;
        
        // Get customer info
        $customerStmt = $conn->prepare("SELECT username, email FROM Users WHERE id = ?");
        $customerStmt->bind_param("i", $customerId);
        $customerStmt->execute();
        $customerResult = $customerStmt->get_result();
        
        if ($customerResult->num_rows > 0) {
            $customer = $customerResult->fetch_assoc();
            $order['customer'] = [
                'id' => $customerId,
                'username' => $customer['username'],
                'email' => $customer['email']
            ];
        }
        
        $customerStmt->close();
        $conn->close();
        
        apiResponse(true, $order, 'Order retrieved successfully.');
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}