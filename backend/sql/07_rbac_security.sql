-- =====================================================================
-- DAIRY COLLECTION AND FARMER PAYMENT MANAGEMENT SYSTEM
-- Role-Based Access Control (RBAC) & Database Security Architecture
-- Database: dairy_db
-- =====================================================================

USE dairy_db;

-- =====================================================================
-- 1. CREATE ROLES
-- =====================================================================
DROP ROLE IF EXISTS 'role_admin', 'role_dairy_manager', 'role_centre_operator',
                     'role_quality_tester', 'role_accounts_staff', 'role_farmer';

CREATE ROLE 'role_admin';
CREATE ROLE 'role_dairy_manager';
CREATE ROLE 'role_centre_operator';
CREATE ROLE 'role_quality_tester';
CREATE ROLE 'role_accounts_staff';
CREATE ROLE 'role_farmer';

-- =====================================================================
-- 2. ASSIGN OBJECT PRIVILEGES TO ROLES
-- =====================================================================

-- 2.1 ADMIN: Unrestricted access to entire database
GRANT ALL PRIVILEGES ON dairy_db.* TO 'role_admin' WITH GRANT OPTION;

-- 2.2 DAIRY MANAGER: Strategic oversight, rate approval, reports, audit log reading
GRANT SELECT, INSERT, UPDATE ON dairy_db.villages TO 'role_dairy_manager';
GRANT SELECT, INSERT, UPDATE ON dairy_db.collection_centres TO 'role_dairy_manager';
GRANT SELECT, INSERT, UPDATE ON dairy_db.farmers TO 'role_dairy_manager';
GRANT SELECT, INSERT, UPDATE ON dairy_db.rate_chart_master TO 'role_dairy_manager';
GRANT SELECT, INSERT, UPDATE ON dairy_db.rate_slabs TO 'role_dairy_manager';
GRANT SELECT, INSERT, UPDATE ON dairy_db.milk_collections TO 'role_dairy_manager';
GRANT SELECT, INSERT, UPDATE ON dairy_db.farmer_deductions_master TO 'role_dairy_manager';
GRANT SELECT, INSERT, UPDATE ON dairy_db.payment_periods TO 'role_dairy_manager';
GRANT SELECT, INSERT, UPDATE ON dairy_db.farmer_payments TO 'role_dairy_manager';
GRANT SELECT ON dairy_db.audit_logs TO 'role_dairy_manager';
GRANT SELECT ON dairy_db.v_daily_collection_summary TO 'role_dairy_manager';
GRANT SELECT ON dairy_db.v_farmer_performance TO 'role_dairy_manager';
GRANT SELECT ON dairy_db.v_centre_performance TO 'role_dairy_manager';
GRANT EXECUTE ON PROCEDURE dairy_db.sp_correct_milk_collection TO 'role_dairy_manager';
GRANT EXECUTE ON PROCEDURE dairy_db.sp_generate_farmer_payments TO 'role_dairy_manager';

-- 2.3 CENTRE OPERATOR: Daily milk intake recording; NO DIRECT DELETE OR UPDATE on transactions!
GRANT SELECT ON dairy_db.villages TO 'role_centre_operator';
GRANT SELECT ON dairy_db.collection_centres TO 'role_centre_operator';
GRANT SELECT, INSERT ON dairy_db.farmers TO 'role_centre_operator';
GRANT SELECT ON dairy_db.milk_types TO 'role_centre_operator';
GRANT SELECT ON dairy_db.rate_chart_master TO 'role_centre_operator';
GRANT SELECT ON dairy_db.rate_slabs TO 'role_centre_operator';
GRANT SELECT, INSERT ON dairy_db.milk_collections TO 'role_centre_operator';
GRANT SELECT ON dairy_db.v_daily_collection_summary TO 'role_centre_operator';
GRANT EXECUTE ON PROCEDURE dairy_db.sp_calculate_rate TO 'role_centre_operator';
GRANT EXECUTE ON PROCEDURE dairy_db.sp_record_milk_collection TO 'role_centre_operator';

-- 2.4 QUALITY TESTER: Inspect samples, record lactometer readings, verify Fat & SNF
GRANT SELECT ON dairy_db.milk_types TO 'role_quality_tester';
GRANT SELECT ON dairy_db.rate_chart_master TO 'role_quality_tester';
GRANT SELECT ON dairy_db.rate_slabs TO 'role_quality_tester';
GRANT SELECT, UPDATE (fat_percentage, snf_percentage, clr_reading, temperature_celsius, quality_status, rejection_reason)
    ON dairy_db.milk_collections TO 'role_quality_tester';
GRANT SELECT ON dairy_db.v_daily_collection_summary TO 'role_quality_tester';

-- 2.5 ACCOUNTS STAFF: Settlement runs, loans, deductions, passbook generation
GRANT SELECT ON dairy_db.farmers TO 'role_accounts_staff';
GRANT SELECT ON dairy_db.milk_collections TO 'role_accounts_staff';
GRANT SELECT, INSERT, UPDATE ON dairy_db.farmer_deductions_master TO 'role_accounts_staff';
GRANT SELECT, INSERT, UPDATE ON dairy_db.payment_periods TO 'role_accounts_staff';
GRANT SELECT, INSERT, UPDATE ON dairy_db.farmer_payments TO 'role_accounts_staff';
GRANT SELECT, INSERT ON dairy_db.farmer_payment_deduction_items TO 'role_accounts_staff';
GRANT SELECT ON dairy_db.v_farmer_performance TO 'role_accounts_staff';
GRANT EXECUTE ON PROCEDURE dairy_db.sp_generate_farmer_payments TO 'role_accounts_staff';

-- 2.6 FARMER (Self-Service): Restricted read-only view of their own passbook
GRANT SELECT ON dairy_db.v_farmer_self_service TO 'role_farmer';

-- =====================================================================
-- 3. CREATE SAMPLE USERS AND GRANT ROLES
-- =====================================================================
CREATE USER IF NOT EXISTS 'db_manager_user'@'localhost' IDENTIFIED BY 'Manager@Secure2026';
CREATE USER IF NOT EXISTS 'db_operator_user'@'localhost' IDENTIFIED BY 'Operator@Secure2026';
CREATE USER IF NOT EXISTS 'db_accounts_user'@'localhost' IDENTIFIED BY 'Accounts@Secure2026';
CREATE USER IF NOT EXISTS 'db_farmer_user'@'localhost' IDENTIFIED BY 'Farmer@Secure2026';

GRANT 'role_dairy_manager' TO 'db_manager_user'@'localhost';
GRANT 'role_centre_operator' TO 'db_operator_user'@'localhost';
GRANT 'role_accounts_staff' TO 'db_accounts_user'@'localhost';
GRANT 'role_farmer' TO 'db_farmer_user'@'localhost';

-- Set default roles for seamless login
SET DEFAULT ROLE 'role_dairy_manager' TO 'db_manager_user'@'localhost';
SET DEFAULT ROLE 'role_centre_operator' TO 'db_operator_user'@'localhost';
SET DEFAULT ROLE 'role_accounts_staff' TO 'db_accounts_user'@'localhost';
SET DEFAULT ROLE 'role_farmer' TO 'db_farmer_user'@'localhost';

SELECT 'Role-Based Access Control (RBAC) Architecture Successfully Configured!' AS status;
