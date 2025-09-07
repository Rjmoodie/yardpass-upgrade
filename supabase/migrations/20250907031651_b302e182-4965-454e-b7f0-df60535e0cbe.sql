-- Update existing events to be in the future so tickets show as upcoming
UPDATE events 
SET start_at = '2025-12-31 20:00:00+00',
    end_at = '2025-12-31 23:00:00+00'
WHERE id = '4f550d2f-c810-4268-90e0-4b632341b036';