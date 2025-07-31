-- 作成されたビュー数を確認
SELECT COUNT(*) FROM information_schema.views 
WHERE table_schema = 'public'