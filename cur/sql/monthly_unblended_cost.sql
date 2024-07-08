-- *******************************************
-- * 月額の非ブレンドコストを取得する
-- *******************************************

-- 年月をフォーマットする場合
SELECT
	DATE_FORMAT(bill_billing_period_start_date, '%Y年%m月') AS year_month,
	SUM(line_item_unblended_cost) AS total_cost
FROM
	${table_name}
GROUP BY
	bill_billing_period_start_date
ORDER BY
	year_month DESC;

-- 年月をフォーマットしない場合
SELECT
	DATE_TRUNC('month', bill_billing_period_start_date) AS year_month,
	SUM(line_item_unblended_cost) AS total_cost
FROM
	${table_name}
GROUP BY
	bill_billing_period_start_date
ORDER BY
	year_month DESC;
