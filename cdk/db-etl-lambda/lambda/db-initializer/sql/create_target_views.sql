-- 顧客ランキングビュー
CREATE OR REPLACE VIEW top_customers AS
SELECT 
    customer_id,
    total_orders,
    total_amount,
    avg_order_value,
    region,
    RANK() OVER (ORDER BY total_amount DESC) as revenue_rank,
    RANK() OVER (ORDER BY total_orders DESC) as order_rank
FROM customer_analytics
WHERE total_orders > 0;

-- 商品カテゴリ別売上ビュー
CREATE OR REPLACE VIEW category_performance AS
SELECT 
    category,
    SUM(total_quantity) as total_quantity_sold,
    SUM(total_revenue) as total_category_revenue,
    SUM(order_count) as total_orders,
    AVG(total_revenue / NULLIF(total_quantity, 0)) as avg_price_per_unit,
    COUNT(DISTINCT product_id) as product_count
FROM product_sales_summary
GROUP BY category
ORDER BY total_category_revenue DESC;

-- 地域別売上トレンドビュー
CREATE OR REPLACE VIEW regional_sales_trend AS
SELECT 
    region,
    date,
    total_orders,
    total_revenue,
    unique_customers,
    total_revenue / NULLIF(total_orders, 0) as avg_order_value,
    total_orders::float / NULLIF(unique_customers, 0) as orders_per_customer
FROM daily_sales_summary
ORDER BY region, date;

-- 週次売上サマリビュー
CREATE OR REPLACE VIEW weekly_sales_summary AS
SELECT 
    DATE_TRUNC('week', date) as week_start,
    SUM(total_orders) as weekly_orders,
    SUM(total_revenue) as weekly_revenue,
    SUM(unique_customers) as weekly_unique_customers,
    COUNT(DISTINCT region) as active_regions
FROM daily_sales_summary
GROUP BY DATE_TRUNC('week', date)
ORDER BY week_start;

-- 月次売上サマリビュー
CREATE OR REPLACE VIEW monthly_sales_summary AS
SELECT 
    DATE_TRUNC('month', date) as month_start,
    SUM(total_orders) as monthly_orders,
    SUM(total_revenue) as monthly_revenue,
    SUM(unique_customers) as monthly_unique_customers,
    AVG(total_revenue / NULLIF(total_orders, 0)) as avg_monthly_order_value
FROM daily_sales_summary
GROUP BY DATE_TRUNC('month', date)
ORDER BY month_start;