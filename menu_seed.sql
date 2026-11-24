-- Silong Café menu seed
-- Run after schema.sql. It is safe to rerun.
INSERT INTO menu_categories (id, name, note, sort_order) VALUES
('espresso','Espresso',NULL,1),
('classic','Classic Coffee',NULL,2),
('signature','Signature Coffee',NULL,3),
('noncoffee','Non-Coffee',NULL,4),
('matcha','Matcha Series',NULL,5),
('frappe','Frappe Series','Available in coffee or milk base',6),
('yogurt','Yogurt Series','Iced only',7),
('kislap','Kislap Refresher','Iced only',8)
ON DUPLICATE KEY UPDATE name=VALUES(name), note=VALUES(note), sort_order=VALUES(sort_order);

INSERT INTO menu_addons (name, price) VALUES
('Extra espresso shot',50),('Oat milk',40),('Whipped cream',30)
ON DUPLICATE KEY UPDATE price=VALUES(price);

INSERT INTO menu_items (category_id,name,description,tag,sort_order) VALUES
('espresso','Espresso',NULL,NULL,1),
('classic','Americano',NULL,NULL,1),('classic','Latte',NULL,NULL,2),('classic','Spanish Latte',NULL,'best',3),
('classic','French Vanilla',NULL,NULL,4),('classic','White Mocha',NULL,NULL,5),('classic','Caramel Macchiato',NULL,'best',6),('classic','Dark Mocha',NULL,NULL,7),
('signature','Silong Latte','Our unique recipe: smooth, creamy latte with a hint of caramel and a secret recipe.','best',1),
('signature','Ginhawa','A daily creation crafted by our barista. Roasted sesame.','barista',2),
('signature','Yakap (Biscoff Latte)','Creamy Biscoff cookie butter blended for a warm, comforting sip.','sig',3),
('signature','Pahinga (Peanut Brulee)','Creamy roasted peanut with a taste of brulee sweetness.','sig',4),
('signature','Payapa (Caramel Mocha)','Caramel sweetness blended with rich chocolate.','sig',5),
('noncoffee','Strawberry Au Lait',NULL,NULL,1),('noncoffee','Ube Au Lait',NULL,'best',2),('noncoffee','White Chocolate Au Lait',NULL,'new',3),('noncoffee','Chocolate Au Lait',NULL,NULL,4),
('matcha','Matcha',NULL,'best',1),('matcha','Ube Matcha',NULL,NULL,2),('matcha','Strawberry Matcha',NULL,'best',3),('matcha','Oreo Matcha',NULL,NULL,4),
('frappe','Chocolate Java Chip',NULL,'best',1),('frappe','Mocha',NULL,NULL,2),('frappe','Caramel',NULL,NULL,3),('frappe','Cookies and Cream',NULL,NULL,4),
('yogurt','Honey Peach Yogurt',NULL,NULL,1),('yogurt','Strawberry Yogurt',NULL,NULL,2),('yogurt','Lychee Yogurt',NULL,NULL,3),('yogurt','Green Apple Yogurt',NULL,NULL,4),
('kislap','Green Apple Soda',NULL,NULL,1),('kislap','Green Apple-Strawberry Soda',NULL,NULL,2),('kislap','Passion Fruit Soda',NULL,NULL,3),('kislap','Blueberry Soda',NULL,NULL,4),('kislap','Honey Peach Soda',NULL,NULL,5),('kislap','Lychee Soda',NULL,NULL,6)
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), tag=VALUES(tag), sort_order=VALUES(sort_order);

-- Common variants: insert Iced/Hot and franchise variants only once per item.
INSERT IGNORE INTO menu_variants (item_id,name,price)
SELECT id,'Single',79 FROM menu_items WHERE name='Espresso';
INSERT IGNORE INTO menu_variants (item_id,name,price)
SELECT id,'Iced',89 FROM menu_items WHERE name='Americano' UNION ALL
SELECT id,'Hot',99 FROM menu_items WHERE name='Americano';
