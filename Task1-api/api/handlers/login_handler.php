<?php
/**
 * Login Handler
 * 
 * Your Name, Surname, Student Number
 */

/**
 * Handle login request
 */
function handleLogin($data) {
    // Check if required fields are provided
    if (!isset($data['username']) || !isset($data['password'])) {
        apiResponse(false, null, 'Username and password are required.');
        exit;
    }

    // Extract and sanitize username and password
    $username = trim($data['username']);
    $password = $data['password'];

    // Validate input
    if (empty($username) || empty($password)) {
        apiResponse(false, null, 'Username and password cannot be empty.');
        exit;
    }

    try {
        // Get database connection
        $conn = getDbConnection();
        
        // Prepare statement to prevent SQL injection
        $stmt = $conn->prepare("SELECT id, username, email, password, type FROM Users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        
        // Get result
        $result = $stmt->get_result();
        
        // Check if user exists
        if ($result->num_rows === 0) {
            apiResponse(false, null, 'Invalid username or password.');
            exit;
        }
        
        // Get user data
        $user = $result->fetch_assoc();
        
        // Simple plain text password comparison
        if ($password === $user['password']) {
            // Password is correct, create user data for response
            $userData = [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'type' => $user['type']
            ];
            
            // Return success response with user data
            apiResponse(true, $userData, 'Login successful.');
        } else {
            // Password is incorrect
            apiResponse(false, null, 'Invalid username or password.');
        }
        
        // Close statement and connection
        $stmt->close();
        $conn->close();
        
    } catch (Exception $e) {
        // Log error
        error_log('Login error: ' . $e->getMessage());
        
        // Return error response
        apiResponse(false, null, 'Login failed: Database error.');
    }
}