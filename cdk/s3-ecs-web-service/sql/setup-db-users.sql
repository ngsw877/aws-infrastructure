/* ユーザー作成セクション */

-- readonly_userユーザーを作成
CREATE USER readonly_user WITH PASSWORD 'ここにSecrets Managerから取得したパスワード';
-- データベースに接続できるようにする
GRANT CONNECT ON DATABASE "sample_app" TO readonly_user;
-- readonly_userユーザーに読み取り権限を付与
GRANT pg_read_all_data TO readonly_user;

-- readwrite_userユーザーを作成
CREATE USER readwrite_user WITH PASSWORD 'ここにSecrets Managerから取得したパスワード';
-- データベースに接続できるようにする
GRANT CONNECT ON DATABASE "sample_app" TO readwrite_user;
-- readwrite_userユーザーに読み取り権限と書き込み権限を付与
GRANT pg_read_all_data, pg_write_all_data TO readwrite_user;


/* ユーザー削除セクション */

-- readonly_userの権限を剥奪し、ユーザーを削除
REVOKE CONNECT ON DATABASE sample_app FROM readonly_user;
DROP USER readonly_user;

-- readwrite_userの権限を剥奪し、ユーザーを削除
REVOKE CONNECT ON DATABASE sample_app FROM readwrite_user;
DROP USER readwrite_user;

-- 現在のユーザー一覧を表示（デバッグ用）
SELECT usename FROM pg_user;