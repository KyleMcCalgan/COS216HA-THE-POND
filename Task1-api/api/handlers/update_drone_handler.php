<?php
/**
 * Update Drone Handler
 * 
 * Your Name, Surname, Student Number
 * 
 * This handler updates the relevant fields in the Drones table.
 */

/**
 * Handle update drone request
 */
function handleUpdateDrone($data) {
    // Check if drone ID is provided
    if (!isset($data['id'])) {
        apiResponse(false, null, 'Drone ID is required.');
        exit;
    }
    
    $droneId = intval($data['id']);
    
    // Check if at least one field to update is provided
    if (!isset($data['current_operator_id']) && 
        !isset($data['is_available']) && 
        !isset($data['latest_latitude']) && 
        !isset($data['latest_longitude']) && 
        !isset($data['altitude']) && 
        !isset($data['battery_level'])) {
        
        apiResponse(false, null, 'No fields to update were provided.');
        exit;
    }
    
    // Build update query dynamically based on provided fields
    $updateFields = [];
    $bindTypes = "";
    $bindParams = [];
    
    // Current operator ID (can be null)
    if (isset($data['current_operator_id'])) {
        if ($data['current_operator_id'] === null) {
            $updateFields[] = "current_operator_id = NULL";
        } else {
            $updateFields[] = "current_operator_id = ?";
            $bindTypes .= "i";
            $bindParams[] = $data['current_operator_id'];
        }
    }
    
    // Is available
    if (isset($data['is_available'])) {
        $updateFields[] = "is_available = ?";
        $bindTypes .= "i";
        $bindParams[] = $data['is_available'] ? 1 : 0;
    }
    
    // Latest latitude and longitude
    if (isset($data['latest_latitude']) && isset($data['latest_longitude'])) {
        // Validate coordinates (must be within 5km radius of HQ)
        $latestLatitude = floatval($data['latest_latitude']);
        $latestLongitude = floatval($data['latest_longitude']);
        
        if (!isWithinRange($latestLatitude, $latestLongitude)) {
            apiResponse(false, null, 'Drone location is outside the 5km operation radius.');
            exit;
        }
        
        $updateFields[] = "latest_latitude = ?";
        $bindTypes .= "d";
        $bindParams[] = $latestLatitude;
        
        $updateFields[] = "latest_longitude = ?";
        $bindTypes .= "d";
        $bindParams[] = $latestLongitude;
    } else if (isset($data['latest_latitude']) || isset($data['latest_longitude'])) {
        // Both latitude and longitude must be provided together
        apiResponse(false, null, 'Both latitude and longitude must be provided together.');
        exit;
    }
    
    // Altitude
    if (isset($data['altitude'])) {
        $altitude = floatval($data['altitude']);
        
        // Validate altitude
        if ($altitude < 0) {
            apiResponse(false, null, 'Altitude cannot be negative.');
            exit;
        }
        
        // Check if altitude is above 30 meters (drone will crash)
        if ($altitude > 30) {
            // We'll still update the database but include a warning in the response
            $warningMessage = 'Warning: Altitude exceeds 30 meters. Drone may lose connection and crash.';
        }
        
        $updateFields[] = "altitude = ?";
        $bindTypes .= "d";
        $bindParams[] = $altitude;
    }
    
    // Battery level
    if (isset($data['battery_level'])) {
        $batteryLevel = intval($data['battery_level']);
        
        // Validate battery level
        if ($batteryLevel < 0 || $batteryLevel > 100) {
            apiResponse(false, null, 'Battery level must be between 0 and 100.');
            exit;
        }
        
        $updateFields[] = "battery_level = ?";
        $bindTypes .= "i";
        $bindParams[] = $batteryLevel;
    }
    
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Build the SQL query
        $sql = "UPDATE Drones SET " . implode(", ", $updateFields) . " WHERE id = ?";
        
        // Add drone ID to bind parameters
        $bindTypes .= "i";
        $bindParams[] = $droneId;
        
        // Prepare and execute the statement
        $stmt = $conn->prepare($sql);
        
        // Dynamically bind parameters
        if (!empty($bindParams)) {
            // Create reference array for bind_param
            $bindParamRefs = [];
            $bindParamRefs[] = &$bindTypes;
            
            foreach ($bindParams as $key => $value) {
                $bindParamRefs[] = &$bindParams[$key];
            }
            
            call_user_func_array([$stmt, 'bind_param'], $bindParamRefs);
        }
        
        // Execute the statement
        if ($stmt->execute()) {
            // Check if any rows were affected
            if ($stmt->affected_rows > 0) {
                // Fetch the updated drone data
                $stmt->close();
                
                $fetchStmt = $conn->prepare("SELECT * FROM Drones WHERE id = ?");
                $fetchStmt->bind_param("i", $droneId);
                $fetchStmt->execute();
                $result = $fetchStmt->get_result();
                
                if ($result->num_rows > 0) {
                    $droneData = $result->fetch_assoc();
                    
                    // Convert boolean field for response
                    $droneData['is_available'] = $droneData['is_available'] == 1;
                    
                    $message = 'Drone updated successfully.';
                    if (isset($warningMessage)) {
                        $message .= ' ' . $warningMessage;
                    }
                    
                    apiResponse(true, $droneData, $message);
                } else {
                    apiResponse(false, null, 'Failed to fetch updated drone data.');
                }
                
                $fetchStmt->close();
            } else {
                // No rows were affected (drone ID might not exist)
                apiResponse(false, null, 'No changes were made. Drone ID might not exist.');
            }
        } else {
            apiResponse(false, null, 'Failed to update drone: ' . $stmt->error);
        }
        
        // Close connection
        $conn->close();
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}