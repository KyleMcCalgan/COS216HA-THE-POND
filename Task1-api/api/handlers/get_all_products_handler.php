<?php
/**
 * Get All Products Handler
 * 
 * Your Name, Surname, Student Number
 * 
 * This handler returns all products in the database.
 */

/**
 * Handle get all products request
 */
function handleGetAllProducts($data) {
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Prepare and execute query
        $sql = "SELECT * FROM Products WHERE is_available = 1";
        $result = $conn->query($sql);
        
        if ($result) {
            $products = [];
            
            while ($product = $result->fetch_assoc()) {
                // Convert boolean field for response
                $product['is_available'] = $product['is_available'] == 1;
                
                // Get distributor info if available
                if ($product['distributor']) {
                    $distributor_query = "SELECT username, email FROM Users WHERE id = ?";
                    $distributor_stmt = $conn->prepare($distributor_query);
                    $distributor_stmt->bind_param("i", $product['distributor']);
                    $distributor_stmt->execute();
                    $distributor_result = $distributor_stmt->get_result();
                    
                    if ($distributor_result->num_rows > 0) {
                        $distributor = $distributor_result->fetch_assoc();
                        $product['distributor_info'] = [
                            'id' => $product['distributor'],
                            'username' => $distributor['username'],
                            'email' => $distributor['email']
                        ];
                    }
                    
                    $distributor_stmt->close();
                }
                
                $products[] = $product;
            }
            
            // Return all products
            apiResponse(true, $products, 'Products retrieved successfully.');
        } else {
            apiResponse(false, null, 'Failed to fetch products: ' . $conn->error);
        }
        
        // Close connection
        $conn->close();
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}