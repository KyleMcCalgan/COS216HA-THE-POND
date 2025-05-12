<?php
/**
 * Create Drone Handler
 * 
 * Your Name, Surname, Student Number
 * 
 * This handler adds a new drone to the database.
 */

/**
 * Handle create drone request
 */
function handleCreateDrone($data) {
    // Check required fields
    if (!isset($data['is_available']) || 
        !isset($data['latest_latitude']) || 
        !isset($data['latest_longitude']) || 
        !isset($data['altitude']) || 
        !isset($data['battery_level'])) {
        
        apiResponse(false, null, 'Missing required drone information.');
        exit;
    }

    // Extract and validate drone data
    $isAvailable = $data['is_available'] ? 1 : 0;
    $latestLatitude = floatval($data['latest_latitude']);
    $latestLongitude = floatval($data['latest_longitude']);
    $altitude = floatval($data['altitude']);
    $batteryLevel = intval($data['battery_level']);
    
    // Optional: current operator ID (can be null)
    $currentOperatorId = isset($data['current_operator_id']) ? intval($data['current_operator_id']) : null;
    
    // Validate coordinates (must be within 5km radius of HQ)
    global $hqLatitude, $hqLongitude;
    $distance = calculateDistance($hqLatitude, $hqLongitude, $latestLatitude, $latestLongitude);
    if ($distance > 5000) {
        apiResponse(false, null, 'Drone location is outside the 5km operation radius.');
        exit;
    }
    
    // Validate altitude (cannot be negative)
    if ($altitude < 0) {
        apiResponse(false, null, 'Altitude cannot be negative.');
        exit;
    }
    
    // Validate battery level (0-100)
    if ($batteryLevel < 0 || $batteryLevel > 100) {
        apiResponse(false, null, 'Battery level must be between 0 and 100.');
        exit;
    }
    
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Prepare statement
        $sql = "INSERT INTO Drones (current_operator_id, is_available, latest_latitude, latest_longitude, altitude, battery_level) 
                VALUES (?, ?, ?, ?, ?, ?)";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("iddddi", $currentOperatorId, $isAvailable, $latestLatitude, $latestLongitude, $altitude, $batteryLevel);
        
        // Execute query
        if ($stmt->execute()) {
            $droneId = $conn->insert_id;
            
            // Return the created drone data
            $droneData = [
                'id' => $droneId,
                'current_operator_id' => $currentOperatorId,
                'is_available' => $isAvailable == 1,
                'latest_latitude' => $latestLatitude,
                'latest_longitude' => $latestLongitude,
                'altitude' => $altitude,
                'battery_level' => $batteryLevel
            ];
            
            apiResponse(true, $droneData, 'Drone created successfully.');
        } else {
            apiResponse(false, null, 'Failed to create drone: ' . $stmt->error);
        }
        
        // Close statement and connection
        $stmt->close();
        $conn->close();
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}