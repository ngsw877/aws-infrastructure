-- 商品売上サマリのUPSERT
INSERT INTO product_sales_summary (product_id, category, total_quantity, total_revenue, order_count, date)
VALUES %s
ON CONFLICT (product_id, date) 
DO UPDATE SET
    category = EXCLUDED.category,
    total_quantity = EXCLUDED.total_quantity,
    total_revenue = EXCLUDED.total_revenue,
    order_count = EXCLUDED.order_count,
    updated_at = CURRENT_TIMESTAMP