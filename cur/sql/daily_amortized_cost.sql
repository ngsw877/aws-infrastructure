-- *******************************************
-- * 日額の償却コストを取得する
-- *******************************************

-- 全てのリソースの日額償却コスト
SELECT
	DATE_FORMAT(DATE_TRUNC('day', line_item_usage_start_date), '%Y年%m月%d日') AS usage_date,
	SUM(
		CASE
			WHEN line_item_line_item_type = 'SavingsPlanCoveredUsage' THEN savings_plan_savings_plan_effective_cost
			WHEN line_item_line_item_type = 'SavingsPlanRecurringFee' THEN (savings_plan_total_commitment_to_date - savings_plan_used_commitment)
			WHEN line_item_line_item_type = 'SavingsPlanNegation' THEN 0
			WHEN line_item_line_item_type = 'SavingsPlanUpfrontFee' THEN 0
			WHEN line_item_line_item_type = 'DiscountedUsage' THEN reservation_effective_cost
			WHEN line_item_line_item_type = 'RIFee' THEN (reservation_unused_amortized_upfront_fee_for_billing_period + reservation_unused_recurring_fee)
			WHEN (line_item_line_item_type = 'Fee' AND reservation_reservation_a_r_n <> '') THEN 0
			ELSE line_item_unblended_cost
			END
	) AS daily_amortized_cost
FROM
	${table_name}
WHERE
	line_item_usage_start_date >= DATE('2024-05-01')
	AND line_item_usage_start_date < DATE('2024-07-01')
GROUP BY
	DATE_TRUNC('day', line_item_usage_start_date)
ORDER BY
	DATE_TRUNC('day', line_item_usage_start_date) DESC;


-- 特定のリソースの日額償却コスト
SELECT
	DATE_FORMAT(DATE_TRUNC('day', line_item_usage_start_date), '%Y年%m月%d日') AS usage_date,
	line_item_resource_id,
	line_item_product_code,
	SUM(
		CASE
			WHEN line_item_line_item_type = 'SavingsPlanCoveredUsage' THEN savings_plan_savings_plan_effective_cost
			WHEN line_item_line_item_type = 'SavingsPlanRecurringFee' THEN (savings_plan_total_commitment_to_date - savings_plan_used_commitment)
			WHEN line_item_line_item_type = 'SavingsPlanNegation' THEN 0
			WHEN line_item_line_item_type = 'SavingsPlanUpfrontFee' THEN 0
			WHEN line_item_line_item_type = 'DiscountedUsage' THEN reservation_effective_cost
			WHEN line_item_line_item_type = 'RIFee' THEN (reservation_unused_amortized_upfront_fee_for_billing_period + reservation_unused_recurring_fee)
			WHEN (line_item_line_item_type = 'Fee' AND reservation_reservation_a_r_n <> '') THEN 0
			ELSE line_item_unblended_cost
			END
	) AS daily_amortized_cost
FROM
	${table_name}
WHERE
-- 	${resource_id}にリソース名を指定する
	line_item_resource_id LIKE '%${resource_id}%'
		AND line_item_usage_start_date >= DATE('2024-06-01')
		AND line_item_usage_start_date < DATE('2024-07-01')
GROUP BY
	DATE_TRUNC('day', line_item_usage_start_date),
	line_item_resource_id,
	line_item_product_code
ORDER BY
	DATE_TRUNC('day', line_item_usage_start_date) DESC;

-- CloudFormationのスタックに含まれるリソース毎の日額償却コスト
--  ※ ECS on EC2の場合はEC2インスタンスに課金される
--  ※ ALB等、明示的にリソース名を指定しない場合ARNに文字数の関係でスタック名省略されてが入らない場合があるので注意
SELECT
	DATE_FORMAT(DATE_TRUNC('day', line_item_usage_start_date), '%Y年%m月%d日') AS usage_date,
	line_item_resource_id,
	line_item_product_code,
	line_item_usage_type,
	SUM(
			CASE
				WHEN line_item_line_item_type = 'SavingsPlanCoveredUsage' THEN savings_plan_savings_plan_effective_cost
				WHEN line_item_line_item_type = 'SavingsPlanRecurringFee' THEN (savings_plan_total_commitment_to_date - savings_plan_used_commitment)
				WHEN line_item_line_item_type = 'SavingsPlanNegation' THEN 0
				WHEN line_item_line_item_type = 'SavingsPlanUpfrontFee' THEN 0
				WHEN line_item_line_item_type = 'DiscountedUsage' THEN reservation_effective_cost
				WHEN line_item_line_item_type = 'RIFee' THEN (reservation_unused_amortized_upfront_fee_for_billing_period + reservation_unused_recurring_fee)
				WHEN (line_item_line_item_type = 'Fee' AND reservation_reservation_a_r_n <> '') THEN 0
				ELSE line_item_unblended_cost
				END
	) AS daily_amortized_cost
FROM
	${table_name}
WHERE
-- 	${stack_name}にCFnスタック名を指定する
	line_item_resource_id LIKE '%${stack_name}%'
		AND line_item_usage_start_date >= DATE('2024-06-01')
		AND line_item_usage_start_date < DATE('2024-07-01')
GROUP BY
	DATE_TRUNC('day', line_item_usage_start_date),
	line_item_resource_id,
	line_item_product_code,
	line_item_usage_type
ORDER BY
	DATE_TRUNC('day', line_item_usage_start_date) DESC;

