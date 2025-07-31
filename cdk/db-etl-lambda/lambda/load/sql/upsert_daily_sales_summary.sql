-- 日次売上サマリのUPSERT
INSERT INTO daily_sales_summary (date, total_orders, total_revenue, unique_customers, region)
VALUES %s
ON CONFLICT (date, region) 
DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_revenue = EXCLUDED.total_revenue,
    unique_customers = EXCLUDED.unique_customers,
    updated_at = CURRENT_TIMESTAMP