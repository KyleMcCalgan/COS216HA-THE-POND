<?php
/**
 * API Response Utilities
 * 
 * Your Name, Surname, Student Number
 */

// Only define the function if it doesn't already exist
if (!function_exists('apiResponse')) {
    /**
     * Send a standardized API response
     */
    function apiResponse($success, $data = null, $message = '') {
        $response = [
            'success' => $success,
            'message' => $message,
            'data' => $data,
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        echo json_encode($response);
        exit;
    }
}