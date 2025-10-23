// mux_webhook_handler.ts
import express, { Request, Response } from "express";
import crypto from "crypto";
import { Pool } from "pg";

const app = express();
app.use(express.json({ type: ["application/json", "application/*+json"] }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function verifyMuxSignature(rawBody: string, signatureHeader: string | undefined, signingSecret: string) {
  if (!signatureHeader || !signingSecret) return false;
  const parts = (signatureHeader as string).split(",").map(s => s.trim());
  const t = parts.find(p => p.startsWith("t="))?.split("=")[1];
  const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];
  if (!t || !v1) return false;
  const payload = `${t}.${rawBody}`;
  const digest = crypto.createHmac("sha256", signingSecret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(digest));
}

app.post("/webhooks/mux", async (req: Request, res: Response) => {
  const raw = JSON.stringify(req.body);
  const ok = verifyMuxSignature(raw, req.headers["mux-signature"] as string, process.env.MUX_WEBHOOK_SECRET || "");
  if (!ok) return res.status(400).send("bad signature");

  const evt = req.body?.type;
  const data = req.body?.data || {};

  try {
    if (evt === "video.asset.ready") {
      const mux_asset_id = data?.id;
      const playback_ids = data?.playback_ids || [];
      const mux_playback_id = playback_ids[0]?.id || null;
      const passthrough = data?.passthrough || null; // set this to media_assets.id when creating the asset

      if (passthrough) {
        await pool.query(
          `UPDATE public.media_assets
             SET status = 'ready',
                 mux_asset_id = $2,
                 mux_playback_id = COALESCE($3, mux_playback_id),
                 updated_at = now()
           WHERE id = $1`,
          [passthrough, mux_asset_id, mux_playback_id]
        );
      } else if (mux_asset_id) {
        await pool.query(
          `UPDATE public.media_assets
             SET status = 'ready',
                 mux_playback_id = COALESCE($2, mux_playback_id),
                 updated_at = now()
           WHERE mux_asset_id = $1`,
          [mux_asset_id, mux_playback_id]
        );
      }
    }

    if (evt === "video.asset.errored" || evt === "video.asset.deleted") {
      const mux_asset_id = data?.id;
      if (mux_asset_id) {
        await pool.query(
          `UPDATE public.media_assets SET status = 'failed', updated_at = now() WHERE mux_asset_id = $1`,
          [mux_asset_id]
        );
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

export default app;
