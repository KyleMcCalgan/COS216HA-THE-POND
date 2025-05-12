<?php
/**
 * Get All Drones Handler
 * 
 * Your Name, Surname, Student Number
 * 
 * This handler returns all drones in the database.
 */

/**
 * Handle get all drones request
 */
function handleGetAllDrones($data) {
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Prepare and execute query
        $sql = "SELECT d.*, u.username as operator_username, u.email as operator_email 
                FROM Drones d 
                LEFT JOIN Users u ON d.current_operator_id = u.id";
        
        $result = $conn->query($sql);
        
        if ($result) {
            $drones = [];
            
            while ($drone = $result->fetch_assoc()) {
                // Convert boolean field for response
                $drone['is_available'] = $drone['is_available'] == 1;
                
                // Format operator info
                if ($drone['current_operator_id']) {
                    $drone['operator'] = [
                        'id' => $drone['current_operator_id'],
                        'username' => $drone['operator_username'],
                        'email' => $drone['operator_email']
                    ];
                } else {
                    $drone['operator'] = null;
                }
                
                // Remove redundant fields
                unset($drone['operator_username']);
                unset($drone['operator_email']);
                
                $drones[] = $drone;
            }
            
            // Return all drones
            apiResponse(true, $drones, 'Drones retrieved successfully.');
        } else {
            apiResponse(false, null, 'Failed to fetch drones: ' . $conn->error);
        }
        
        // Close connection
        $conn->close();
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}