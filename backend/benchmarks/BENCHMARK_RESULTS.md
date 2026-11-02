# Database Performance & Indexing Evaluation Report

**Dataset Size**: 20,302 rows in `milk_collections` table
**RDBMS**: MySQL Server 8.0 (InnoDB Storage Engine)
**Evaluation Date**: 2026-10-29T15:04:28.966Z

## Summary Comparison Table

| Benchmark Query | Index Applied | Rows Examined (Before) | Rows Examined (After) | Cost (Before) | Cost (After) | Execution Time (Unindexed) | Execution Time (Indexed) | Speedup (%) |
|---|---|---|---|---|---|---|---|---|
| **Query 1: Farmer-wise Collection History** | `idx_col_farmer_date (farmer_id, collection_date)` | 20,302 | 383 | 2586.27 | 172.61 | **27.38 ms** | **6.26 ms** | **+77.1%** |
| **Query 2: Date & Session-wise Aggregation** | `idx_col_date_session (collection_date, session)` | 20,302 | 4 | 2055.85 | 5.95 | **60.90 ms** | **1.52 ms** | **+97.5%** |
| **Query 3: Centre-wise Periodic Milk Intake** | `idx_col_centre_date (centre_id, collection_date)` | 20,302 | 3 | 1397.06 | 441.71 | **15.17 ms** | **7.50 ms** | **+50.6%** |
| **Query 4: High-Fat Quality Incentive Analysis** | `idx_col_quality (milk_type_id, fat_percentage, snf_percentage)` | 20,156 | 3,766 | 2055.85 | 1694.96 | **24.75 ms** | **9.03 ms** | **+63.5%** |
| **Query 5: Unsettled Payment Ledger Scanning** | `idx_col_payment_status (payment_status, collection_date)` | 20,302 | 10 | 10.61 | 10.61 | **1.61 ms** | **1.43 ms** | **+11.0%** |

## Detailed Query Execution Plans (EXPLAIN ANALYZE)

### Query 1: Farmer-wise Collection History
*Lookup collection history for a specific farmer over a 6-month interval*

**Index Used**: `idx_col_farmer_date (farmer_id, collection_date)` | **Row Reduction Factor**: 53.0x

#### Unindexed Execution Plan (Full Table Scan):
```text
-> Sort: milk_collections.collection_date DESC  (cost=2056 rows=20156) (actual time=21.4..21.5 rows=383 loops=1)
    -> Filter: ((milk_collections.farmer_id = 1) and (milk_collections.collection_date between '2025-06-01' and '2025-12-31'))  (cost=2056 rows=20156) (actual time=0.257..21.1 rows=383 loops=1)
        -> Table scan on milk_collections  (cost=2056 rows=20156) (actual time=0.207..18.6 rows=20302 loops=1)
```

#### Indexed Execution Plan (Index Lookup / Range Scan):
```text
-> Index range scan on milk_collections using uq_farmer_session_date over (farmer_id = 1 AND '2025-06-01' <= collection_date <= '2025-12-31') (reverse), with index condition: ((milk_collections.farmer_id = 1) and (milk_collections.collection_date between '2025-06-01' and '2025-12-31'))  (cost=173 rows=383) (actual time=0.215..1.64 rows=383 loops=1)
```

---

### Query 2: Date & Session-wise Aggregation
*Aggregate intake volume and weighted quality for morning collection across all centres*

**Index Used**: `idx_col_date_session (collection_date, session)` | **Row Reduction Factor**: 5075.5x

#### Unindexed Execution Plan (Full Table Scan):
```text
-> Group aggregate: count(0), sum(milk_collections.quantity_litres), avg(milk_collections.fat_percentage), avg(milk_collections.snf_percentage), sum(milk_collections.net_payable_amount)  (cost=130476 rows=4) (actual time=27.4..64.2 rows=4 loops=1)
    -> Filter: ((milk_collections.`session` = 'MORNING') and (milk_collections.collection_date = DATE'2025-08-15'))  (cost=130375 rows=1008) (actual time=9.65..64.2 rows=17 loops=1)
        -> Index scan on milk_collections using idx_col_centre_date  (cost=130375 rows=20156) (actual time=0.371..58.6 rows=20302 loops=1)
```

#### Indexed Execution Plan (Index Lookup / Range Scan):
```text
-> Table scan on <temporary>  (actual time=0.218..0.219 rows=4 loops=1)
    -> Aggregate using temporary table  (actual time=0.216..0.216 rows=4 loops=1)
        -> Index lookup on milk_collections using idx_col_date_session (collection_date=DATE'2025-08-15', session='MORNING'), with index condition: (milk_collections.`session` = 'MORNING')  (cost=5.95 rows=17) (actual time=0.0729..0.148 rows=17 loops=1)
```

---

### Query 3: Centre-wise Periodic Milk Intake
*Aggregate milk throughput for a specific centre over a 90-day seasonal quarter*

**Index Used**: `idx_col_centre_date (centre_id, collection_date)` | **Row Reduction Factor**: 6767.3x

#### Unindexed Execution Plan (Full Table Scan):
```text
-> Table scan on <temporary>  (actual time=13.7..13.7 rows=3 loops=1)
    -> Aggregate using temporary table  (actual time=13.7..13.7 rows=3 loops=1)
        -> Filter: (milk_collections.centre_id = 1)  (cost=1397 rows=776) (actual time=0.527..11.7 rows=981 loops=1)
            -> Index range scan on milk_collections using idx_col_date_session over ('2025-07-01' <= collection_date <= '2025-09-30'), with index condition: (milk_collections.collection_date between '2025-07-01' and '2025-09-30')  (cost=1397 rows=3104) (actual time=0.521..11.4 rows=3104 loops=1)
```

#### Indexed Execution Plan (Index Lookup / Range Scan):
```text
-> Table scan on <temporary>  (actual time=5.35..5.35 rows=3 loops=1)
    -> Aggregate using temporary table  (actual time=5.35..5.35 rows=3 loops=1)
        -> Index range scan on milk_collections using idx_col_centre_date over (centre_id = 1 AND '2025-07-01' <= collection_date <= '2025-09-30'), with index condition: ((milk_collections.centre_id = 1) and (milk_collections.collection_date between '2025-07-01' and '2025-09-30'))  (cost=442 rows=981) (actual time=0.409..3.58 rows=981 loops=1)
```

---

### Query 4: High-Fat Quality Incentive Analysis
*Filter high-grade milk lots meeting super-premium fat and SNF benchmarks*

**Index Used**: `idx_col_quality (milk_type_id, fat_percentage, snf_percentage)` | **Row Reduction Factor**: 5.4x

#### Unindexed Execution Plan (Full Table Scan):
```text
-> Filter: ((milk_collections.milk_type_id = 1) and (milk_collections.fat_percentage >= 4.20) and (milk_collections.snf_percentage >= 8.80))  (cost=2056 rows=1120) (actual time=0.135..22.8 rows=1313 loops=1)
    -> Table scan on milk_collections  (cost=2056 rows=20156) (actual time=0.123..19 rows=20302 loops=1)
```

#### Indexed Execution Plan (Index Lookup / Range Scan):
```text
-> Index range scan on milk_collections using idx_col_quality over (milk_type_id = 1 AND 4.20 <= fat_percentage AND 8.80 <= snf_percentage), with index condition: ((milk_collections.milk_type_id = 1) and (milk_collections.fat_percentage >= 4.20) and (milk_collections.snf_percentage >= 8.80))  (cost=1695 rows=3766) (actual time=0.551..5.87 rows=1313 loops=1)
```

---

### Query 5: Unsettled Payment Ledger Scanning
*Find pending unbilled collection records within billing cycle*

**Index Used**: `idx_col_payment_status (payment_status, collection_date)` | **Row Reduction Factor**: 2030.2x

#### Unindexed Execution Plan (Full Table Scan):
```text
-> Table scan on <temporary>  (actual time=0.176..0.177 rows=10 loops=1)
    -> Aggregate using temporary table  (actual time=0.175..0.175 rows=10 loops=1)
        -> Filter: (milk_collections.payment_status = 'PENDING')  (cost=10.6 rows=11.5) (actual time=0.0533..0.128 rows=23 loops=1)
            -> Index range scan on milk_collections using idx_col_date_session over ('2026-10-16' <= collection_date <= '2026-10-31'), with index condition: (milk_collections.collection_date between '2026-10-16' and '2026-10-31')  (cost=10.6 rows=23) (actual time=0.0497..0.117 rows=23 loops=1)
```

#### Indexed Execution Plan (Index Lookup / Range Scan):
```text
-> Table scan on <temporary>  (actual time=0.249..0.251 rows=10 loops=1)
    -> Aggregate using temporary table  (actual time=0.247..0.247 rows=10 loops=1)
        -> Filter: (milk_collections.payment_status = 'PENDING')  (cost=10.6 rows=11.5) (actual time=0.0893..0.184 rows=23 loops=1)
            -> Index range scan on milk_collections using idx_col_date_session over ('2026-10-16' <= collection_date <= '2026-10-31'), with index condition: (milk_collections.collection_date between '2026-10-16' and '2026-10-31')  (cost=10.6 rows=23) (actual time=0.0846..0.17 rows=23 loops=1)
```

---

