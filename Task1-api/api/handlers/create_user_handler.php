<?php
/**
 * Create User Handler
 * 
 * Your Name, Surname, Student Number
 * 
 * This handler adds a new user to the database.
 */

/**
 * Handle create user request
 */
function handleCreateUser($data) {
    // Check if required fields are provided
    if (!isset($data['username']) || 
        !isset($data['password']) || 
        !isset($data['email']) || 
        !isset($data['user_type'])) {  // Changed from 'type' to 'user_type'
        
        apiResponse(false, null, 'Missing required user information.');
        exit;
    }

    // Extract and sanitize user data
    $username = trim($data['username']);
    $password = $data['password'];
    $email = trim($data['email']);
    $userType = trim($data['user_type']);  // Changed from 'type' to 'user_type'
    
    // Validate username
    if (empty($username) || strlen($username) < 3) {
        apiResponse(false, null, 'Username must be at least 3 characters long.');
        exit;
    }
    
    // Validate password
    if (empty($password) || strlen($password) < 6) {
        apiResponse(false, null, 'Password must be at least 6 characters long.');
        exit;
    }
    
    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        apiResponse(false, null, 'Invalid email format.');
        exit;
    }
    
    // Validate user type
    $validTypes = ['Customer', 'Courier', 'Distributor'];
    if (!in_array($userType, $validTypes)) {
        apiResponse(false, null, 'Invalid user type. Must be one of: ' . implode(', ', $validTypes));
        exit;
    }
    
    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Check if username already exists
        $checkStmt = $conn->prepare("SELECT id FROM Users WHERE username = ?");
        $checkStmt->bind_param("s", $username);
        $checkStmt->execute();
        
        if ($checkStmt->get_result()->num_rows > 0) {
            $checkStmt->close();
            $conn->close();
            apiResponse(false, null, 'Username already exists.');
            exit;
        }
        
        $checkStmt->close();
        
        // Check if email already exists
        $checkStmt = $conn->prepare("SELECT id FROM Users WHERE email = ?");
        $checkStmt->bind_param("s", $email);
        $checkStmt->execute();
        
        if ($checkStmt->get_result()->num_rows > 0) {
            $checkStmt->close();
            $conn->close();
            apiResponse(false, null, 'Email already exists.');
            exit;
        }
        
        $checkStmt->close();
        
        // Insert user
        $insertStmt = $conn->prepare("INSERT INTO Users (username, password, email, type) VALUES (?, ?, ?, ?)");
        $insertStmt->bind_param("ssss", $username, $password, $email, $userType);  // Note: still using 'type' in the database column
        
        if ($insertStmt->execute()) {
            $userId = $conn->insert_id;
            
            // Return the created user data
            $userData = [
                'id' => $userId,
                'username' => $username,
                'email' => $email,
                'type' => $userType  // Return as 'type' to match database column
            ];
            
            $insertStmt->close();
            $conn->close();
            
            apiResponse(true, $userData, 'User created successfully.');
        } else {
            $insertStmt->close();
            $conn->close();
            apiResponse(false, null, 'Failed to create user: ' . $insertStmt->error);
        }
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database error: ' . $e->getMessage());
    }
}