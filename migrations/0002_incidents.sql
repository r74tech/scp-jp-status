-- Migration number: 0002 	 2026-10-11T14:38:23.771Z
-- 閉じたインシデントの永久保存用。状態JSON（uptimeflareテーブル）は直近90日分だけを持つ
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id TEXT NOT NULL,
    start INTEGER NOT NULL,           -- 開始時刻（UNIX秒）
    end INTEGER NOT NULL,             -- 終了時刻（UNIX秒）
    errors TEXT NOT NULL,             -- エラーの経過。[[UNIX秒, エラー文], ...] のJSON
    source TEXT NOT NULL,             -- 'cron'（このWorkerが記録）または 'upptime'（旧wikidotupptimeのissue）
    ref TEXT,                         -- 出所のURL（upptimeならissue）
    UNIQUE (monitor_id, start)
);

CREATE INDEX IF NOT EXISTS incidents_start ON incidents (start);
