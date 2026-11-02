-- =====================================================================
-- DAIRY COLLECTION AND FARMER PAYMENT MANAGEMENT SYSTEM
-- Comprehensive Seed Data
-- Database: dairy_db
-- =====================================================================

USE dairy_db;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE audit_logs;
TRUNCATE TABLE farmer_payment_deduction_items;
TRUNCATE TABLE farmer_payments;
TRUNCATE TABLE payment_periods;
TRUNCATE TABLE farmer_deductions_master;
TRUNCATE TABLE milk_collections;
TRUNCATE TABLE rate_slabs;
TRUNCATE TABLE rate_chart_master;
TRUNCATE TABLE milk_types;
TRUNCATE TABLE farmers;
TRUNCATE TABLE users;
TRUNCATE TABLE collection_centres;
TRUNCATE TABLE villages;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 1. SEED VILLAGES
-- =====================================================================
INSERT INTO villages (village_id, village_name, taluka, district, pincode) VALUES
(1, 'Sangamner Khurd', 'Sangamner', 'Ahmednagar', '422605'),
(2, 'Chandanapuri', 'Sangamner', 'Ahmednagar', '422605'),
(3, 'Ghulewadi', 'Sangamner', 'Ahmednagar', '422608'),
(4, 'Loni Budruk', 'Rahata', 'Ahmednagar', '413736'),
(5, 'Sakur', 'Sangamner', 'Ahmednagar', '422622');

-- =====================================================================
-- 2. SEED COLLECTION CENTRES
-- =====================================================================
INSERT INTO collection_centres (centre_id, centre_code, centre_name, village_id, capacity_litres_per_day, operating_status, contact_phone) VALUES
(1, 'CC-SN-01', 'Sangamner Central BMC Unit', 1, 10000.00, 'ACTIVE', '+91 98220 11001'),
(2, 'CC-CH-02', 'Chandanapuri Primary Collection Centre', 2, 4500.00, 'ACTIVE', '+91 98220 11002'),
(3, 'CC-GH-03', 'Ghulewadi Automated Dairy Point', 3, 6000.00, 'ACTIVE', '+91 98220 11003'),
(4, 'CC-LN-04', 'Loni Bulk Milk Cooling Centre', 4, 8500.00, 'ACTIVE', '+91 98220 11004');

-- =====================================================================
-- 3. SEED SYSTEM USERS (RBAC Roles)
-- Password for all demo accounts: 'Password@123'
-- =====================================================================
INSERT INTO users (user_id, username, password_hash, full_name, email, phone, role, assigned_centre_id, is_active) VALUES
(1, 'admin', '$2b$10$wT0X8c8Q7.d3o7d8K1gJXeU5k.eWfH3xZqK3l1p0yJ4q9A2Z9wPuy', 'System Administrator', 'admin@sahyadridairy.org', '+91 98900 00001', 'ADMIN', NULL, TRUE),
(2, 'manager_patil', '$2b$10$wT0X8c8Q7.d3o7d8K1gJXeU5k.eWfH3xZqK3l1p0yJ4q9A2Z9wPuy', 'Ramesh Patil', 'r.patil@sahyadridairy.org', '+91 98900 00002', 'DAIRY_MANAGER', NULL, TRUE),
(3, 'operator_sangamner', '$2b$10$wT0X8c8Q7.d3o7d8K1gJXeU5k.eWfH3xZqK3l1p0yJ4q9A2Z9wPuy', 'Suresh Deshmukh', 's.deshmukh@sahyadridairy.org', '+91 98900 00003', 'CENTRE_OPERATOR', 1, TRUE),
(4, 'operator_chandanapuri', '$2b$10$wT0X8c8Q7.d3o7d8K1gJXeU5k.eWfH3xZqK3l1p0yJ4q9A2Z9wPuy', 'Kishor Shinde', 'k.shinde@sahyadridairy.org', '+91 98900 00004', 'CENTRE_OPERATOR', 2, TRUE),
(5, 'tester_kale', '$2b$10$wT0X8c8Q7.d3o7d8K1gJXeU5k.eWfH3xZqK3l1p0yJ4q9A2Z9wPuy', 'Dr. Anand Kale', 'a.kale@sahyadridairy.org', '+91 98900 00005', 'QUALITY_TESTER', 1, TRUE),
(6, 'accounts_thorat', '$2b$10$wT0X8c8Q7.d3o7d8K1gJXeU5k.eWfH3xZqK3l1p0yJ4q9A2Z9wPuy', 'Sunita Thorat', 's.thorat@sahyadridairy.org', '+91 98900 00006', 'ACCOUNTS_STAFF', NULL, TRUE),
(7, 'farmer_ramesh', '$2b$10$wT0X8c8Q7.d3o7d8K1gJXeU5k.eWfH3xZqK3l1p0yJ4q9A2Z9wPuy', 'Ramesh Vitthal Gaikwad', 'ramesh.g@farmer.org', '+91 94231 55001', 'FARMER', 1, TRUE),
(8, 'farmer_babasaheb', '$2b$10$wT0X8c8Q7.d3o7d8K1gJXeU5k.eWfH3xZqK3l1p0yJ4q9A2Z9wPuy', 'Babasaheb Eknath Dighe', 'babasaheb.d@farmer.org', '+91 94231 55002', 'FARMER', 1, TRUE);

-- =====================================================================
-- 4. SEED MILK TYPES
-- =====================================================================
INSERT INTO milk_types (milk_type_id, type_name, min_fat, max_fat, min_snf, max_snf, standard_water_limit_percent, description) VALUES
(1, 'COW', 2.50, 6.00, 7.50, 10.00, 0.00, 'Crossbred HF / Jersey and Desi Cow Milk'),
(2, 'BUFFALO', 5.00, 12.00, 8.50, 11.50, 0.00, 'Murrah and Mehsana Dairy Buffalo Milk');

-- =====================================================================
-- 5. SEED RATE CHARTS (Historical & Prevailing)
-- =====================================================================
-- Historical Cow Milk Rate Chart (2025)
INSERT INTO rate_chart_master (chart_id, chart_code, chart_name, milk_type_id, effective_from, effective_to, base_fat_percent, base_snf_percent, base_rate_per_litre, fat_increment_per_point, snf_increment_per_point, is_active, approved_by) VALUES
(1, 'RC-COW-2025-V1', 'Cow Milk Annual Chart 2025', 1, '2025-01-01', '2025-12-31', 3.50, 8.50, 34.00, 0.25, 0.15, FALSE, 2),
-- Active Cow Milk Rate Chart (2026 onwards)
(2, 'RC-COW-2026-V1', 'Cow Milk Prevailing Chart 2026', 1, '2026-01-01', NULL, 3.50, 8.50, 37.50, 0.30, 0.20, TRUE, 2),
-- Active Buffalo Milk Rate Chart (2026 onwards)
(3, 'RC-BUF-2026-V1', 'Buffalo Milk Prevailing Chart 2026', 2, '2026-01-01', NULL, 6.50, 9.00, 56.00, 0.45, 0.25, TRUE, 2);

-- Slabs for Active Cow Rate Chart
INSERT INTO rate_slabs (chart_id, min_fat, max_fat, min_snf, max_snf, rate_per_litre, incentive_per_litre, penalty_per_litre) VALUES
(2, 3.20, 3.49, 8.20, 8.49, 35.50, 0.00, 0.50),
(2, 3.50, 3.80, 8.50, 8.70, 37.50, 0.00, 0.00),
(2, 3.81, 4.20, 8.71, 9.00, 39.80, 1.00, 0.00),
(2, 4.21, 5.00, 9.01, 10.00, 42.50, 2.00, 0.00);

-- Slabs for Active Buffalo Rate Chart
INSERT INTO rate_slabs (chart_id, min_fat, max_fat, min_snf, max_snf, rate_per_litre, incentive_per_litre, penalty_per_litre) VALUES
(3, 5.50, 5.99, 8.50, 8.79, 52.00, 0.00, 1.00),
(3, 6.00, 6.50, 8.80, 9.00, 56.00, 0.00, 0.00),
(3, 6.51, 7.50, 9.01, 9.50, 61.50, 1.50, 0.00),
(3, 7.51, 9.50, 9.51, 10.50, 68.00, 2.50, 0.00);

-- =====================================================================
-- 6. SEED FARMERS (20 Registered Dairy Farmers)
-- =====================================================================
INSERT INTO farmers (farmer_id, farmer_code, first_name, last_name, village_id, assigned_centre_id, phone, aadhar_number, bank_name, bank_account_number, ifsc_code, registration_date, status, user_id) VALUES
(1, 'FRM-1001', 'Ramesh', 'Gaikwad', 1, 1, '+91 94231 55001', '3456-7890-1234', 'State Bank of India', '30981245671', 'SBIN0000473', '2024-03-15', 'ACTIVE', 7),
(2, 'FRM-1002', 'Babasaheb', 'Dighe', 1, 1, '+91 94231 55002', '3456-7890-1235', 'Bank of Maharashtra', '60124578912', 'MAHB0000128', '2024-04-10', 'ACTIVE', 8),
(3, 'FRM-1003', 'Eknath', 'Kute', 1, 1, '+91 94231 55003', '3456-7890-1236', 'State Bank of India', '30981245673', 'SBIN0000473', '2024-05-12', 'ACTIVE', NULL),
(4, 'FRM-1004', 'Dnyaneshwar', 'Navale', 2, 2, '+91 94231 55004', '3456-7890-1237', 'Union Bank of India', '40561238901', 'UBIN0540561', '2024-05-20', 'ACTIVE', NULL),
(5, 'FRM-1005', 'Tukaram', 'Gunjal', 2, 2, '+91 94231 55005', '3456-7890-1238', 'Bank of Maharashtra', '60124578915', 'MAHB0000128', '2024-06-01', 'ACTIVE', NULL),
(6, 'FRM-1006', 'Sanjay', 'Tambe', 2, 2, '+91 94231 55006', '3456-7890-1239', 'State Bank of India', '30981245676', 'SBIN0000473', '2024-06-15', 'ACTIVE', NULL),
(7, 'FRM-1007', 'Pandurang', 'Aher', 3, 3, '+91 94231 55007', '3456-7890-1240', 'HDFC Bank', '50100245890123', 'HDFC0000240', '2024-07-01', 'ACTIVE', NULL),
(8, 'FRM-1008', 'Vishnu', 'Rahane', 3, 3, '+91 94231 55008', '3456-7890-1241', 'Bank of Baroda', '1245010003456', 'BARB0SANGAM', '2024-07-15', 'ACTIVE', NULL),
(9, 'FRM-1009', 'Nivritti', 'Bhandari', 3, 3, '+91 94231 55009', '3456-7890-1242', 'State Bank of India', '30981245679', 'SBIN0000473', '2024-08-01', 'ACTIVE', NULL),
(10, 'FRM-1010', 'Sharad', 'Thorat', 4, 4, '+91 94231 55010', '3456-7890-1243', 'State Bank of India', '30981245680', 'SBIN0001234', '2024-08-10', 'ACTIVE', NULL),
(11, 'FRM-1011', 'Sunil', 'Jadhav', 4, 4, '+91 94231 55011', '3456-7890-1244', 'Bank of Maharashtra', '60124578921', 'MAHB0000456', '2024-08-20', 'ACTIVE', NULL),
(12, 'FRM-1012', 'Ashok', 'Kadam', 4, 4, '+91 94231 55012', '3456-7890-1245', 'Union Bank of India', '40561238912', 'UBIN0540561', '2024-09-01', 'ACTIVE', NULL),
(13, 'FRM-1013', 'Bhausaheb', 'Wakchaure', 1, 1, '+91 94231 55013', '3456-7890-1246', 'State Bank of India', '30981245683', 'SBIN0000473', '2024-09-15', 'ACTIVE', NULL),
(14, 'FRM-1014', 'Kalyan', 'Shinde', 2, 2, '+91 94231 55014', '3456-7890-1247', 'Bank of Baroda', '1245010003460', 'BARB0SANGAM', '2024-10-01', 'ACTIVE', NULL),
(15, 'FRM-1015', 'Kailas', 'Pawar', 5, 1, '+91 94231 55015', '3456-7890-1248', 'State Bank of India', '30981245685', 'SBIN0000473', '2024-10-15', 'ACTIVE', NULL),
(16, 'FRM-1016', 'Gorakh', 'Hole', 3, 3, '+91 94231 55016', '3456-7890-1249', 'HDFC Bank', '50100245890199', 'HDFC0000240', '2024-11-01', 'ACTIVE', NULL),
(17, 'FRM-1017', 'Machhindra', 'Bhor', 4, 4, '+91 94231 55017', '3456-7890-1250', 'State Bank of India', '30981245687', 'SBIN0001234', '2024-11-15', 'ACTIVE', NULL),
(18, 'FRM-1018', 'Vijay', 'Sonawane', 1, 1, '+91 94231 55018', '3456-7890-1251', 'Bank of Maharashtra', '60124578928', 'MAHB0000128', '2024-12-01', 'ACTIVE', NULL),
(19, 'FRM-1019', 'Namdeo', 'Malunjkar', 2, 2, '+91 94231 55019', '3456-7890-1252', 'Union Bank of India', '40561238919', 'UBIN0540561', '2024-12-15', 'INACTIVE', NULL),
(20, 'FRM-1020', 'Pravin', 'Mandlik', 3, 3, '+91 94231 55020', '3456-7890-1253', 'State Bank of India', '30981245690', 'SBIN0000473', '2025-01-10', 'ACTIVE', NULL);

-- =====================================================================
-- 7. SEED FARMER DEDUCTIONS MASTER (Feed, Advances, Vet Medicine)
-- =====================================================================
INSERT INTO farmer_deductions_master (deduction_id, farmer_id, deduction_type, total_amount, recovered_amount, balance_amount, max_deduction_per_period, status, description, approved_by) VALUES
(1, 1, 'CATTLE_FEED', 3500.00, 1000.00, 2500.00, 1000.00, 'ACTIVE', '2 Bags Amul Cattle Feed Pellet (50kg each)', 6),
(2, 1, 'ADVANCE_REPAYMENT', 5000.00, 2000.00, 3000.00, 1500.00, 'ACTIVE', 'Emergency festival cash advance', 2),
(3, 2, 'VETERINARY_MEDICINE', 1200.00, 0.00, 1200.00, 600.00, 'ACTIVE', 'Vaccination and mineral mixture kit', 6),
(4, 4, 'CATTLE_FEED', 4200.00, 1400.00, 2800.00, 1400.00, 'ACTIVE', '3 Bags Sugras Special Dairy feed', 6),
(5, 7, 'EQUIPMENT_LOAN', 8000.00, 4000.00, 4000.00, 2000.00, 'ACTIVE', 'Milking machine subsidy instalment', 2),
(6, 10, 'CATTLE_FEED', 2800.00, 2800.00, 0.00, 1400.00, 'FULLY_RECOVERED', 'De-oiled cake feed bags', 6);

-- =====================================================================
-- 8. SEED PAYMENT PERIODS / 10-DAY MUSTERS
-- =====================================================================
INSERT INTO payment_periods (period_id, period_code, start_date, end_date, cycle_type, status) VALUES
(1, 'MUSTER-2026-OCT-M1', '2026-10-01', '2026-10-10', 'FORTNIGHTLY', 'CLOSED'),
(2, 'MUSTER-2026-OCT-M2', '2026-10-11', '2026-10-20', 'FORTNIGHTLY', 'CLOSED'),
(3, 'MUSTER-2026-OCT-M3', '2026-10-21', '2026-10-31', 'FORTNIGHTLY', 'OPEN');

-- =====================================================================
-- 9. SEED MILK COLLECTIONS (Oct 16 to Oct 29, 2026 - Morning and Evening)
-- =====================================================================
-- Farmer 1 (Ramesh Gaikwad - Cow Milk at Centre 1)
INSERT INTO milk_collections (farmer_id, centre_id, collection_date, session, collection_timestamp, milk_type_id, quantity_litres, fat_percentage, snf_percentage, clr_reading, temperature_celsius, quality_status, rate_chart_id, rate_per_litre, gross_amount, incentive_amount, deduction_amount, net_payable_amount, payment_status, collected_by_user_id) VALUES
(1, 1, '2026-10-16', 'MORNING', '2026-10-16 06:15:00', 1, 14.50, 3.80, 8.60, 28.5, 27.0, 'ACCEPTED', 2, 38.60, 559.70, 0.00, 0.00, 559.70, 'PENDING', 3),
(1, 1, '2026-10-16', 'EVENING', '2026-10-16 18:20:00', 1, 13.00, 3.90, 8.70, 29.0, 28.5, 'ACCEPTED', 2, 39.10, 508.30, 0.00, 0.00, 508.30, 'PENDING', 3),
(1, 1, '2026-10-17', 'MORNING', '2026-10-17 06:10:00', 1, 15.00, 4.00, 8.80, 29.2, 26.5, 'ACCEPTED', 2, 39.80, 597.00, 15.00, 0.00, 612.00, 'PENDING', 3),
(1, 1, '2026-10-17', 'EVENING', '2026-10-17 18:15:00', 1, 13.50, 3.80, 8.60, 28.5, 28.0, 'ACCEPTED', 2, 38.60, 521.10, 0.00, 0.00, 521.10, 'PENDING', 3),
(1, 1, '2026-10-18', 'MORNING', '2026-10-18 06:25:00', 1, 14.00, 4.10, 8.80, 29.0, 27.0, 'ACCEPTED', 2, 39.80, 557.20, 14.00, 0.00, 571.20, 'PENDING', 3),
(1, 1, '2026-10-18', 'EVENING', '2026-10-18 18:30:00', 1, 13.00, 3.70, 8.50, 28.0, 28.0, 'ACCEPTED', 2, 38.10, 495.30, 0.00, 0.00, 495.30, 'PENDING', 3),

-- Farmer 2 (Babasaheb Dighe - Buffalo Milk at Centre 1)
(2, 1, '2026-10-16', 'MORNING', '2026-10-16 06:40:00', 2, 18.00, 6.80, 9.10, 31.0, 26.0, 'ACCEPTED', 3, 61.50, 1107.00, 27.00, 0.00, 1134.00, 'PENDING', 3),
(2, 1, '2026-10-16', 'EVENING', '2026-10-16 18:45:00', 2, 17.50, 6.90, 9.20, 31.5, 27.5, 'ACCEPTED', 3, 61.50, 1076.25, 26.25, 0.00, 1102.50, 'PENDING', 3),
(2, 1, '2026-10-17', 'MORNING', '2026-10-17 06:35:00', 2, 19.00, 7.10, 9.30, 32.0, 25.5, 'ACCEPTED', 3, 61.50, 1168.50, 28.50, 0.00, 1197.00, 'PENDING', 3),
(2, 1, '2026-10-17', 'EVENING', '2026-10-17 18:40:00', 2, 17.00, 6.70, 9.10, 31.0, 27.0, 'ACCEPTED', 3, 61.50, 1045.50, 25.50, 0.00, 1071.00, 'PENDING', 3),

-- Farmer 4 (Dnyaneshwar Navale - Cow Milk at Centre 2)
(4, 2, '2026-10-16', 'MORNING', '2026-10-16 06:30:00', 1, 22.00, 3.60, 8.50, 28.2, 26.5, 'ACCEPTED', 2, 37.80, 831.60, 0.00, 0.00, 831.60, 'PENDING', 4),
(4, 2, '2026-10-16', 'EVENING', '2026-10-16 18:10:00', 1, 21.50, 3.70, 8.60, 28.4, 28.0, 'ACCEPTED', 2, 38.30, 823.45, 0.00, 0.00, 823.45, 'PENDING', 4),
(4, 2, '2026-10-17', 'MORNING', '2026-10-17 06:20:00', 1, 23.00, 3.80, 8.70, 28.8, 26.0, 'ACCEPTED', 2, 38.90, 894.70, 0.00, 0.00, 894.70, 'PENDING', 4),

-- Farmer 7 (Pandurang Aher - Buffalo Milk at Centre 3)
(7, 3, '2026-10-16', 'MORNING', '2026-10-16 06:50:00', 2, 25.00, 7.50, 9.40, 32.5, 27.0, 'ACCEPTED', 3, 68.00, 1700.00, 62.50, 0.00, 1762.50, 'PENDING', 1),
(7, 3, '2026-10-16', 'EVENING', '2026-10-16 18:55:00', 2, 24.00, 7.40, 9.30, 32.0, 28.0, 'ACCEPTED', 3, 61.50, 1476.00, 36.00, 0.00, 1512.00, 'PENDING', 1),

-- Inter-Centre Supply Demo: Farmer 1 normally at Centre 1 supplied once at Centre 2 on 2026-10-19
(1, 2, '2026-10-19', 'MORNING', '2026-10-19 06:45:00', 1, 14.00, 3.90, 8.70, 29.0, 27.0, 'ACCEPTED', 2, 39.10, 547.40, 0.00, 0.00, 547.40, 'PENDING', 4);
UPDATE milk_collections SET is_inter_centre_collection = TRUE WHERE collection_id = LAST_INSERT_ID();

-- Additional collections across more dates and farmers for analytics
INSERT INTO milk_collections (farmer_id, centre_id, collection_date, session, collection_timestamp, milk_type_id, quantity_litres, fat_percentage, snf_percentage, clr_reading, temperature_celsius, quality_status, rate_chart_id, rate_per_litre, gross_amount, incentive_amount, deduction_amount, net_payable_amount, payment_status, collected_by_user_id) VALUES
(3, 1, '2026-10-20', 'MORNING', '2026-10-20 06:15:00', 1, 11.50, 3.50, 8.50, 28.0, 26.5, 'ACCEPTED', 2, 37.50, 431.25, 0.00, 0.00, 431.25, 'PENDING', 3),
(3, 1, '2026-10-20', 'EVENING', '2026-10-20 18:15:00', 1, 10.00, 3.60, 8.50, 28.1, 27.5, 'ACCEPTED', 2, 37.80, 378.00, 0.00, 0.00, 378.00, 'PENDING', 3),
(5, 2, '2026-10-20', 'MORNING', '2026-10-20 06:25:00', 1, 16.00, 4.20, 8.80, 29.1, 26.0, 'ACCEPTED', 2, 42.50, 680.00, 32.00, 0.00, 712.00, 'PENDING', 4),
(6, 2, '2026-10-20', 'MORNING', '2026-10-20 06:35:00', 2, 14.00, 6.20, 8.90, 30.5, 27.0, 'ACCEPTED', 3, 56.00, 784.00, 0.00, 0.00, 784.00, 'PENDING', 4),
(8, 3, '2026-10-20', 'MORNING', '2026-10-20 06:45:00', 1, 18.50, 3.70, 8.60, 28.5, 27.0, 'ACCEPTED', 2, 38.30, 708.55, 0.00, 0.00, 708.55, 'PENDING', 1),
(10, 4, '2026-10-20', 'MORNING', '2026-10-20 06:55:00', 1, 28.00, 4.00, 8.80, 29.2, 26.0, 'ACCEPTED', 2, 39.80, 1114.40, 28.00, 0.00, 1142.40, 'PENDING', 1),
(11, 4, '2026-10-20', 'MORNING', '2026-10-20 07:05:00', 2, 20.00, 7.20, 9.30, 32.0, 26.5, 'ACCEPTED', 3, 61.50, 1230.00, 30.00, 0.00, 1260.00, 'PENDING', 1);

-- =====================================================================
-- 10. SEED AUDIT LOGS (Demonstrating Historical Traceability)
-- =====================================================================
INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id, client_ip, timestamp) VALUES
('milk_collections', 1, 'UPDATE', 'fat_percentage', '3.60', '3.80', 'Lactometer recalibration after operator entered incorrect manual reading', 2, '192.168.1.105', '2026-10-16 07:15:00'),
('milk_collections', 1, 'UPDATE', 'net_payable_amount', '530.70', '559.70', 'Rate adjustment following fat percentage correction', 2, '192.168.1.105', '2026-10-16 07:15:00'),
('rate_chart_master', 2, 'UPDATE', 'base_rate_per_litre', '36.50', '37.50', 'Board of Directors state-level cooperative procurement rate hike approved', 1, '192.168.1.10', '2026-01-01 10:00:00'),
('farmer_deductions_master', 1, 'INSERT', 'total_amount', NULL, '3500.00', 'Dispatched 2 bags cattle feed on credit voucher #CF-9821', 6, '192.168.1.50', '2026-10-05 14:30:00');

SELECT 'Comprehensive Seed Data Successfully Inserted!' AS status;
