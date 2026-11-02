-- =====================================================================
-- DAIRY COLLECTION AND FARMER PAYMENT MANAGEMENT SYSTEM
-- Views, Triggers, and Stored Procedures
-- Database: dairy_db
-- =====================================================================

USE dairy_db;

DELIMITER $$

-- =====================================================================
-- 1. TRIGGERS: AUTOMATED AUDIT TRAIL LOGGING
-- =====================================================================

-- Trigger on milk_collections UPDATE
DROP TRIGGER IF EXISTS trg_audit_milk_collection_update$$
CREATE TRIGGER trg_audit_milk_collection_update
AFTER UPDATE ON milk_collections
FOR EACH ROW
BEGIN
    DECLARE v_reason VARCHAR(255);
    SET v_reason = IFNULL(@audit_reason, 'Correction or adjustment applied via system');

    -- Log quantity change
    IF OLD.quantity_litres <> NEW.quantity_litres THEN
        INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
        VALUES ('milk_collections', NEW.collection_id, 'UPDATE', 'quantity_litres',
                CAST(OLD.quantity_litres AS CHAR), CAST(NEW.quantity_litres AS CHAR), v_reason, @current_user_id);
    END IF;

    -- Log fat change
    IF OLD.fat_percentage <> NEW.fat_percentage THEN
        INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
        VALUES ('milk_collections', NEW.collection_id, 'UPDATE', 'fat_percentage',
                CAST(OLD.fat_percentage AS CHAR), CAST(NEW.fat_percentage AS CHAR), v_reason, @current_user_id);
    END IF;

    -- Log SNF change
    IF OLD.snf_percentage <> NEW.snf_percentage THEN
        INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
        VALUES ('milk_collections', NEW.collection_id, 'UPDATE', 'snf_percentage',
                CAST(OLD.snf_percentage AS CHAR), CAST(NEW.snf_percentage AS CHAR), v_reason, @current_user_id);
    END IF;

    -- Log rate change
    IF OLD.rate_per_litre <> NEW.rate_per_litre THEN
        INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
        VALUES ('milk_collections', NEW.collection_id, 'UPDATE', 'rate_per_litre',
                CAST(OLD.rate_per_litre AS CHAR), CAST(NEW.rate_per_litre AS CHAR), v_reason, @current_user_id);
    END IF;

    -- Log net payable change
    IF OLD.net_payable_amount <> NEW.net_payable_amount THEN
        INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
        VALUES ('milk_collections', NEW.collection_id, 'UPDATE', 'net_payable_amount',
                CAST(OLD.net_payable_amount AS CHAR), CAST(NEW.net_payable_amount AS CHAR), v_reason, @current_user_id);
    END IF;

    -- Log status change
    IF OLD.payment_status <> NEW.payment_status THEN
        INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
        VALUES ('milk_collections', NEW.collection_id, 'UPDATE', 'payment_status',
                OLD.payment_status, NEW.payment_status, v_reason, @current_user_id);
    END IF;
END$$

-- Trigger on milk_collections DELETE
DROP TRIGGER IF EXISTS trg_audit_milk_collection_delete$$
CREATE TRIGGER trg_audit_milk_collection_delete
AFTER DELETE ON milk_collections
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
    VALUES ('milk_collections', OLD.collection_id, 'DELETE', 'ALL_COLUMNS',
            CONCAT('Farmer:', OLD.farmer_id, ', Date:', OLD.collection_date, ', Litres:', OLD.quantity_litres, ', Net:', OLD.net_payable_amount),
            NULL, IFNULL(@audit_reason, 'Record deleted by operator/manager'), @current_user_id);
END$$

-- Trigger on farmer_payments UPDATE (audit settlement authorization)
DROP TRIGGER IF EXISTS trg_audit_farmer_payments_update$$
CREATE TRIGGER trg_audit_farmer_payments_update
AFTER UPDATE ON farmer_payments
FOR EACH ROW
BEGIN
    IF OLD.payment_status <> NEW.payment_status THEN
        INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
        VALUES ('farmer_payments', NEW.payment_id, 'UPDATE', 'payment_status',
                OLD.payment_status, NEW.payment_status,
                CONCAT('Payment status transitioned to ', NEW.payment_status),
                IFNULL(NEW.approved_by_user_id, @current_user_id));
    END IF;

    IF OLD.amount_paid <> NEW.amount_paid THEN
        INSERT INTO audit_logs (table_name, record_id, operation, column_name, old_value, new_value, reason, modified_by_user_id)
        VALUES ('farmer_payments', NEW.payment_id, 'UPDATE', 'amount_paid',
                CAST(OLD.amount_paid AS CHAR), CAST(NEW.amount_paid AS CHAR),
                'Disbursement amount updated', IFNULL(NEW.approved_by_user_id, @current_user_id));
    END IF;
END$$

DELIMITER ;

-- =====================================================================
-- 2. REPORTING & OPERATIONAL VIEWS
-- =====================================================================

-- Daily Collection Summary View (Morning vs Evening, Centre-wise, Milk-type-wise)
CREATE OR REPLACE VIEW v_daily_collection_summary AS
SELECT
    mc.collection_date,
    mc.session,
    cc.centre_id,
    cc.centre_code,
    cc.centre_name,
    v.village_name,
    mt.type_name AS milk_type,
    COUNT(mc.collection_id) AS total_entries,
    COUNT(DISTINCT mc.farmer_id) AS active_farmers_count,
    ROUND(SUM(mc.quantity_litres), 2) AS total_litres,
    ROUND(SUM(mc.quantity_litres * mc.fat_percentage) / SUM(mc.quantity_litres), 2) AS weighted_avg_fat,
    ROUND(SUM(mc.quantity_litres * mc.snf_percentage) / SUM(mc.quantity_litres), 2) AS weighted_avg_snf,
    ROUND(SUM(mc.gross_amount), 2) AS total_gross_amount,
    ROUND(SUM(mc.incentive_amount), 2) AS total_incentives,
    ROUND(SUM(mc.deduction_amount), 2) AS total_deductions,
    ROUND(SUM(mc.net_payable_amount), 2) AS total_net_payable,
    ROUND(AVG(mc.rate_per_litre), 2) AS avg_rate_per_litre
FROM milk_collections mc
JOIN collection_centres cc ON mc.centre_id = cc.centre_id
JOIN villages v ON cc.village_id = v.village_id
JOIN milk_types mt ON mc.milk_type_id = mt.milk_type_id
GROUP BY
    mc.collection_date,
    mc.session,
    cc.centre_id,
    cc.centre_code,
    cc.centre_name,
    v.village_name,
    mt.type_name;

-- Farmer Supply Performance & Profile View
CREATE OR REPLACE VIEW v_farmer_performance AS
SELECT
    f.farmer_id,
    f.farmer_code,
    CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
    v.village_name,
    cc.centre_name AS assigned_centre,
    f.phone,
    f.bank_name,
    f.bank_account_number,
    f.status AS farmer_status,
    COUNT(mc.collection_id) AS total_collections_to_date,
    COUNT(DISTINCT mc.collection_date) AS days_supplied,
    IFNULL(ROUND(SUM(mc.quantity_litres), 2), 0.00) AS total_milk_supplied_litres,
    IFNULL(ROUND(SUM(mc.quantity_litres * mc.fat_percentage) / NULLIF(SUM(mc.quantity_litres), 0), 2), 0.00) AS overall_avg_fat,
    IFNULL(ROUND(SUM(mc.quantity_litres * mc.snf_percentage) / NULLIF(SUM(mc.quantity_litres), 0), 2), 0.00) AS overall_avg_snf,
    IFNULL(ROUND(SUM(mc.net_payable_amount), 2), 0.00) AS total_earnings
FROM farmers f
JOIN villages v ON f.village_id = v.village_id
JOIN collection_centres cc ON f.assigned_centre_id = cc.centre_id
LEFT JOIN milk_collections mc ON f.farmer_id = mc.farmer_id
GROUP BY
    f.farmer_id,
    f.farmer_code,
    f.first_name,
    f.last_name,
    v.village_name,
    cc.centre_name,
    f.phone,
    f.bank_name,
    f.bank_account_number,
    f.status;

-- Centre Performance and Capacity Utilization View
CREATE OR REPLACE VIEW v_centre_performance AS
SELECT
    cc.centre_id,
    cc.centre_code,
    cc.centre_name,
    v.village_name,
    cc.capacity_litres_per_day,
    cc.operating_status,
    COUNT(DISTINCT f.farmer_id) AS registered_farmers,
    COUNT(DISTINCT mc.farmer_id) AS contributing_farmers_last_30d,
    IFNULL(ROUND(SUM(CASE WHEN mc.collection_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN mc.quantity_litres ELSE 0 END), 2), 0.00) AS milk_last_30d_litres,
    IFNULL(ROUND(SUM(CASE WHEN mc.collection_date = CURDATE() THEN mc.quantity_litres ELSE 0 END), 2), 0.00) AS milk_today_litres,
    ROUND(
        (IFNULL(SUM(CASE WHEN mc.collection_date = CURDATE() THEN mc.quantity_litres ELSE 0 END), 0) / cc.capacity_litres_per_day) * 100,
        1
    ) AS capacity_utilization_today_pct
FROM collection_centres cc
JOIN villages v ON cc.village_id = v.village_id
LEFT JOIN farmers f ON cc.centre_id = f.assigned_centre_id
LEFT JOIN milk_collections mc ON cc.centre_id = mc.centre_id
GROUP BY
    cc.centre_id,
    cc.centre_code,
    cc.centre_name,
    v.village_name,
    cc.capacity_litres_per_day,
    cc.operating_status;

-- Farmer Self-Service Secure Portal View
CREATE OR REPLACE VIEW v_farmer_self_service AS
SELECT
    mc.collection_id,
    mc.farmer_id,
    f.farmer_code,
    CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
    mc.collection_date,
    mc.session,
    mt.type_name AS milk_type,
    mc.quantity_litres,
    mc.fat_percentage,
    mc.snf_percentage,
    mc.rate_per_litre,
    mc.gross_amount,
    mc.incentive_amount,
    mc.deduction_amount,
    mc.net_payable_amount,
    mc.payment_status,
    cc.centre_name AS collection_centre,
    mc.collection_timestamp
FROM milk_collections mc
JOIN farmers f ON mc.farmer_id = f.farmer_id
JOIN milk_types mt ON mc.milk_type_id = mt.milk_type_id
JOIN collection_centres cc ON mc.centre_id = cc.centre_id;

-- =====================================================================
-- 3. STORED PROCEDURES
-- =====================================================================

DELIMITER $$

-- Procedure to compute applicable rate based on active chart & quality
DROP PROCEDURE IF EXISTS sp_calculate_rate$$
CREATE PROCEDURE sp_calculate_rate(
    IN p_milk_type_id INT,
    IN p_fat DECIMAL(4, 2),
    IN p_snf DECIMAL(4, 2),
    IN p_collection_date DATE,
    OUT p_rate_chart_id INT,
    OUT p_rate_per_litre DECIMAL(8, 2),
    OUT p_incentive_rate DECIMAL(6, 2)
)
BEGIN
    DECLARE v_base_rate DECIMAL(8, 2);
    DECLARE v_base_fat DECIMAL(4, 2);
    DECLARE v_base_snf DECIMAL(4, 2);
    DECLARE v_fat_inc DECIMAL(6, 2);
    DECLARE v_snf_inc DECIMAL(6, 2);
    DECLARE v_slab_rate DECIMAL(8, 2);
    DECLARE v_slab_incentive DECIMAL(6, 2);

    -- Find prevailing active rate chart for the given milk type and date
    SELECT
        chart_id, base_rate_per_litre, base_fat_percent, base_snf_percent,
        fat_increment_per_point, snf_increment_per_point
    INTO
        p_rate_chart_id, v_base_rate, v_base_fat, v_base_snf,
        v_fat_inc, v_snf_inc
    FROM rate_chart_master
    WHERE milk_type_id = p_milk_type_id
      AND effective_from <= p_collection_date
      AND (effective_to IS NULL OR effective_to >= p_collection_date)
      AND is_active = TRUE
    ORDER BY effective_from DESC
    LIMIT 1;

    IF p_rate_chart_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No valid active rate chart found for the specified milk type and date.';
    END IF;

    -- Check if a specific discrete slab matches first
    SELECT rate_per_litre, incentive_per_litre
    INTO v_slab_rate, v_slab_incentive
    FROM rate_slabs
    WHERE chart_id = p_rate_chart_id
      AND p_fat >= min_fat AND p_fat <= max_fat
      AND p_snf >= min_snf AND p_snf <= max_snf
    LIMIT 1;

    IF v_slab_rate IS NOT NULL THEN
        SET p_rate_per_litre = v_slab_rate;
        SET p_incentive_rate = IFNULL(v_slab_incentive, 0.00);
    ELSE
        -- Fallback to standard two-axis linear quality pricing formula:
        -- Rate = BaseRate + ((Fat - BaseFat) * 10 * FatInc) + ((SNF - BaseSNF) * 10 * SNFInc)
        SET p_rate_per_litre = ROUND(
            v_base_rate +
            ((p_fat - v_base_fat) * 10 * v_fat_inc) +
            ((p_snf - v_base_snf) * 10 * v_snf_inc),
            2
        );
        -- Floor rate to avoid negative values on poor milk
        IF p_rate_per_litre < 10.00 THEN
            SET p_rate_per_litre = 10.00;
        END IF;

        -- Incentive bonus for high quality milk (e.g. Fat > 4.5 & SNF > 8.8 for cow)
        IF p_fat >= (v_base_fat + 1.0) AND p_snf >= (v_base_snf + 0.3) THEN
            SET p_incentive_rate = 1.50;
        ELSE
            SET p_incentive_rate = 0.00;
        END IF;
    END IF;
END$$

-- Procedure to Record Milk Collection Atomically
DROP PROCEDURE IF EXISTS sp_record_milk_collection$$
CREATE PROCEDURE sp_record_milk_collection(
    IN p_farmer_id INT,
    IN p_centre_id INT,
    IN p_collection_date DATE,
    IN p_session ENUM('MORNING', 'EVENING'),
    IN p_milk_type_id INT,
    IN p_quantity DECIMAL(8, 2),
    IN p_fat DECIMAL(4, 2),
    IN p_snf DECIMAL(4, 2),
    IN p_clr DECIMAL(5, 2),
    IN p_temp DECIMAL(4, 1),
    IN p_user_id INT,
    OUT p_collection_id BIGINT,
    OUT p_rate DECIMAL(8, 2),
    OUT p_gross DECIMAL(10, 2),
    OUT p_net DECIMAL(10, 2)
)
proc_block: BEGIN
    DECLARE v_farmer_status VARCHAR(20);
    DECLARE v_farmer_assigned_centre INT;
    DECLARE v_is_inter_centre BOOLEAN DEFAULT FALSE;
    DECLARE v_chart_id INT;
    DECLARE v_rate_per_litre DECIMAL(8, 2);
    DECLARE v_incentive_rate DECIMAL(6, 2);
    DECLARE v_incentive_amount DECIMAL(8, 2);
    DECLARE v_gross_amount DECIMAL(10, 2);
    DECLARE v_net_amount DECIMAL(10, 2);
    DECLARE v_existing_count INT;

    -- Exception handler with rollback
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- 1. Validate farmer
    SELECT status, assigned_centre_id
    INTO v_farmer_status, v_farmer_assigned_centre
    FROM farmers
    WHERE farmer_id = p_farmer_id;

    IF v_farmer_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Farmer record does not exist.';
    END IF;

    IF v_farmer_status <> 'ACTIVE' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot record collection: Farmer account is INACTIVE or SUSPENDED.';
    END IF;

    IF v_farmer_assigned_centre <> p_centre_id THEN
        SET v_is_inter_centre = TRUE;
    END IF;

    -- 2. Duplicate entry check
    SELECT COUNT(*) INTO v_existing_count
    FROM milk_collections
    WHERE farmer_id = p_farmer_id
      AND collection_date = p_collection_date
      AND session = p_session;

    IF v_existing_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Duplicate entry: Milk collection already recorded for this farmer, date, and session.';
    END IF;

    -- 3. Calculate applicable rate & quality incentive
    CALL sp_calculate_rate(p_milk_type_id, p_fat, p_snf, p_collection_date, v_chart_id, v_rate_per_litre, v_incentive_rate);

    SET v_gross_amount = ROUND(p_quantity * v_rate_per_litre, 2);
    SET v_incentive_amount = ROUND(p_quantity * v_incentive_rate, 2);
    SET v_net_amount = ROUND(v_gross_amount + v_incentive_amount, 2);

    -- 4. Insert collection row
    INSERT INTO milk_collections (
        farmer_id, centre_id, collection_date, session,
        milk_type_id, quantity_litres, fat_percentage, snf_percentage,
        clr_reading, temperature_celsius, quality_status,
        rate_chart_id, rate_per_litre, gross_amount, incentive_amount,
        deduction_amount, net_payable_amount, payment_status,
        collected_by_user_id, is_inter_centre_collection
    ) VALUES (
        p_farmer_id, p_centre_id, p_collection_date, p_session,
        p_milk_type_id, p_quantity, p_fat, p_snf,
        p_clr, p_temp, 'ACCEPTED',
        v_chart_id, v_rate_per_litre, v_gross_amount, v_incentive_amount,
        0.00, v_net_amount, 'PENDING',
        p_user_id, v_is_inter_centre
    );

    SET p_collection_id = LAST_INSERT_ID();
    SET p_rate = v_rate_per_litre;
    SET p_gross = v_gross_amount;
    SET p_net = v_net_amount;

    COMMIT;
END$$

-- Procedure to Correct Milk Collection Record with Mandatory Audit
DROP PROCEDURE IF EXISTS sp_correct_milk_collection$$
CREATE PROCEDURE sp_correct_milk_collection(
    IN p_collection_id BIGINT,
    IN p_new_quantity DECIMAL(8, 2),
    IN p_new_fat DECIMAL(4, 2),
    IN p_new_snf DECIMAL(4, 2),
    IN p_reason VARCHAR(255),
    IN p_modified_by_user_id INT
)
BEGIN
    DECLARE v_milk_type_id INT;
    DECLARE v_date DATE;
    DECLARE v_payment_status VARCHAR(20);
    DECLARE v_chart_id INT;
    DECLARE v_new_rate DECIMAL(8, 2);
    DECLARE v_new_incentive_rate DECIMAL(6, 2);
    DECLARE v_new_gross DECIMAL(10, 2);
    DECLARE v_new_incentive DECIMAL(8, 2);
    DECLARE v_new_net DECIMAL(10, 2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT milk_type_id, collection_date, payment_status
    INTO v_milk_type_id, v_date, v_payment_status
    FROM milk_collections
    WHERE collection_id = p_collection_id
    FOR UPDATE;

    IF v_payment_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Collection record does not exist.';
    END IF;

    IF v_payment_status = 'PAID' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot modify collection: Payment has already been disbursed.';
    END IF;

    -- Recalculate rate
    CALL sp_calculate_rate(v_milk_type_id, p_new_fat, p_new_snf, v_date, v_chart_id, v_new_rate, v_new_incentive_rate);

    SET v_new_gross = ROUND(p_new_quantity * v_new_rate, 2);
    SET v_new_incentive = ROUND(p_new_quantity * v_new_incentive_rate, 2);
    SET v_new_net = ROUND(v_new_gross + v_new_incentive, 2);

    -- Set audit session variables for triggers
    SET @audit_reason = p_reason;
    SET @current_user_id = p_modified_by_user_id;

    -- Perform update (Trigger trg_audit_milk_collection_update will fire)
    UPDATE milk_collections
    SET quantity_litres = p_new_quantity,
        fat_percentage = p_new_fat,
        snf_percentage = p_new_snf,
        rate_per_litre = v_new_rate,
        gross_amount = v_new_gross,
        incentive_amount = v_new_incentive,
        net_payable_amount = v_new_net
    WHERE collection_id = p_collection_id;

    SET @audit_reason = NULL;
    SET @current_user_id = NULL;

    COMMIT;
END$$

-- Batch Payment Generation Procedure with Deductions and Period Closing
DROP PROCEDURE IF EXISTS sp_generate_farmer_payments$$
CREATE PROCEDURE sp_generate_farmer_payments(
    IN p_period_id INT,
    IN p_generated_by_user_id INT,
    OUT p_farmers_processed INT,
    OUT p_total_disbursed DECIMAL(12, 2)
)
BEGIN
    DECLARE v_period_status VARCHAR(20);
    DECLARE v_start_date DATE;
    DECLARE v_end_date DATE;
    DECLARE done INT DEFAULT FALSE;

    -- Farmer cursor variables
    DECLARE cur_farmer_id INT;
    DECLARE cur_supply_days INT;
    DECLARE cur_collections_count INT;
    DECLARE cur_quantity DECIMAL(10, 2);
    DECLARE cur_weighted_fat DECIMAL(4, 2);
    DECLARE cur_weighted_snf DECIMAL(4, 2);
    DECLARE cur_gross DECIMAL(12, 2);
    DECLARE cur_incentives DECIMAL(10, 2);
    DECLARE cur_deductions DECIMAL(10, 2);
    DECLARE cur_net DECIMAL(12, 2);
    DECLARE cur_payment_id BIGINT;

    -- Deduction cursor variables
    DECLARE d_done INT DEFAULT FALSE;
    DECLARE d_id INT;
    DECLARE d_bal DECIMAL(10, 2);
    DECLARE d_max DECIMAL(8, 2);
    DECLARE d_apply DECIMAL(10, 2);
    DECLARE d_remaining_cap DECIMAL(10, 2);

    -- Farmer cursor over unbilled collections in the period
    DECLARE cur_farmers CURSOR FOR
        SELECT
            mc.farmer_id,
            COUNT(DISTINCT mc.collection_date) AS supply_days,
            COUNT(mc.collection_id) AS col_count,
            ROUND(SUM(mc.quantity_litres), 2) AS total_qty,
            ROUND(SUM(mc.quantity_litres * mc.fat_percentage) / SUM(mc.quantity_litres), 2) AS w_fat,
            ROUND(SUM(mc.quantity_litres * mc.snf_percentage) / SUM(mc.quantity_litres), 2) AS w_snf,
            ROUND(SUM(mc.gross_amount), 2) AS gross_amt,
            ROUND(SUM(mc.incentive_amount), 2) AS inc_amt
        FROM milk_collections mc
        WHERE mc.collection_date BETWEEN v_start_date AND v_end_date
          AND mc.payment_status = 'PENDING'
        GROUP BY mc.farmer_id;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT status, start_date, end_date
    INTO v_period_status, v_start_date, v_end_date
    FROM payment_periods
    WHERE period_id = p_period_id
    FOR UPDATE;

    IF v_period_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid Payment Period.';
    END IF;

    IF v_period_status = 'CLOSED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment Period is already CLOSED.';
    END IF;

    -- Transition period to PROCESSING
    UPDATE payment_periods SET status = 'PROCESSING' WHERE period_id = p_period_id;

    SET p_farmers_processed = 0;
    SET p_total_disbursed = 0.00;

    OPEN cur_farmers;

    read_loop: LOOP
        FETCH cur_farmers INTO
            cur_farmer_id, cur_supply_days, cur_collections_count,
            cur_quantity, cur_weighted_fat, cur_weighted_snf,
            cur_gross, cur_incentives;

        IF done THEN
            LEAVE read_loop;
        END IF;

        SET cur_deductions = 0.00;
        -- Maximum allowed deductions cannot exceed 50% of gross + incentives to guarantee farmer livelihood
        SET d_remaining_cap = ROUND((cur_gross + cur_incentives) * 0.50, 2);

        -- Insert Draft Payment record
        INSERT INTO farmer_payments (
            period_id, farmer_id, total_supply_days, total_collections_count,
            total_quantity_litres, weighted_avg_fat, weighted_avg_snf,
            gross_amount, total_incentives, total_deductions,
            previous_outstanding_balance, net_payable_amount, amount_paid,
            payment_status, generated_by_user_id
        ) VALUES (
            p_period_id, cur_farmer_id, cur_supply_days, cur_collections_count,
            cur_quantity, cur_weighted_fat, cur_weighted_snf,
            cur_gross, cur_incentives, 0.00,
            0.00, (cur_gross + cur_incentives), 0.00,
            'APPROVED', p_generated_by_user_id
        );

        SET cur_payment_id = LAST_INSERT_ID();

        -- Scan active deductions for this farmer
        block_deductions: BEGIN
            DECLARE cur_ded CURSOR FOR
                SELECT deduction_id, balance_amount, IFNULL(max_deduction_per_period, balance_amount)
                FROM farmer_deductions_master
                WHERE farmer_id = cur_farmer_id
                  AND status = 'ACTIVE'
                  AND balance_amount > 0;
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET d_done = TRUE;

            SET d_done = FALSE;
            OPEN cur_ded;
            ded_loop: LOOP
                FETCH cur_ded INTO d_id, d_bal, d_max;
                IF d_done THEN
                    LEAVE ded_loop;
                END IF;

                SET d_apply = LEAST(d_bal, d_max, d_remaining_cap);

                IF d_apply > 0 THEN
                    -- Apply deduction
                    INSERT INTO farmer_payment_deduction_items (payment_id, deduction_id, amount_applied)
                    VALUES (cur_payment_id, d_id, d_apply);

                    UPDATE farmer_deductions_master
                    SET recovered_amount = recovered_amount + d_apply,
                        balance_amount = balance_amount - d_apply,
                        status = IF(balance_amount - d_apply <= 0.01, 'FULLY_RECOVERED', 'ACTIVE')
                    WHERE deduction_id = d_id;

                    SET cur_deductions = cur_deductions + d_apply;
                    SET d_remaining_cap = d_remaining_cap - d_apply;
                END IF;
            END LOOP ded_loop;
            CLOSE cur_ded;
        END block_deductions;

        -- Finalize farmer payment net amount
        SET cur_net = ROUND((cur_gross + cur_incentives) - cur_deductions, 2);

        UPDATE farmer_payments
        SET total_deductions = cur_deductions,
            net_payable_amount = cur_net,
            amount_paid = cur_net,
            disbursed_at = CURRENT_TIMESTAMP
        WHERE payment_id = cur_payment_id;

        -- Mark collections as PROCESSED and link to payment
        UPDATE milk_collections
        SET payment_status = 'PROCESSED',
            payment_id = cur_payment_id
        WHERE farmer_id = cur_farmer_id
          AND collection_date BETWEEN v_start_date AND v_end_date
          AND payment_status = 'PENDING';

        SET p_farmers_processed = p_farmers_processed + 1;
        SET p_total_disbursed = p_total_disbursed + cur_net;

    END LOOP read_loop;

    CLOSE cur_farmers;

    -- Mark period as APPROVED
    UPDATE payment_periods SET status = 'APPROVED' WHERE period_id = p_period_id;

    COMMIT;
END$$

-- Procedure to Demonstrate ACID Rollback and Savepoint Recovery
DROP PROCEDURE IF EXISTS sp_demo_payment_rollback$$
CREATE PROCEDURE sp_demo_payment_rollback(
    IN p_simulate_failure BOOLEAN,
    OUT p_outcome_message VARCHAR(255)
)
BEGIN
    DECLARE v_test_farmer_id INT;
    DECLARE v_test_col_id BIGINT;
    DECLARE v_gross DECIMAL(10, 2);

    -- Demonstrates SAVEPOINT and deliberate ROLLBACK
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_outcome_message = 'TRANSACTION ROLLED BACK: Exception encountered, system state perfectly preserved.';
    END;

    START TRANSACTION;

    -- Pick first farmer for demo
    SELECT farmer_id INTO v_test_farmer_id FROM farmers LIMIT 1;

    -- Step 1: Make a temporary collection entry
    INSERT INTO milk_collections (
        farmer_id, centre_id, collection_date, session, milk_type_id,
        quantity_litres, fat_percentage, snf_percentage, quality_status,
        rate_chart_id, rate_per_litre, gross_amount, incentive_amount,
        deduction_amount, net_payable_amount, payment_status,
        collected_by_user_id
    ) VALUES (
        v_test_farmer_id, 1, '2026-10-25', 'EVENING', 1,
        15.50, 4.20, 8.60, 'ACCEPTED',
        1, 42.00, 651.00, 0.00,
        0.00, 651.00, 'PENDING',
        1
    );
    SET v_test_col_id = LAST_INSERT_ID();

    -- Set Savepoint
    SAVEPOINT sp_collection_recorded;

    IF p_simulate_failure = TRUE THEN
        -- Force a failure (divide by zero or invalid constraint)
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Simulated Hardware/Network Failure during payment batch step.';
    END IF;

    COMMIT;
    SET p_outcome_message = 'TRANSACTION COMMITTED: All records written cleanly with ACID guarantees.';
END$$

DELIMITER ;

SELECT 'Views, Triggers, and Stored Procedures Successfully Created!' AS status;
