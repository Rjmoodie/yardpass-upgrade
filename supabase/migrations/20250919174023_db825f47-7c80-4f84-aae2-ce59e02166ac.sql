-- Allow users to insert recipients for their own messaging jobs
CREATE POLICY "insert_recipients_for_my_job" ON message_job_recipients
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM message_jobs j 
    WHERE j.id = message_job_recipients.job_id 
    AND (j.created_by = auth.uid() OR is_event_manager(j.event_id))
  )
);

-- Allow service role to update recipient status (for the messaging queue function)
CREATE POLICY "service_update_recipients" ON message_job_recipients
FOR UPDATE 
USING (true)
WITH CHECK (true);