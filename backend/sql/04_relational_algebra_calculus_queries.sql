-- =====================================================================
-- DAIRY COLLECTION AND FARMER PAYMENT MANAGEMENT SYSTEM
-- Formal Query Formulations: Relational Algebra, Calculus, and SQL
-- Database: dairy_db
-- =====================================================================

USE dairy_db;

-- =====================================================================
-- QUERY 1: Farmers whose monthly milk quantity is above the centre average
-- =====================================================================
/*
[Relational Algebra]:
  TempFarmerSum(farmer_id, centre_id, total_qty) <-
      _{farmer_id, centre_id} G _{SUM(quantity_litres)} (
          \sigma_{collection_date \ge '2026-10-01' \land collection_date \le '2026-10-31'} (milk_collections)
      )
  TempCentreAvg(centre_id, avg_centre_qty) <-
      _{centre_id} G _{AVG(total_qty)} (TempFarmerSum)
  Result <- \pi_{farmer_id, first_name, last_name, centre_name, total_qty, avg_centre_qty} (
      TempFarmerSum \bowtie TempCentreAvg \bowtie farmers \bowtie collection_centres
      \sigma_{total_qty > avg_centre_qty}
  )

[Tuple Relational Calculus (TRC)]:
  { t | \exists f \in farmers, \exists c \in collection_centres (
      t.farmer_id = f.farmer_id \land t.farmer_name = f.first_name \land t.centre_name = c.centre_name \land
      \exists s ( s = \sum_{m \in milk_collections, m.farmer_id = f.farmer_id \land Month(m.collection_date)=10} m.quantity_litres \land
          s > ( \text{AVG}_{f2 \in farmers, f2.assigned_centre_id = c.centre_id} (
                  \sum_{m2 \in milk_collections, m2.farmer_id = f2.farmer_id \land Month(m2.collection_date)=10} m2.quantity_litres
              )
          ) \land t.total_qty = s
      )
  )}
*/
-- [SQL Implementation]:
SELECT
    f.farmer_id,
    f.farmer_code,
    CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
    cc.centre_name,
    ROUND(fq.monthly_total_litres, 2) AS farmer_monthly_litres,
    ROUND(ca.centre_avg_monthly_litres, 2) AS centre_avg_monthly_litres,
    ROUND(fq.monthly_total_litres - ca.centre_avg_monthly_litres, 2) AS excess_litres
FROM (
    -- Farmer monthly totals
    SELECT
        mc.farmer_id,
        mc.centre_id,
        SUM(mc.quantity_litres) AS monthly_total_litres
    FROM milk_collections mc
    WHERE mc.collection_date BETWEEN '2026-10-01' AND '2026-10-31'
    GROUP BY mc.farmer_id, mc.centre_id
) fq
JOIN (
    -- Centre average of monthly totals per farmer
    SELECT
        sub.centre_id,
        AVG(sub.monthly_total_litres) AS centre_avg_monthly_litres
    FROM (
        SELECT
            farmer_id,
            centre_id,
            SUM(quantity_litres) AS monthly_total_litres
        FROM milk_collections
        WHERE collection_date BETWEEN '2026-10-01' AND '2026-10-31'
        GROUP BY farmer_id, centre_id
    ) sub
    GROUP BY sub.centre_id
) ca ON fq.centre_id = ca.centre_id
JOIN farmers f ON fq.farmer_id = f.farmer_id
JOIN collection_centres cc ON fq.centre_id = cc.centre_id
WHERE fq.monthly_total_litres > ca.centre_avg_monthly_litres
ORDER BY fq.monthly_total_litres DESC;

-- =====================================================================
-- QUERY 2: Collection centres showing a decline in milk collection over consecutive periods
-- =====================================================================
/*
[Relational Algebra]:
  PeriodVolume(centre_id, period_id, vol) <-
      _{centre_id, period_id} G _{SUM(quantity_litres)} (
          milk_collections \bowtie farmer_payments
      )
  LaggedVolume(centre_id, period_id, curr_vol, prev_vol) <-
      Window_{centre_id ORDER BY period_id} (LAG(vol)) (PeriodVolume)
  Result <- \pi_{centre_id, centre_name, curr_vol, prev_vol, curr_vol - prev_vol} (
      \sigma_{curr_vol < prev_vol} (LaggedVolume \bowtie collection_centres)
  )
*/
-- [SQL Implementation using Window Function LAG]:
WITH PeriodCollections AS (
    SELECT
        cc.centre_id,
        cc.centre_code,
        cc.centre_name,
        DATE_FORMAT(mc.collection_date, '%Y-%m') AS collection_month,
        SUM(mc.quantity_litres) AS total_monthly_volume
    FROM milk_collections mc
    JOIN collection_centres cc ON mc.centre_id = cc.centre_id
    GROUP BY cc.centre_id, cc.centre_code, cc.centre_name, DATE_FORMAT(mc.collection_date, '%Y-%m')
),
TrendAnalysis AS (
    SELECT
        centre_id,
        centre_code,
        centre_name,
        collection_month,
        total_monthly_volume,
        LAG(total_monthly_volume, 1) OVER (
            PARTITION BY centre_id
            ORDER BY collection_month
        ) AS previous_month_volume
    FROM PeriodCollections
)
SELECT
    centre_code,
    centre_name,
    collection_month AS current_month,
    ROUND(total_monthly_volume, 2) AS current_month_volume,
    ROUND(previous_month_volume, 2) AS previous_month_volume,
    ROUND(total_monthly_volume - previous_month_volume, 2) AS decline_litres,
    ROUND(((total_monthly_volume - previous_month_volume) / previous_month_volume) * 100, 2) AS percentage_change
FROM TrendAnalysis
WHERE previous_month_volume IS NOT NULL
  AND total_monthly_volume < previous_month_volume
ORDER BY decline_litres ASC;

-- =====================================================================
-- QUERY 3: Calculate payment due to each farmer for a selected payment period
-- =====================================================================
/*
[Relational Algebra]:
  FarmerSupplies <- \sigma_{collection_date \ge '2026-10-16' \land collection_date \le '2026-10-31'} (milk_collections)
  AggSupplies(farmer_id, total_qty, gross, inc) <-
      _{farmer_id} G _{SUM(quantity_litres), SUM(gross_amount), SUM(incentive_amount)} (FarmerSupplies)
  ActiveDeductions(farmer_id, total_ded) <-
      _{farmer_id} G _{SUM(balance_amount)} (\sigma_{status='ACTIVE'} (farmer_deductions_master))
  Result <- \pi_{farmer_id, farmer_name, total_qty, gross, inc, total_ded, (gross + inc - total_ded)} (
      farmers \leftouterjoin AggSupplies \leftouterjoin ActiveDeductions
  )
*/
-- [SQL Implementation]:
SELECT
    f.farmer_id,
    f.farmer_code,
    CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
    f.bank_name,
    f.bank_account_number,
    f.ifsc_code,
    COUNT(mc.collection_id) AS total_deliveries,
    ROUND(SUM(mc.quantity_litres), 2) AS total_quantity_litres,
    ROUND(SUM(mc.quantity_litres * mc.fat_percentage) / SUM(mc.quantity_litres), 2) AS weighted_avg_fat,
    ROUND(SUM(mc.quantity_litres * mc.snf_percentage) / SUM(mc.quantity_litres), 2) AS weighted_avg_snf,
    ROUND(SUM(mc.gross_amount), 2) AS gross_earnings,
    ROUND(SUM(mc.incentive_amount), 2) AS total_incentives,
    IFNULL(ROUND(d.recoverable_deductions, 2), 0.00) AS pending_deductions,
    ROUND((SUM(mc.gross_amount) + SUM(mc.incentive_amount)) - IFNULL(d.recoverable_deductions, 0.00), 2) AS estimated_net_payable
FROM farmers f
JOIN milk_collections mc ON f.farmer_id = mc.farmer_id
LEFT JOIN (
    SELECT
        farmer_id,
        SUM(LEAST(balance_amount, IFNULL(max_deduction_per_period, balance_amount))) AS recoverable_deductions
    FROM farmer_deductions_master
    WHERE status = 'ACTIVE' AND balance_amount > 0
    GROUP BY farmer_id
) d ON f.farmer_id = d.farmer_id
WHERE mc.collection_date BETWEEN '2026-10-16' AND '2026-10-31'
GROUP BY f.farmer_id, f.farmer_code, f.first_name, f.last_name, f.bank_name, f.bank_account_number, f.ifsc_code, d.recoverable_deductions
ORDER BY gross_earnings DESC;

-- =====================================================================
-- QUERY 4: Farmers whose average fat percentage exceeds a specified value (e.g., Fat > 4.0% for Cow or > 6.8% for Buffalo)
-- =====================================================================
/*
[Relational Algebra]:
  QualitySupplies(farmer_id, milk_type_id, weighted_fat, total_litres) <-
      _{farmer_id, milk_type_id} G _{SUM(quantity_litres * fat_percentage)/SUM(quantity_litres), SUM(quantity_litres)} (
          milk_collections
      )
  Result <- \pi_{farmer_id, farmer_name, type_name, weighted_fat, total_litres} (
      \sigma_{weighted_fat > 4.00} (QualitySupplies \bowtie farmers \bowtie milk_types)
  )
*/
-- [SQL Implementation]:
SELECT
    f.farmer_id,
    f.farmer_code,
    CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
    mt.type_name AS milk_type,
    cc.centre_name,
    ROUND(SUM(mc.quantity_litres), 2) AS total_milk_litres,
    ROUND(SUM(mc.quantity_litres * mc.fat_percentage) / SUM(mc.quantity_litres), 2) AS weighted_avg_fat,
    ROUND(SUM(mc.quantity_litres * mc.snf_percentage) / SUM(mc.quantity_litres), 2) AS weighted_avg_snf,
    COUNT(mc.collection_id) AS delivery_count
FROM farmers f
JOIN milk_collections mc ON f.farmer_id = mc.farmer_id
JOIN milk_types mt ON mc.milk_type_id = mt.milk_type_id
JOIN collection_centres cc ON mc.centre_id = cc.centre_id
GROUP BY f.farmer_id, f.farmer_code, f.first_name, f.last_name, mt.type_name, cc.centre_name
HAVING (mt.type_name = 'COW' AND weighted_avg_fat >= 3.90)
    OR (mt.type_name = 'BUFFALO' AND weighted_avg_fat >= 6.80)
ORDER BY weighted_avg_fat DESC;

-- =====================================================================
-- QUERY 5: Relational Division: Farmers who supplied milk in EVERY collection session during a given date span
-- =====================================================================
/*
[Relational Division in Relational Algebra]:
  AllSessions <- \pi_{collection_date, session} (
      \sigma_{collection_date \ge '2026-10-16' \land collection_date \le '2026-10-18'} (milk_collections)
  )
  FarmerSessions <- \pi_{farmer_id, collection_date, session} (
      \sigma_{collection_date \ge '2026-10-16' \land collection_date \le '2026-10-18'} (milk_collections)
  )
  Result <- FarmerSessions \div AllSessions \bowtie farmers

[Domain Relational Calculus (DRC)]:
  { <f_id, name> | \exists f \in farmers ( f.farmer_id = f_id \land f.name = name \land
      \forall <d, s> \in AllSessions (
          \exists m \in milk_collections (
              m.farmer_id = f_id \land m.collection_date = d \land m.session = s
          )
      )
  )}
*/
-- [SQL Implementation using Relational Division via COUNT]:
SELECT
    f.farmer_id,
    f.farmer_code,
    CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
    f.phone,
    cc.centre_name,
    COUNT(DISTINCT CONCAT(mc.collection_date, '-', mc.session)) AS sessions_attended,
    target.total_expected_sessions
FROM farmers f
JOIN milk_collections mc ON f.farmer_id = mc.farmer_id
JOIN collection_centres cc ON f.assigned_centre_id = cc.centre_id
CROSS JOIN (
    -- Count of total unique sessions that occurred in the 3-day window
    SELECT COUNT(DISTINCT CONCAT(collection_date, '-', session)) AS total_expected_sessions
    FROM milk_collections
    WHERE collection_date BETWEEN '2026-10-16' AND '2026-10-18'
) target
WHERE mc.collection_date BETWEEN '2026-10-16' AND '2026-10-18'
GROUP BY f.farmer_id, f.farmer_code, f.first_name, f.last_name, f.phone, cc.centre_name, target.total_expected_sessions
HAVING sessions_attended = target.total_expected_sessions;

-- =====================================================================
-- QUERY 6: Determine the highest milk supplier at each collection centre (Correlated Subquery & Window Partition)
-- =====================================================================
/*
[Relational Algebra]:
  CentreFarmerVol(centre_id, farmer_id, vol) <-
      _{centre_id, farmer_id} G _{SUM(quantity_litres)} (milk_collections)
  RankedSuppliers <- Window_{centre_id ORDER BY vol DESC} (DENSE_RANK()) (CentreFarmerVol)
  Result <- \pi_{centre_id, centre_name, farmer_id, farmer_name, vol} (
      \sigma_{rank = 1} (RankedSuppliers \bowtie collection_centres \bowtie farmers)
  )
*/
-- [SQL Implementation]:
WITH CentreFarmerTotals AS (
    SELECT
        mc.centre_id,
        mc.farmer_id,
        SUM(mc.quantity_litres) AS total_quantity,
        SUM(mc.net_payable_amount) AS total_revenue
    FROM milk_collections mc
    GROUP BY mc.centre_id, mc.farmer_id
),
RankedSuppliers AS (
    SELECT
        cft.*,
        DENSE_RANK() OVER (
            PARTITION BY cft.centre_id
            ORDER BY cft.total_quantity DESC
        ) AS supplier_rank
    FROM CentreFarmerTotals cft
)
SELECT
    cc.centre_code,
    cc.centre_name,
    f.farmer_code,
    CONCAT(f.first_name, ' ', f.last_name) AS highest_supplying_farmer,
    f.phone,
    ROUND(rs.total_quantity, 2) AS total_supplied_litres,
    ROUND(rs.total_revenue, 2) AS total_earnings_inr
FROM RankedSuppliers rs
JOIN collection_centres cc ON rs.centre_id = cc.centre_id
JOIN farmers f ON rs.farmer_id = f.farmer_id
WHERE rs.supplier_rank = 1
ORDER BY rs.total_quantity DESC;

-- =====================================================================
-- QUERY 7: Farmers with unpaid or partially paid dues and outstanding deductions
-- =====================================================================
SELECT
    f.farmer_id,
    f.farmer_code,
    CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
    f.phone,
    v.village_name,
    fdm.deduction_type,
    ROUND(fdm.total_amount, 2) AS original_loan_amount,
    ROUND(fdm.recovered_amount, 2) AS recovered_amount,
    ROUND(fdm.balance_amount, 2) AS outstanding_balance,
    fdm.status AS loan_status,
    IFNULL(ROUND(unpaid_milk.unbilled_milk_value, 2), 0.00) AS pending_milk_collection_credit
FROM farmers f
JOIN villages v ON f.village_id = v.village_id
JOIN farmer_deductions_master fdm ON f.farmer_id = fdm.farmer_id
LEFT JOIN (
    SELECT
        farmer_id,
        SUM(net_payable_amount) AS unbilled_milk_value
    FROM milk_collections
    WHERE payment_status = 'PENDING'
    GROUP BY farmer_id
) unpaid_milk ON f.farmer_id = unpaid_milk.farmer_id
WHERE fdm.balance_amount > 0
ORDER BY fdm.balance_amount DESC;

-- =====================================================================
-- QUERY 8: Compare Morning vs Evening milk collection metrics across centres
-- =====================================================================
SELECT
    cc.centre_name,
    ROUND(SUM(CASE WHEN mc.session = 'MORNING' THEN mc.quantity_litres ELSE 0 END), 2) AS morning_litres,
    ROUND(SUM(CASE WHEN mc.session = 'EVENING' THEN mc.quantity_litres ELSE 0 END), 2) AS evening_litres,
    ROUND(
        SUM(CASE WHEN mc.session = 'MORNING' THEN mc.quantity_litres * mc.fat_percentage ELSE 0 END) /
        NULLIF(SUM(CASE WHEN mc.session = 'MORNING' THEN mc.quantity_litres ELSE 0 END), 0),
        2
    ) AS morning_avg_fat,
    ROUND(
        SUM(CASE WHEN mc.session = 'EVENING' THEN mc.quantity_litres * mc.fat_percentage ELSE 0 END) /
        NULLIF(SUM(CASE WHEN mc.session = 'EVENING' THEN mc.quantity_litres ELSE 0 END), 0),
        2
    ) AS evening_avg_fat,
    ROUND(SUM(CASE WHEN mc.session = 'MORNING' THEN mc.net_payable_amount ELSE 0 END), 2) AS morning_payout,
    ROUND(SUM(CASE WHEN mc.session = 'EVENING' THEN mc.net_payable_amount ELSE 0 END), 2) AS evening_payout,
    ROUND(SUM(mc.quantity_litres), 2) AS combined_litres
FROM milk_collections mc
JOIN collection_centres cc ON mc.centre_id = cc.centre_id
GROUP BY cc.centre_id, cc.centre_name
ORDER BY combined_litres DESC;

-- =====================================================================
-- QUERY 9: Collection centres with highest average milk quality (Fat & SNF Index)
-- =====================================================================
SELECT
    cc.centre_id,
    cc.centre_code,
    cc.centre_name,
    COUNT(mc.collection_id) AS total_samples_tested,
    ROUND(SUM(mc.quantity_litres), 2) AS total_milk_handled,
    ROUND(SUM(mc.quantity_litres * mc.fat_percentage) / SUM(mc.quantity_litres), 2) AS centre_weighted_fat,
    ROUND(SUM(mc.quantity_litres * mc.snf_percentage) / SUM(mc.quantity_litres), 2) AS centre_weighted_snf,
    -- Composite Quality Score = (Fat * 0.6) + (SNF * 0.4)
    ROUND(
        ((SUM(mc.quantity_litres * mc.fat_percentage) / SUM(mc.quantity_litres)) * 0.60) +
        ((SUM(mc.quantity_litres * mc.snf_percentage) / SUM(mc.quantity_litres)) * 0.40),
        2
    ) AS composite_quality_index
FROM milk_collections mc
JOIN collection_centres cc ON mc.centre_id = cc.centre_id
GROUP BY cc.centre_id, cc.centre_code, cc.centre_name
ORDER BY composite_quality_index DESC;

-- =====================================================================
-- QUERY 10: Farmer-wise Year-to-Date Payment and Deduction Summary
-- =====================================================================
SELECT
    f.farmer_id,
    f.farmer_code,
    CONCAT(f.first_name, ' ', f.last_name) AS farmer_name,
    f.bank_name,
    f.bank_account_number,
    COUNT(DISTINCT fp.payment_id) AS completed_payment_cycles,
    IFNULL(ROUND(SUM(fp.total_quantity_litres), 2), 0.00) AS ytd_milk_supplied_litres,
    IFNULL(ROUND(SUM(fp.gross_amount), 2), 0.00) AS ytd_gross_earnings,
    IFNULL(ROUND(SUM(fp.total_incentives), 2), 0.00) AS ytd_quality_incentives,
    IFNULL(ROUND(SUM(fp.total_deductions), 2), 0.00) AS ytd_input_deductions,
    IFNULL(ROUND(SUM(fp.amount_paid), 2), 0.00) AS ytd_net_disbursed_inr
FROM farmers f
LEFT JOIN farmer_payments fp ON f.farmer_id = fp.farmer_id AND fp.payment_status = 'APPROVED'
GROUP BY f.farmer_id, f.farmer_code, f.first_name, f.last_name, f.bank_name, f.bank_account_number
ORDER BY ytd_net_disbursed_inr DESC;
