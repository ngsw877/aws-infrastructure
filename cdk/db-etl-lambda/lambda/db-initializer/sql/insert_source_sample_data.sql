-- 顧客データ
INSERT INTO customers (name, email, region) VALUES
('田中太郎', 'tanaka@example.com', '東京'),
('佐藤花子', 'sato@example.com', '大阪'),
('鈴木一郎', 'suzuki@example.com', '東京'),
('高橋美穂', 'takahashi@example.com', '福岡'),
('山田健太', 'yamada@example.com', '大阪')
ON CONFLICT (email) DO NOTHING;

-- 商品データ
INSERT INTO products (name, category, price) VALUES
('ノートパソコン', 'Electronics', 89800.00),
('ワイヤレスマウス', 'Electronics', 2980.00),
('デスクチェア', 'Furniture', 15800.00),
('コーヒーメーカー', 'Appliance', 12800.00),
('本棚', 'Furniture', 8900.00),
('スマートフォン', 'Electronics', 78000.00),
('テーブルランプ', 'Furniture', 4500.00),
('Bluetoothスピーカー', 'Electronics', 6800.00);

-- 過去30日分の注文データ
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE - INTERVAL '1 day',
        '1 day'::interval
    )::date AS order_date
),
sample_orders AS (
    SELECT 
        (random() * 4 + 1)::int as customer_id,
        order_date,
        CASE 
            WHEN random() < 0.8 THEN 'completed'
            WHEN random() < 0.95 THEN 'shipped'
            ELSE 'pending'
        END as status
    FROM date_series
    CROSS JOIN generate_series(1, (random() * 3 + 1)::int)
)
INSERT INTO orders (customer_id, order_date, status, total_amount)
SELECT 
    customer_id,
    order_date,
    status,
    (random() * 50000 + 5000)::decimal(10,2) as total_amount
FROM sample_orders;

-- 注文明細データ
WITH order_product_pairs AS (
    SELECT 
        o.id as order_id,
        (random() * 8 + 1)::int as product_id,
        (random() * 3 + 1)::int as quantity
    FROM orders o
    CROSS JOIN generate_series(1, (random() * 2 + 1)::int)
)
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT 
    opp.order_id,
    opp.product_id,
    opp.quantity,
    p.price
FROM order_product_pairs opp
JOIN products p ON p.id = opp.product_id;