<?php
/**
 * Test Handler
 * 
 * Your Name, Surname, Student Number
 */

/**
 * Handle database test
 */
function handleTest() {
    try {
        // Get database connection
        $conn = getDbConnection();
        
        if ($conn) {
            apiResponse(true, ['connection' => 'success'], 'Database connection successful.');
        } else {
            apiResponse(false, null, 'Database connection failed.');
        }
        
        // Close connection
        $conn->close();
        
    } catch (Exception $e) {
        apiResponse(false, null, 'Database test failed: ' . $e->getMessage());
    }
}