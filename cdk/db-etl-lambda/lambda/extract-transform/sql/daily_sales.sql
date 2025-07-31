-- 日次売上サマリの作成
SELECT 
    %s as date,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_revenue,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    c.region
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.order_date >= %s AND o.order_date < %s + INTERVAL '1 day'
GROUP BY c.region