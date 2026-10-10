-- Liveblocks comment reactions HOW (emoji → userIds on the comment row).
ALTER TABLE room_comment_thread_comments ADD COLUMN reactions_json TEXT NOT NULL DEFAULT '{}';
