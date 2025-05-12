-- Drop tables if they exist (optional - useful for clean setup)
DROP TABLE IF EXISTS Orders_Products;
DROP TABLE IF EXISTS Orders;
DROP TABLE IF EXISTS Products;
DROP TABLE IF EXISTS Drones;
DROP TABLE IF EXISTS Users;

-- Create Users table
CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL,
    type ENUM('Distributor', 'Customer', 'Courier') NOT NULL
);

-- Create Products table
CREATE TABLE Products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    brand VARCHAR(50) NOT NULL,
    image_url VARCHAR(255),
    categories VARCHAR(255),
    dimensions VARCHAR(100),
    is_available BOOLEAN DEFAULT TRUE,
    distributor INT,
    FOREIGN KEY (distributor) REFERENCES Users(id)
);

-- Create Orders table with composite primary key
CREATE TABLE Orders (
    customer_id INT NOT NULL,
    order_id INT NOT NULL,
    tracking_num VARCHAR(12) NOT NULL UNIQUE,
    destination_latitude DECIMAL(10, 7) NOT NULL,
    destination_longitude DECIMAL(10, 7) NOT NULL,
    state ENUM('Storage', 'Out_for_delivery', 'Delivered') DEFAULT 'Storage',
    delivery_date DATETIME,
    PRIMARY KEY (customer_id, order_id),
    FOREIGN KEY (customer_id) REFERENCES Users(id),
    CHECK (tracking_num LIKE 'CS-%')
);

-- Create join table for Orders and Products
CREATE TABLE Orders_Products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    FOREIGN KEY (product_id) REFERENCES Products(id),
    CHECK (quantity > 0 AND quantity <= 7) -- Maximum 7 products per order
);

-- Create Drones table
CREATE TABLE Drones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    current_operator_id INT,
    is_available BOOLEAN DEFAULT TRUE,
    latest_latitude DECIMAL(10, 7) DEFAULT 25.7472,
    latest_longitude DECIMAL(10, 7) DEFAULT 28.2511,
    altitude DECIMAL(6, 2) DEFAULT 0,
    battery_level INT DEFAULT 100,
    FOREIGN KEY (current_operator_id) REFERENCES Users(id),
    CHECK (battery_level >= 0 AND battery_level <= 100),
    CHECK (altitude >= 0)
);

-- Add indexes for performance
CREATE INDEX idx_products_is_available ON Products(is_available);
CREATE INDEX idx_orders_state ON Orders(state);
CREATE INDEX idx_drones_is_available ON Drones(is_available);
CREATE INDEX idx_orders_products_order_id ON Orders_Products(order_id);

-- Insert initial data: Create admin courier user
INSERT INTO Users (username, password, email, type) 
VALUES ('admin', 'admin', 'admin@courier.com', 'Courier');

-- Insert sample products (at least 20 required)
INSERT INTO Products (title, brand, image_url, categories, dimensions, is_available, distributor) VALUES
('Wireless Earbuds', 'SoundMax', 'earbuds.jpg', 'Electronics', '5x5x3cm', TRUE, 1),
('Smartphone Powerbank', 'PowerPlus', 'powerbank.jpg', 'Electronics', '10x6x2cm', TRUE, 1),
('Fitness Tracker', 'FitTech', 'tracker.jpg', 'Electronics,Fitness', '2x1x1cm', TRUE, 1),
('USB Flash Drive', 'DataStor', 'usb.jpg', 'Electronics', '6x2x1cm', TRUE, 1),
('Wireless Phone Charger', 'ChargeTech', 'charger.jpg', 'Electronics', '10x10x1cm', TRUE, 1),
('Smart Watch Band', 'TimeSync', 'band.jpg', 'Accessories', '20x2x0.5cm', TRUE, 1),
('Bluetooth Speaker Mini', 'AudioMax', 'speaker.jpg', 'Electronics', '8x8x8cm', TRUE, 1),
('Portable SSD Drive', 'SpeedStor', 'ssd.jpg', 'Electronics', '9x6x1cm', TRUE, 1),
('Wireless Mouse', 'ClickPro', 'mouse.jpg', 'Electronics', '12x6x4cm', TRUE, 1),
('USB-C Cable', 'ConnectPro', 'cable.jpg', 'Electronics', '100x0.5x0.5cm', TRUE, 1),
('Phone Camera Lens Kit', 'LensMax', 'lens.jpg', 'Photography', '5x5x3cm', TRUE, 1),
('Bluetooth Keychain Tracker', 'FindIt', 'tracker.jpg', 'Electronics', '4x4x1cm', TRUE, 1),
('Smart Light Bulb', 'BrightLife', 'bulb.jpg', 'Smart Home', '6x6x10cm', TRUE, 1),
('Mini Drone Camera', 'AirView', 'minidrone.jpg', 'Electronics,Photography', '15x15x5cm', TRUE, 1),
('Smart Plug', 'PowerControl', 'plug.jpg', 'Smart Home', '5x5x3cm', TRUE, 1),
('Wireless Keyboard', 'TypePro', 'keyboard.jpg', 'Electronics', '30x15x2cm', TRUE, 1),
('Portable Hard Drive', 'DataVault', 'hdd.jpg', 'Electronics', '12x8x2cm', TRUE, 1),
('Mini Bluetooth Speaker', 'SoundPod', 'minispeaker.jpg', 'Electronics', '6x6x6cm', TRUE, 1),
('Wireless Earphones', 'AudioSync', 'earphones.jpg', 'Electronics', '15x10x5cm', TRUE, 1),
('Smart Watch', 'TimeTrack', 'smartwatch.jpg', 'Electronics,Wearables', '4x4x1cm', TRUE, 1);

-- Insert a drone at HQ position
INSERT INTO Drones (current_operator_id, is_available, latest_latitude, latest_longitude, altitude, battery_level)
VALUES (NULL, TRUE, 25.7472, 28.2511, 0, 100);