-- Optional Silong Café menu seed for cloud MySQL setup.
-- Run after schema.sql. The live application currently reads menu.js.
CREATE DATABASE IF NOT EXISTS silong_cafe CHARACTER SET utf8mb4;
USE silong_cafe;

CREATE TABLE IF NOT EXISTS menu_categories (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  note VARCHAR(200) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS menu_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id VARCHAR(30) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  tag VARCHAR(30) NULL,
  UNIQUE KEY uq_category_item (category_id, name),
  CONSTRAINT fk_menu_category FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS menu_variants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  name VARCHAR(30) NOT NULL,
  price INT NOT NULL,
  UNIQUE KEY uq_item_variant (item_id, name),
  CONSTRAINT fk_menu_variant_item FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS menu_addons (
  name VARCHAR(80) PRIMARY KEY,
  price INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO menu_categories (id,name,note) VALUES
('espresso','Espresso',NULL),
('classic','Classic Coffee',NULL),
('signature','Signature Coffee',NULL),
('noncoffee','Non-Coffee',NULL),
('matcha','Matcha Series',NULL),
('frappe','Frappe Series','Available in coffee or milk base'),
('yogurt','Yogurt Series','Iced only'),
('kislap','Kislap Refresher','Iced only');

INSERT IGNORE INTO menu_addons (name,price) VALUES
('Extra espresso shot',50),('Oat milk',40),('Whipped cream',30);
