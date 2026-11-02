-- =====================================================================
-- DAIRY COLLECTION AND FARMER PAYMENT MANAGEMENT SYSTEM
-- Relational Database Schema DDL (MySQL 8.0+)
-- Database: dairy_db
-- =====================================================================

CREATE DATABASE IF NOT EXISTS dairy_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dairy_db;

-- Disable foreign key checks during schema creation/refresh
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS farmer_payment_deduction_items;
DROP TABLE IF EXISTS farmer_payments;
DROP TABLE IF EXISTS payment_periods;
DROP TABLE IF EXISTS farmer_deductions_master;
DROP TABLE IF EXISTS milk_collections;
DROP TABLE IF EXISTS rate_slabs;
DROP TABLE IF EXISTS rate_chart_master;
DROP TABLE IF EXISTS milk_types;
DROP TABLE IF EXISTS farmers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS collection_centres;
DROP TABLE IF EXISTS villages;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 1. VILLAGES (Geographical and administrative division)
-- =====================================================================
CREATE TABLE villages (
    village_id INT AUTO_INCREMENT PRIMARY KEY,
    village_name VARCHAR(100) NOT NULL,
    taluka VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_village UNIQUE (village_name, taluka, district)
) ENGINE=InnoDB COMMENT='Geographic villages where farmers reside';

-- =====================================================================
-- 2. COLLECTION CENTRES (Physical BMC / DPMCU Milk Collection Units)
-- =====================================================================
CREATE TABLE collection_centres (
    centre_id INT AUTO_INCREMENT PRIMARY KEY,
    centre_code VARCHAR(20) NOT NULL UNIQUE,
    centre_name VARCHAR(100) NOT NULL,
    village_id INT NOT NULL,
    capacity_litres_per_day DECIMAL(10, 2) NOT NULL DEFAULT 5000.00,
    operating_status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    contact_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_centre_village FOREIGN KEY (village_id)
        REFERENCES villages(village_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Milk collection centres across operating regions';

-- =====================================================================
-- 3. USERS (Role-Based Access Control and System Actors)
-- =====================================================================
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    role ENUM(
        'ADMIN',
        'DAIRY_MANAGER',
        'CENTRE_OPERATOR',
        'QUALITY_TESTER',
        'ACCOUNTS_STAFF',
        'FARMER'
    ) NOT NULL,
    assigned_centre_id INT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_centre FOREIGN KEY (assigned_centre_id)
        REFERENCES collection_centres(centre_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='System users with role assignments for RBAC';

-- =====================================================================
-- 4. FARMERS (Milk producers and primary stakeholders)
-- =====================================================================
CREATE TABLE farmers (
    farmer_id INT AUTO_INCREMENT PRIMARY KEY,
    farmer_code VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    village_id INT NOT NULL,
    assigned_centre_id INT NOT NULL,
    phone VARCHAR(15) NOT NULL,
    aadhar_number VARCHAR(16) UNIQUE,
    bank_name VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(30) NOT NULL,
    ifsc_code VARCHAR(15) NOT NULL,
    registration_date DATE NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    user_id INT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_farmer_village FOREIGN KEY (village_id)
        REFERENCES villages(village_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_farmer_centre FOREIGN KEY (assigned_centre_id)
        REFERENCES collection_centres(centre_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_farmer_user FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Registered dairy farmers with bank and centre linkage';

-- =====================================================================
-- 5. MILK TYPES (Biological milk classifications with standard bounds)
-- =====================================================================
CREATE TABLE milk_types (
    milk_type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(30) NOT NULL UNIQUE, -- e.g., 'COW', 'BUFFALO'
    min_fat DECIMAL(4, 2) NOT NULL,
    max_fat DECIMAL(4, 2) NOT NULL,
    min_snf DECIMAL(4, 2) NOT NULL,
    max_snf DECIMAL(4, 2) NOT NULL,
    standard_water_limit_percent DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    description VARCHAR(255),
    CONSTRAINT chk_fat_bounds CHECK (min_fat < max_fat),
    CONSTRAINT chk_snf_bounds CHECK (min_snf < max_snf)
) ENGINE=InnoDB COMMENT='Supported milk categories and biological quality bounds';

-- =====================================================================
-- 6. RATE CHART MASTER (Historical rate policies with temporal validity)
-- =====================================================================
CREATE TABLE rate_chart_master (
    chart_id INT AUTO_INCREMENT PRIMARY KEY,
    chart_code VARCHAR(30) NOT NULL UNIQUE,
    chart_name VARCHAR(100) NOT NULL,
    milk_type_id INT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL, -- NULL represents currently active chart
    base_fat_percent DECIMAL(4, 2) NOT NULL,
    base_snf_percent DECIMAL(4, 2) NOT NULL,
    base_rate_per_litre DECIMAL(8, 2) NOT NULL CHECK (base_rate_per_litre > 0),
    fat_increment_per_point DECIMAL(6, 2) NOT NULL DEFAULT 0.20,
    snf_increment_per_point DECIMAL(6, 2) NOT NULL DEFAULT 0.15,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rate_milktype FOREIGN KEY (milk_type_id)
        REFERENCES milk_types(milk_type_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rate_approver FOREIGN KEY (approved_by)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_effective_period CHECK (effective_to IS NULL OR effective_to >= effective_from)
) ENGINE=InnoDB COMMENT='Effective-dated rate charts preserving pricing history';

-- =====================================================================
-- 7. RATE SLABS (Discrete 2D Quality Matrix: Fat x SNF Grid)
-- =====================================================================
CREATE TABLE rate_slabs (
    slab_id INT AUTO_INCREMENT PRIMARY KEY,
    chart_id INT NOT NULL,
    min_fat DECIMAL(4, 2) NOT NULL,
    max_fat DECIMAL(4, 2) NOT NULL,
    min_snf DECIMAL(4, 2) NOT NULL,
    max_snf DECIMAL(4, 2) NOT NULL,
    rate_per_litre DECIMAL(8, 2) NOT NULL CHECK (rate_per_litre > 0),
    incentive_per_litre DECIMAL(6, 2) NOT NULL DEFAULT 0.00 CHECK (incentive_per_litre >= 0),
    penalty_per_litre DECIMAL(6, 2) NOT NULL DEFAULT 0.00 CHECK (penalty_per_litre >= 0),
    CONSTRAINT fk_slab_chart FOREIGN KEY (chart_id)
        REFERENCES rate_chart_master(chart_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_slab_range UNIQUE (chart_id, min_fat, max_fat, min_snf, max_snf),
    CONSTRAINT chk_slab_bounds CHECK (min_fat <= max_fat AND min_snf <= max_snf)
) ENGINE=InnoDB COMMENT='Discrete 2D pricing matrix slabs based on Fat and SNF';

-- =====================================================================
-- 8. MILK COLLECTIONS (High-volume transaction ledger)
-- =====================================================================
CREATE TABLE milk_collections (
    collection_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    farmer_id INT NOT NULL,
    centre_id INT NOT NULL,
    collection_date DATE NOT NULL,
    session ENUM('MORNING', 'EVENING') NOT NULL,
    collection_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    milk_type_id INT NOT NULL,
    quantity_litres DECIMAL(8, 2) NOT NULL CHECK (quantity_litres > 0.00),
    fat_percentage DECIMAL(4, 2) NOT NULL CHECK (fat_percentage >= 2.00 AND fat_percentage <= 15.00),
    snf_percentage DECIMAL(4, 2) NOT NULL CHECK (snf_percentage >= 5.00 AND snf_percentage <= 12.00),
    clr_reading DECIMAL(5, 2) NULL, -- Corrected Lactometer Reading
    temperature_celsius DECIMAL(4, 1) NULL,
    quality_status ENUM('ACCEPTED', 'REJECTED', 'ACCEPTED_WITH_PENALTY') NOT NULL DEFAULT 'ACCEPTED',
    rejection_reason VARCHAR(255) NULL,
    rate_chart_id INT NOT NULL,
    rate_per_litre DECIMAL(8, 2) NOT NULL CHECK (rate_per_litre >= 0.00),
    gross_amount DECIMAL(10, 2) NOT NULL CHECK (gross_amount >= 0.00),
    incentive_amount DECIMAL(8, 2) NOT NULL DEFAULT 0.00 CHECK (incentive_amount >= 0.00),
    deduction_amount DECIMAL(8, 2) NOT NULL DEFAULT 0.00 CHECK (deduction_amount >= 0.00),
    net_payable_amount DECIMAL(10, 2) NOT NULL CHECK (net_payable_amount >= 0.00),
    payment_status ENUM('PENDING', 'PROCESSED', 'PAID') NOT NULL DEFAULT 'PENDING',
    payment_id BIGINT NULL,
    collected_by_user_id INT NOT NULL,
    is_inter_centre_collection BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_farmer_session_date UNIQUE (farmer_id, collection_date, session),
    CONSTRAINT fk_col_farmer FOREIGN KEY (farmer_id)
        REFERENCES farmers(farmer_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_col_centre FOREIGN KEY (centre_id)
        REFERENCES collection_centres(centre_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_col_milktype FOREIGN KEY (milk_type_id)
        REFERENCES milk_types(milk_type_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_col_chart FOREIGN KEY (rate_chart_id)
        REFERENCES rate_chart_master(chart_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_col_operator FOREIGN KEY (collected_by_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Granular milk intake records per session with quality metrics';

-- =====================================================================
-- 9. FARMER DEDUCTIONS MASTER (Feed, Advances, Loans, Vet Charges)
-- =====================================================================
CREATE TABLE farmer_deductions_master (
    deduction_id INT AUTO_INCREMENT PRIMARY KEY,
    farmer_id INT NOT NULL,
    deduction_type ENUM(
        'CATTLE_FEED',
        'ADVANCE_REPAYMENT',
        'VETERINARY_MEDICINE',
        'EQUIPMENT_LOAN',
        'PENALTY',
        'MEMBERSHIP_FEE'
    ) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount > 0.00),
    recovered_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (recovered_amount >= 0.00),
    balance_amount DECIMAL(10, 2) NOT NULL CHECK (balance_amount >= 0.00),
    max_deduction_per_period DECIMAL(8, 2) NULL,
    status ENUM('ACTIVE', 'FULLY_RECOVERED', 'WAIVED') NOT NULL DEFAULT 'ACTIVE',
    description VARCHAR(255),
    approved_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ded_farmer FOREIGN KEY (farmer_id)
        REFERENCES farmers(farmer_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ded_approver FOREIGN KEY (approved_by)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_ded_balance CHECK (recovered_amount <= total_amount)
) ENGINE=InnoDB COMMENT='Farmer ledger accounts for scheduled loan and input deductions';

-- =====================================================================
-- 10. PAYMENT PERIODS / MUSTER PERIODS
-- In Indian dairy billing, a 'MUSTER' (मस्टर) is a fixed 10-day settlement
-- interval used to tally and pay farmers for their milk collections.
-- Every month is divided into 3 Musters:
--   • Muster 1: Days 1 to 10
--   • Muster 2: Days 11 to 20
--   • Muster 3: Days 21 to End of Month
-- =====================================================================
CREATE TABLE payment_periods (
    period_id INT AUTO_INCREMENT PRIMARY KEY,
    period_code VARCHAR(30) NOT NULL UNIQUE COMMENT 'e.g. MUSTER-2026-OCT-M1 (1-10 Oct), MUSTER-2026-OCT-M2 (11-20 Oct)',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cycle_type ENUM('MUSTER_10_DAY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY') NOT NULL DEFAULT 'MUSTER_10_DAY',
    status ENUM('OPEN', 'PROCESSING', 'APPROVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_period_span CHECK (end_date >= start_date)
) ENGINE=InnoDB COMMENT='10-Day Muster billing intervals for farmer milk payments';

-- =====================================================================
-- 11. FARMER PAYMENTS (Consolidated payment voucher per farmer per cycle)
-- =====================================================================
CREATE TABLE farmer_payments (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    period_id INT NOT NULL,
    farmer_id INT NOT NULL,
    total_supply_days INT NOT NULL DEFAULT 0,
    total_collections_count INT NOT NULL DEFAULT 0,
    total_quantity_litres DECIMAL(10, 2) NOT NULL CHECK (total_quantity_litres >= 0.00),
    weighted_avg_fat DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    weighted_avg_snf DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    gross_amount DECIMAL(12, 2) NOT NULL CHECK (gross_amount >= 0.00),
    total_incentives DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_incentives >= 0.00),
    total_deductions DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_deductions >= 0.00),
    previous_outstanding_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    net_payable_amount DECIMAL(12, 2) NOT NULL,
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0.00),
    balance_carried_forward DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_mode ENUM(
        'BANK_TRANSFER_NEFT',
        'IMPS',
        'CASH',
        'CHEQUE',
        'DIRECT_BENEFIT_TRANSFER'
    ) NOT NULL DEFAULT 'BANK_TRANSFER_NEFT',
    payment_reference_no VARCHAR(100) NULL,
    payment_status ENUM('DRAFT', 'APPROVED', 'DISBURSED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    generated_by_user_id INT NOT NULL,
    approved_by_user_id INT NULL,
    approved_at TIMESTAMP NULL,
    disbursed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_farmer_period UNIQUE (period_id, farmer_id),
    CONSTRAINT fk_pay_period FOREIGN KEY (period_id)
        REFERENCES payment_periods(period_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pay_farmer FOREIGN KEY (farmer_id)
        REFERENCES farmers(farmer_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pay_gen_user FOREIGN KEY (generated_by_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pay_app_user FOREIGN KEY (approved_by_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Consolidated settlement payment vouchers for farmers';

-- =====================================================================
-- 12. FARMER PAYMENT DEDUCTION ITEMS (Itemized deduction audit trail)
-- =====================================================================
CREATE TABLE farmer_payment_deduction_items (
    item_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id BIGINT NOT NULL,
    deduction_id INT NOT NULL,
    amount_applied DECIMAL(10, 2) NOT NULL CHECK (amount_applied > 0.00),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_payment FOREIGN KEY (payment_id)
        REFERENCES farmer_payments(payment_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_item_deduction FOREIGN KEY (deduction_id)
        REFERENCES farmer_deductions_master(deduction_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Itemized deduction applications tied to payment vouchers';

-- =====================================================================
-- 13. AUDIT LOGS (Immutable security and modification traceability)
-- =====================================================================
CREATE TABLE audit_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id BIGINT NOT NULL,
    operation ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    column_name VARCHAR(50) NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    reason VARCHAR(255) NOT NULL,
    modified_by_user_id INT NULL,
    client_ip VARCHAR(45) NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (modified_by_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Immutable audit trail tracking all data mutations';

-- Add foreign key link from milk_collections to farmer_payments
ALTER TABLE milk_collections
    ADD CONSTRAINT fk_col_payment FOREIGN KEY (payment_id)
    REFERENCES farmer_payments(payment_id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- =====================================================================
-- INDEXES FOR CORE WORKLOAD OPTIMIZATION
-- =====================================================================
-- Composite indexes for frequent analytical and session lookups
CREATE INDEX idx_col_date_session ON milk_collections(collection_date, session);
CREATE INDEX idx_col_farmer_date ON milk_collections(farmer_id, collection_date);
CREATE INDEX idx_col_centre_date ON milk_collections(centre_id, collection_date);
CREATE INDEX idx_col_payment_status ON milk_collections(payment_status, collection_date);
CREATE INDEX idx_col_quality ON milk_collections(milk_type_id, fat_percentage, snf_percentage);

CREATE INDEX idx_farmers_centre ON farmers(assigned_centre_id, status);
CREATE INDEX idx_farmers_village ON farmers(village_id);
CREATE INDEX idx_payments_period ON farmer_payments(period_id, payment_status);
CREATE INDEX idx_payments_farmer ON farmer_payments(farmer_id, created_at);
CREATE INDEX idx_audit_table_rec ON audit_logs(table_name, record_id, timestamp);

SELECT 'Dairy Database Schema DDL Successfully Created!' AS status;
