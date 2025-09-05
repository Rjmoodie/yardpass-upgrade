-- Enable RLS on the materialized view and restrict access
ALTER TABLE event_video_kpis_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_kpis_select_manager" ON event_video_kpis_daily
  FOR SELECT USING (is_event_manager(event_id));