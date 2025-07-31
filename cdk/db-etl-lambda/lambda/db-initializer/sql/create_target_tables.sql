-- 顧客分析テーブル（集約データ）
CREATE TABLE IF NOT EXISTS customer_analytics (
    customer_id INTEGER PRIMARY KEY,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    avg_order_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    last_order_date DATE,
    region VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 商品売上サマリテーブル（日別集約）
CREATE TABLE IF NOT EXISTS product_sales_summary (
    product_id INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, date)
);

-- 日次売上サマリテーブル（地域別集約）
CREATE TABLE IF NOT EXISTS daily_sales_summary (
    date DATE NOT NULL,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    unique_customers INTEGER NOT NULL DEFAULT 0,
    region VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, region)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_customer_analytics_region ON customer_analytics(region);
CREATE INDEX IF NOT EXISTS idx_customer_analytics_total_amount ON customer_analytics(total_amount DESC);
CREATE INDEX IF NOT EXISTS idx_product_sales_summary_date ON product_sales_summary(date);
CREATE INDEX IF NOT EXISTS idx_product_sales_summary_category ON product_sales_summary(category);
CREATE INDEX IF NOT EXISTS idx_product_sales_summary_revenue ON product_sales_summary(total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_date ON daily_sales_summary(date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_region ON daily_sales_summary(region);