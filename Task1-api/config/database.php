<?php
/**
 * Database Configuration
 * 
 * Your Name, Surname, Student Number
 */

// Database credentials
$host = 'wheatley.cs.up.ac.za';
$dbname = 'u24648826_u04579624_Couriers'; // Replace with your student number
$username = 'u24648826'; // Replace with your student number
$password = 'V3XFTDELNDKKFFU27VMF7H65QAGVDMHX'; // Replace with your actual password

// Create database connection
function getDbConnection() {
    global $host, $dbname, $username, $password;
    
    try {
        $conn = new mysqli($host, $username, $password, $dbname);
        
        // Check connection
        if ($conn->connect_error) {
            die("Connection failed: " . $conn->connect_error);
        }
        
        return $conn;
    } catch (Exception $e) {
        die("Connection failed: " . $e->getMessage());
    }
}