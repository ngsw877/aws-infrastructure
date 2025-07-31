-- 顧客分析データの作成
SELECT 
    c.id as customer_id,
    COUNT(o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_amount,
    COALESCE(AVG(o.total_amount), 0) as avg_order_value,
    MAX(o.order_date) as last_order_date,
    c.region
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id 
    AND o.order_date >= %s AND o.order_date < %s + INTERVAL '1 day'
GROUP BY c.id, c.region