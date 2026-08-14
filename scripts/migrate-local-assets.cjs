require("dotenv").config({ path: ".env.local" });
const mysql = require("mysql2/promise");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const apply = process.argv.includes("--apply");
const sourceRoot = path.resolve(process.env.UPLOAD_STORAGE_ROOT || path.join(process.cwd(), "server", "uploads"));
const publicRoot = path.resolve(process.cwd(), "public");
const nextcloudRoot = process.env.NEXTCLOUD_SYNC_ENABLED === "true" && process.env.NEXTCLOUD_MOUNT_PATH ? path.resolve(process.env.NEXTCLOUD_MOUNT_PATH) : null;
const months = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const compact = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 80) || "cliente";
const slug = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "post";
const format = (value) => ({ story: "story", carousel: "carousel", reel: "reel" }[String(value).toLowerCase()] || "feed");
const safeResolve = (root, relative) => { const target = path.resolve(root, String(relative).replace(/\\/g, "/")); const rel = path.relative(root, target); if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("PATH_OUTSIDE_ROOT"); return target; };
async function checksum(file) { const hash = crypto.createHash("sha256"); const handle = await fs.open(file, "r"); try { for await (const chunk of handle.createReadStream()) hash.update(chunk); } finally { await handle.close(); } return hash.digest("hex"); }

async function main() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: "utf8mb4" });
  const report = { mode: apply ? "apply" : "dry-run", startedAt: new Date().toISOString(), sourceRoot, migrated: [], missing: [], corrupt: [], skipped: [] };
  try {
    const [assets] = await db.query(`SELECT a.*,p.date,p.type,COALESCE(NULLIF(p.title,''),NULLIF(p.head,''),NULLIF(p.centralIdea,''),'post') postTitle,c.name clientName,
      (SELECT COUNT(*) FROM posts p2 WHERE p2.clientId=p.clientId AND YEAR(p2.date)=YEAR(p.date) AND MONTH(p2.date)=MONTH(p.date) AND (p2.date<p.date OR (p2.date=p.date AND p2.id<=p.id))) postNumber
      FROM media_assets a JOIN posts p ON a.ownerType='post' AND CAST(p.id AS CHAR)=a.ownerId JOIN clients c ON c.id=p.clientId WHERE a.status='active' ORDER BY p.date,p.id,a.createdAt,a.id`);
    const backup = { createdAt: new Date().toISOString(), assets };
    const carousel = new Map();
    for (const asset of assets) {
      const oldRelative = String(asset.localPath || asset.storageKey || "").replace(/\\/g, "/");
      if (!oldRelative) { report.missing.push({ assetId: asset.id, reason: "no-local-path" }); continue; }
      const sourceBase = asset.storageProvider === "nextcloud-mount" && nextcloudRoot ? nextcloudRoot : asset.visibility === "public" && oldRelative.startsWith("posts/") ? publicRoot : sourceRoot;
      const source = safeResolve(sourceBase, oldRelative);
      let stat; try { stat = await fs.stat(source); } catch { report.missing.push({ assetId: asset.id, path: source }); continue; }
      const actualHash = await checksum(source);
      if ((asset.sha256 || asset.checksum) && String(asset.sha256 || asset.checksum) !== actualHash) { report.corrupt.push({ assetId: asset.id, expected: asset.sha256 || asset.checksum, actual: actualHash }); continue; }
      const date = new Date(asset.date); const month = `${months[date.getMonth()]} DE ${date.getFullYear()}`;
      const ext = path.extname(asset.originalName || source).slice(1).toLowerCase().replace(/[^a-z0-9]/g, "") || path.extname(source).slice(1).toLowerCase();
      const count = (carousel.get(String(asset.ownerId)) || 0) + 1; carousel.set(String(asset.ownerId), count);
      const item = format(asset.type) === "carousel" ? `--item-${String(count).padStart(2, "0")}` : "";
      const document = asset.category === "post_document" || asset.category === "document";
      const fileName = `${String(asset.postNumber || 1).padStart(2, "0")}-${slug(asset.postTitle)}${item}--${asset.id}.${ext}`;
      const logicalPath = ["posts", compact(asset.clientName), month, format(asset.type), ...(document ? ["documents"] : []), fileName].join("/");
      const visibility = document ? "protected" : "public";
      const targetRoot = nextcloudRoot || (visibility === "public" ? publicRoot : sourceRoot);
      const target = safeResolve(targetRoot, logicalPath);
      if (!apply) { report.migrated.push({ assetId: asset.id, from: source, to: target, verified: true }); continue; }
      await fs.mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.migrating-${crypto.randomBytes(6).toString("hex")}`;
      await fs.copyFile(source, temporary);
      const copiedHash = await checksum(temporary); const copiedStat = await fs.stat(temporary);
      if (copiedHash !== actualHash || copiedStat.size !== stat.size) { await fs.unlink(temporary).catch(() => {}); report.corrupt.push({ assetId: asset.id, reason: "copy-verification-failed" }); continue; }
      await fs.rename(temporary, target);
      const stableUrl = `/api/media/assets/${asset.id}/content`;
      await db.beginTransaction();
      try {
        const nextcloudState = process.env.NEXTCLOUD_SYNC_ENABLED === "true" ? "pending" : "waiting_configuration";
        await db.execute(`UPDATE media_assets SET storageProvider=?,storageKey=?,localPath=?,logicalPath=?,visibility=?,publicUrl=?,checksum=?,sha256=?,sizeBytes=?,relocationState='current',nextcloudState=? WHERE id=?`, [nextcloudRoot ? 'nextcloud-mount' : 'local', logicalPath, logicalPath, logicalPath, visibility, stableUrl, actualHash, actualHash, stat.size, nextcloudState, asset.id]);
        if (asset.publicUrl) await db.execute(`UPDATE posts SET feedImages=REPLACE(COALESCE(feedImages,''),?,?),storyImage=REPLACE(COALESCE(storyImage,''),?,?),coverImage=REPLACE(COALESCE(coverImage,''),?,?),linkedinCover=REPLACE(COALESCE(linkedinCover,''),?,?),videoUrl=REPLACE(COALESCE(videoUrl,''),?,?) WHERE id=?`, [asset.publicUrl,stableUrl,asset.publicUrl,stableUrl,asset.publicUrl,stableUrl,asset.publicUrl,stableUrl,asset.publicUrl,stableUrl,asset.ownerId]);
        await db.commit();
      } catch (error) { await db.rollback(); await fs.unlink(target).catch(() => {}); throw error; }
      const [refs] = await db.query("SELECT 1 FROM media_assets WHERE id<>? AND status='active' AND (localPath=? OR storageKey=?) LIMIT 1", [asset.id, oldRelative, oldRelative]);
      if (!refs.length && source !== target) await fs.unlink(source).catch(() => {});
      report.migrated.push({ assetId: asset.id, from: source, to: target, checksum: actualHash, sizeBytes: stat.size });
    }
    await fs.mkdir(path.join(process.cwd(), "artifacts"), { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(path.join(process.cwd(), "artifacts", `local-assets-backup-${stamp}.json`), JSON.stringify(backup, null, 2));
    const reportPath = path.join(process.cwd(), "artifacts", `local-assets-migration-${stamp}.json`);
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ reportPath, mode: report.mode, migrated: report.migrated.length, missing: report.missing.length, corrupt: report.corrupt.length }, null, 2));
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
