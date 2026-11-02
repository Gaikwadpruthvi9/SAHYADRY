-- =====================================================================
-- DAIRY COLLECTION AND FARMER PAYMENT MANAGEMENT SYSTEM
-- Transaction Processing, Concurrency Control, and Recovery Demonstration
-- Database: dairy_db
-- =====================================================================

USE dairy_db;

-- =====================================================================
-- 1. DEMONSTRATION OF ACID TRANSACTIONS (Atomicity, Consistency, Isolation, Durability)
-- =====================================================================

-- Scenario 1.1: Successful Atomic Collection Entry with COMMIT
START TRANSACTION;

-- Step A: Insert valid collection record
INSERT INTO milk_collections (
    farmer_id, centre_id, collection_date, session, milk_type_id,
    quantity_litres, fat_percentage, snf_percentage, clr_reading,
    temperature_celsius, quality_status, rate_chart_id, rate_per_litre,
    gross_amount, incentive_amount, deduction_amount, net_payable_amount,
    payment_status, collected_by_user_id
) VALUES (
    3, 1, '2026-10-28', 'EVENING', 1,
    18.00, 4.10, 8.70, 29.0, 27.5, 'ACCEPTED',
    2, 39.80, 716.40, 18.00, 0.00, 734.40,
    'PENDING', 3
);

-- Step B: Audit entry within the same atomic boundary
INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
VALUES ('milk_collections', LAST_INSERT_ID(), 'INSERT', 'ALL', NULL, 'New collection added', 'Evening session intake', 3);

COMMIT;
SELECT 'Scenario 1.1: Atomic Transaction COMMITTED successfully.' AS result;

-- Scenario 1.2: Atomic Rollback on Business Constraint Failure
START TRANSACTION;

-- Step A: Insert a collection entry
INSERT INTO milk_collections (
    farmer_id, centre_id, collection_date, session, milk_type_id,
    quantity_litres, fat_percentage, snf_percentage, rate_chart_id,
    rate_per_litre, gross_amount, net_payable_amount, payment_status,
    collected_by_user_id
) VALUES (
    4, 2, '2026-10-28', 'EVENING', 1,
    25.00, 3.80, 8.60, 2,
    38.60, 965.00, 965.00, 'PENDING', 4
);

-- Step B: An unhandled anomaly occurs (simulated by explicit ROLLBACK)
ROLLBACK;
SELECT 'Scenario 1.2: Transaction ROLLED BACK. Zero phantom rows remain.' AS result;

-- =====================================================================
-- 2. SAVEPOINT AND PARTIAL ROLLBACK DEMONSTRATION
-- =====================================================================
START TRANSACTION;

-- Step 1: Base milk collection intake
INSERT INTO milk_collections (
    farmer_id, centre_id, collection_date, session, milk_type_id,
    quantity_litres, fat_percentage, snf_percentage, rate_chart_id,
    rate_per_litre, gross_amount, net_payable_amount, payment_status,
    collected_by_user_id
) VALUES (
    5, 2, '2026-10-29', 'MORNING', 1,
    20.00, 3.90, 8.70, 2,
    39.10, 782.00, 782.00, 'PENDING', 4
);
SET @new_col_id = LAST_INSERT_ID();

-- Establish Savepoint after basic collection
SAVEPOINT sp_collection_recorded;

-- Step 2: Attempt an erroneous deduction adjustment
UPDATE milk_collections
SET deduction_amount = 500.00, net_payable_amount = 282.00
WHERE collection_id = @new_col_id;

-- Operator notices an error in the deduction calculation and rolls back to Savepoint
ROLLBACK TO SAVEPOINT sp_collection_recorded;

-- Step 3: Apply the corrected incentive bonus instead
UPDATE milk_collections
SET incentive_amount = 20.00, net_payable_amount = 802.00
WHERE collection_id = @new_col_id;

COMMIT;
SELECT 'Scenario 2: Savepoint partial rollback succeeded! Base intake preserved, error reversed.' AS result;

-- =====================================================================
-- 3. CONCURRENCY CONTROL: SIMULATING ISOLATION ANOMALIES & SOLUTIONS
-- =====================================================================

-- ---------------------------------------------------------------------
-- ANOMALY A: DIRTY READ (Prevented by READ COMMITTED / REPEATABLE READ)
-- ---------------------------------------------------------------------
/*
Scenario:
  Session 1 modifies a collection record's fat percentage and net payable amount.
  Session 2 attempts to generate a payment summary.
  Under READ UNCOMMITTED, Session 2 would read dirty, uncommitted values.
  Under MySQL default (REPEATABLE READ / READ COMMITTED), Session 2 reads only committed data.
*/
-- Demonstration Script for Session 1:
-- SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- START TRANSACTION;
-- UPDATE milk_collections SET net_payable_amount = 9999.00 WHERE collection_id = 1;
-- -- (Session 2 runs SELECT net_payable_amount FROM milk_collections WHERE collection_id = 1;)
-- -- Session 2 will see OLD value (559.70) because Session 1 hasn't committed!
-- ROLLBACK;

-- ---------------------------------------------------------------------
-- ANOMALY B: NON-REPEATABLE READ (Prevented by REPEATABLE READ via MVCC)
-- ---------------------------------------------------------------------
/*
Scenario:
  Session 1 starts a reporting transaction and reads farmer Ramesh's collection total.
  Session 2 simultaneously enters a newly arrived evening collection and commits.
  Under READ COMMITTED, Session 1 re-reading in the same transaction sees a different total.
  Under REPEATABLE READ, InnoDB uses consistent snapshot (MVCC) so Session 1 reads identical values.
*/
-- Session 1 verification:
-- SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- START TRANSACTION;
-- SELECT SUM(quantity_litres) FROM milk_collections WHERE farmer_id = 1; -- Returns 97.00
-- -- (Session 2 inserts 15L and COMMITS)
-- SELECT SUM(quantity_litres) FROM milk_collections WHERE farmer_id = 1; -- Still returns 97.00 (Consistent Read Snapshot)
-- COMMIT;

-- ---------------------------------------------------------------------
-- ANOMALY C: LOST UPDATE (Prevented by PESSIMISTIC LOCKING: SELECT ... FOR UPDATE)
-- ---------------------------------------------------------------------
/*
Scenario:
  Two operators simultaneously recover loan payments from the same farmer deduction account.
  Without row-level locking, both read balance = 2500. Operator A deducts 500, Operator B deducts 700.
  Operator B overwrites Operator A's recovery!
  Solution: Use SELECT balance_amount FROM farmer_deductions_master WHERE deduction_id = 1 FOR UPDATE;
*/
START TRANSACTION;

-- Acquire exclusive X-lock on the farmer's deduction balance row
SELECT deduction_id, balance_amount
FROM farmer_deductions_master
WHERE deduction_id = 1
FOR UPDATE;

-- Safely deduct instalment
UPDATE farmer_deductions_master
SET recovered_amount = recovered_amount + 500.00,
    balance_amount = balance_amount - 500.00
WHERE deduction_id = 1;

COMMIT;
SELECT 'Anomaly C: Lost Update completely prevented using Exclusive Lock (FOR UPDATE).' AS result;

-- =====================================================================
-- 4. SYSTEM RECOVERY SIMULATION (Crash during Batch Payment Execution)
-- =====================================================================
CALL sp_demo_payment_rollback(TRUE, @recovery_msg);
SELECT @recovery_msg AS crash_recovery_outcome;
