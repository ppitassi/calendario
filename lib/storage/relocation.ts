import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getDbPool } from "../db";
import { buildPostAssetPath, canonicalAssetsRoot } from "./asset-paths";
import { localUploadsRoot } from "./core";

function rootFor(visibility: string) {
  if (process.env.NEXTCLOUD_SYNC_ENABLED === "true" && process.env.NEXTCLOUD_MOUNT_PATH) return canonicalAssetsRoot();
  return visibility === "public" ? canonicalAssetsRoot() : localUploadsRoot();
}

async function fileChecksum(file: string) {
  const hash = createHash("sha256");
  const handle = await fs.open(file, "r");
  try { for await (const chunk of handle.createReadStream()) hash.update(chunk); }
  finally { await handle.close(); }
  return hash.digest("hex");
}

export async function enqueueAssetRelocations(input: { clientId?: string; postId?: string }) {
  const [assetRows]: any = await getDbPool().query(
    `SELECT a.*,p.date,p.type,COALESCE(NULLIF(p.title,''),NULLIF(p.head,''),NULLIF(p.centralIdea,''),'post') postTitle,c.name clientName,
       (SELECT COUNT(*) FROM posts p2 WHERE p2.clientId=p.clientId AND YEAR(p2.date)=YEAR(p.date) AND MONTH(p2.date)=MONTH(p.date)
        AND (p2.date<p.date OR (p2.date=p.date AND p2.id<=p.id))) postNumber
     FROM media_assets a JOIN posts p ON a.ownerType='post' AND CAST(p.id AS CHAR)=a.ownerId
     JOIN clients c ON c.id=p.clientId
     WHERE a.status='active' AND (? IS NULL OR a.clientId=?) AND (? IS NULL OR a.ownerId=?)
     ORDER BY p.date,p.id,a.createdAt,a.id`,
    [input.clientId || null, input.clientId || null, input.postId || null, input.postId || null],
  );
  const carouselIndexes = new Map<string, number>();
  for (const asset of assetRows) {
    const index = (carouselIndexes.get(String(asset.ownerId)) || 0) + 1;
    carouselIndexes.set(String(asset.ownerId), index);
    const toPath = buildPostAssetPath({
      assetId: asset.id, clientName: asset.clientName, postDate: asset.date, postType: asset.type,
      postTitle: asset.postTitle, postOrder: asset.postNumber, originalName: asset.originalName,
      category: asset.category, itemIndex: index,
    });
    const fromPath = String(asset.logicalPath || asset.localPath || asset.storageKey || "").replace(/\\/g, "/");
    if (!fromPath || fromPath === toPath) continue;
    const revision = Number(asset.relocationRevision || 1) + 1;
    await getDbPool().execute(
      `INSERT INTO media_relocation_jobs(mediaAssetId,fromPath,toPath,revision,status,nextAttemptAt)
       VALUES(?,?,?,?, 'pending',NOW()) ON DUPLICATE KEY UPDATE toPath=VALUES(toPath),status='pending',nextAttemptAt=NOW()`,
      [asset.id, fromPath, toPath, revision],
    );
    await getDbPool().execute("UPDATE media_assets SET relocationState='pending' WHERE id=?", [asset.id]);
  }
  await processAssetRelocations();
}

export async function processAssetRelocations(limit = 100) {
  const [jobs]: any = await getDbPool().query(
    `SELECT j.*,a.visibility,a.checksum FROM media_relocation_jobs j JOIN media_assets a ON a.id=j.mediaAssetId
     WHERE j.status IN ('pending','failed') AND j.nextAttemptAt<=NOW() ORDER BY j.id LIMIT ?`, [limit],
  );
  for (const job of jobs) {
    const root = rootFor(job.visibility);
    const source = path.resolve(root, job.fromPath);
    const target = path.resolve(root, job.toPath);
    if ([source, target].some((value) => { const rel = path.relative(root, value); return rel.startsWith("..") || path.isAbsolute(rel); })) continue;
    try {
      let movedNow = false;
      await fs.mkdir(path.dirname(target), { recursive: true });
      const sourceExists = await fs.stat(source).then(() => true).catch(() => false);
      const targetExists = await fs.stat(target).then(() => true).catch(() => false);
      if (sourceExists) { await fs.rename(source, target); movedNow = true; }
      else if (!targetExists || await fileChecksum(target) !== job.checksum) throw new Error("MEDIA_RELOCATION_SOURCE_MISSING");
      const connection = await getDbPool().getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          `UPDATE media_assets SET logicalPath=?,localPath=?,storageKey=?,relocationRevision=?,relocationState='current',updatedAt=NOW() WHERE id=?`,
          [job.toPath, job.toPath, job.toPath, job.revision, job.mediaAssetId],
        );
        await connection.execute("UPDATE media_relocation_jobs SET status='completed',completedAt=NOW(),attempts=attempts+1 WHERE id=?", [job.id]);
        await connection.commit();
      } catch (error) { await connection.rollback(); if (movedNow) await fs.rename(target, source).catch(() => undefined); throw error; }
      finally { connection.release(); }
    } catch (error) {
      await getDbPool().execute(
        "UPDATE media_relocation_jobs SET status='failed',attempts=attempts+1,lastError=?,nextAttemptAt=DATE_ADD(NOW(),INTERVAL LEAST(60,POW(2,attempts)) MINUTE) WHERE id=?",
        [error instanceof Error ? error.message.slice(0, 500) : "Falha de realocacao", job.id],
      );
    }
  }
}
