-- Silong Café tables. The server runs this automatically on start (and creates the database).
-- To import by hand: CREATE DATABASE silong_cafe; USE silong_cafe; then run this file.
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(10) NOT NULL,
    order_date DATE NOT NULL,
    customer VARCHAR(60) NOT NULL,
    phone VARCHAR(20) NULL,
    type ENUM(
        'Dine-in',
        'Takeout',
        'Pickup'
    ) NOT NULL,
    table_no VARCHAR(10) NULL,
    notes VARCHAR(200) NULL,
    payment_method ENUM(
        'Cash',
        'E-Wallet',
        'Bank Transfer'
    ) NOT NULL DEFAULT 'Cash',
    payment_provider VARCHAR(30) NULL,
    receipt_url VARCHAR(1024) NULL,
    reference_number VARCHAR(100) NULL,
    status ENUM(
        'new',
        'preparing',
        'ready',
        'done',
        'cancelled'
    ) NOT NULL DEFAULT 'new',
    total INT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_day_no (order_date, order_no),
    UNIQUE KEY uq_reference_number (reference_number),
    KEY idx_status (status),
    KEY idx_order_date_status (order_date, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    name VARCHAR(80) NOT NULL,
    variant VARCHAR(30) NULL,
    addons VARCHAR(200) NULL,
    qty INT NOT NULL,
    unit_price INT NOT NULL,
    CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS daily_counters (
    order_date DATE PRIMARY KEY,
    n INT NOT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS menu_categories (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    note VARCHAR(200) NULL,
    sort_order INT NOT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id VARCHAR(40) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(300) NULL,
    tag VARCHAR(20) NULL,
    sort_order INT NOT NULL,
    UNIQUE KEY uq_menu_category_name (category_id, name),
    CONSTRAINT fk_menu_category FOREIGN KEY (category_id) REFERENCES menu_categories (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS menu_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    name VARCHAR(30) NOT NULL,
    price INT NOT NULL,
    UNIQUE KEY uq_variant (item_id, name),
    CONSTRAINT fk_variant_item FOREIGN KEY (item_id) REFERENCES menu_items (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS menu_addons (
    name VARCHAR(80) PRIMARY KEY,
    price INT NOT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;