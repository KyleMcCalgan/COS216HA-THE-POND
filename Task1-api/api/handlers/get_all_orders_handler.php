<?php
/**
 * Get All Orders Handler
 * 
 * Your Name, Surname, Student Number
 * 
 * This handler returns orders based on the user's role.
 * When a courier uses this endpoint, they get all orders.
 * When a customer uses it, they only get their own orders.
 */

/**
 * Handle get all orders request
 */
function handleGetAllOrders($data) {
    // Check if user ID and type are provided
    if (!isset($data['user_id']) || !isset($data['user_type'])) {
        apiResponse(false, null, 'User ID and user type are required.');
        exit;
    }
    
    $userId = intval($data['user_id']);
    $userType = $data['user_type'];
    
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Verify user exists
        $userStmt = $conn->prepare("SELECT id, type FROM Users WHERE id = ?");
        $userStmt->bind_param("i", $userId);
        $userStmt->execute();
        $userResult = $userStmt->get_result();
        
        if ($userResult->num_rows === 0) {
            $userStmt->close();
            $conn->close();
            apiResponse(false, null, 'User not found.');
            exit;
        }
        
        $user = $userResult->fetch_assoc();
        
        // Verify user type matches the provided type
        if ($user['type'] !== $userType) {
            $userStmt->close();
            $conn->close();
            apiResponse(false, null, 'User type mismatch.');
            exit;
        }
        
        $userStmt->close();
        
        // Build the SQL query based on user type
        if ($userType === 'Courier') {
            // Couriers can see all orders
            $sql = "SELECT * FROM Orders";
            $stmt = $conn->prepare($sql);
        } else if ($userType === 'Customer') {
            // Customers can only see their own orders
            $sql = "SELECT * FROM Orders WHERE customer_id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("i", $userId);
        } else {
            $conn->close();
            apiResponse(false, null, 'Invalid user type for this operation.');
            exit;
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        $orders = [];
        
        while ($order = $result->fetch_assoc()) {
            // Get products for this order
            $orderProducts = [];
            
            $productsStmt = $conn->prepare("SELECT op.product_id, op.quantity, p.title, p.brand 
                                          FROM Orders_Products op 
                                          JOIN Products p ON op.product_id = p.id 
                                          WHERE op.order_id = ?");
            $productsStmt->bind_param("i", $order['order_id']);
            $productsStmt->execute();
            $productsResult = $productsStmt->get_result();
            
            while ($product = $productsResult->fetch_assoc()) {
                $orderProducts[] = $product;
            }
            
            $productsStmt->close();
            
            // Add products to order data
            $order['products'] = $orderProducts;
            
            // Get customer info
            $customerStmt = $conn->prepare("SELECT username, email FROM Users WHERE id = ?");
            $customerStmt->bind_param("i", $order['customer_id']);
            $customerStmt->execute();
            $customerResult = $customerStmt->get_result();
            
            if ($customerResult->num_rows > 0) {
                $customer = $customerResult->fetch_assoc();
                $order['customer'] = [
                    'id' => $order['customer_id'],
                    'username' => $customer['username'],
                    'email' => $customer['email']
                ];
            }
            
            $customerStmt->close();
            
            $orders[] = $order;
        }
        
        $stmt->close();
        $conn->close();
        
        apiResponse(true, $orders, 'Orders retrieved successfully.');
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}