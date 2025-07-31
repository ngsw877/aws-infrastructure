-- 顧客分析データのUPSERT
INSERT INTO customer_analytics (customer_id, total_orders, total_amount, avg_order_value, last_order_date, region)
VALUES %s
ON CONFLICT (customer_id) 
DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_amount = EXCLUDED.total_amount,
    avg_order_value = EXCLUDED.avg_order_value,
    last_order_date = EXCLUDED.last_order_date,
    region = EXCLUDED.region,
    updated_at = CURRENT_TIMESTAMP