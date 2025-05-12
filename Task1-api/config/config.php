<?php
/**
 * API Configuration
 * 
 * Your Name, Surname, Student Number
 */

// API settings
$baseUrl = 'https://wheatley.cs.up.ac.za/u12345678/Task1-api'; // Replace with your student number

// HQ coordinates (Hatfield)
$hqLatitude = 25.7472;
$hqLongitude = 28.2511;

// Maximum drone range (5km)
$maxRange = 5000;

// Add CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("HTTP/1.1 200 OK");
    exit;
}

// Set content type to JSON for API responses
header("Content-Type: application/json");

/**
 * Simple distance calculator between two coordinates (in meters)
 */
function calculateDistance($lat1, $lon1, $lat2, $lon2) {
    // Convert degrees to radians
    $lat1 = deg2rad($lat1);
    $lon1 = deg2rad($lon1);
    $lat2 = deg2rad($lat2);
    $lon2 = deg2rad($lon2);
    
    // Earth radius in meters
    $earthRadius = 6371000;
    
    // Haversine formula
    $latDelta = $lat2 - $lat1;
    $lonDelta = $lon2 - $lon1;
    
    $a = sin($latDelta/2) * sin($latDelta/2) +
         cos($lat1) * cos($lat2) * 
         sin($lonDelta/2) * sin($lonDelta/2);
    $c = 2 * atan2(sqrt($a), sqrt(1-$a));
    
    return $earthRadius * $c;
}

/**
 * Format API response
 */
function apiResponse($success, $data = null, $message = '') {
    $response = [
        'success' => $success,
        'message' => $message,
        'data' => $data
    ];
    
    echo json_encode($response);
    exit;
}

function isWithinRange($latitude, $longitude) {
    global $hqLatitude, $hqLongitude, $maxRange;
    
    $distance = calculateDistance($hqLatitude, $hqLongitude, $latitude, $longitude);
    return $distance <= 5000;
}