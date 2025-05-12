# Database Structure

This project uses a remote MySQL database with the following structure:

## Tables

### Users
- id (INT, PK)
- username (VARCHAR)
- password (VARCHAR)
- email (VARCHAR)
- type (VARCHAR) - 'Distributor', 'Customer', or 'Courier'

### Products
- id (INT, PK)
- title (VARCHAR)
- brand (VARCHAR)
- image_url (VARCHAR)
- categories (VARCHAR)
- dimensions (VARCHAR)
- is_available (BOOLEAN)
- distributor (INT, FK to Users.id)

### Orders
- customer_id (INT, PK, FK to Users.id)
- order_id (INT, PK)
- tracking_num (VARCHAR) - Unique 10-character string starting with "CS-"
- destination_latitude (DECIMAL)
- destination_longitude (DECIMAL)
- state (VARCHAR) - 'Storage', 'Out_for_delivery', or 'Delivered'
- delivery_date (DATETIME)

### Orders_Products
- id (INT, PK)
- order_id (INT, FK to Orders.order_id)
- product_id (INT, FK to Products.id)
- quantity (INT)

### Drones
- id (INT, PK)
- current_operator_id (INT, FK to Users.id, nullable)
- is_available (BOOLEAN)
- latest_latitude (DECIMAL)
- latest_longitude (DECIMAL)
- altitude (DECIMAL)
- battery_level (INT)

## Connection Details
- Server: wheatley
- Database name: [redacted]
- Connection handled through task1-php-api/config/database.php