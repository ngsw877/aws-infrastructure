-- 商品売上サマリの作成
SELECT 
    p.id as product_id,
    p.category,
    COALESCE(SUM(oi.quantity), 0) as total_quantity,
    COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_revenue,
    COUNT(DISTINCT o.id) as order_count,
    %s as date
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id 
    AND o.order_date >= %s AND o.order_date < %s + INTERVAL '1 day'
GROUP BY p.id, p.category