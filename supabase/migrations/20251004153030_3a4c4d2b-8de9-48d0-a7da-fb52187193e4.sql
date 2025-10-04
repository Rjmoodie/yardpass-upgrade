-- Add reply_to column to message_jobs to support customizable Reply-To address from the composer
ALTER TABLE public.message_jobs
ADD COLUMN IF NOT EXISTS reply_to text;

-- Optional: comment for documentation
COMMENT ON COLUMN public.message_jobs.reply_to IS 'Optional Reply-To address used when sending emails for this job.';