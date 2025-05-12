<?php
/**
 * Get All Couriers Handler
 * 
 * Your Name, Surname, Student Number
 */

/**
 * Handle get all couriers request
 */
function handleGetAllCouriers($data) {
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Prepare and execute query
        $sql = "SELECT id, username, email FROM Users WHERE type = 'Courier'";
        $result = $conn->query($sql);
        
        if ($result) {
            $couriers = [];
            
            while ($courier = $result->fetch_assoc()) {
                $couriers[] = $courier;
            }
            
            // Return all couriers
            apiResponse(true, $couriers, 'Couriers retrieved successfully.');
        } else {
            apiResponse(false, null, 'Failed to fetch couriers: ' . $conn->error);
        }
        
        // Close connection
        $conn->close();
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}