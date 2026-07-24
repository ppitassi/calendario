require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

const origin = 'http://127.0.0.1:3006';
const runId = crypto.randomBytes(5).toString('hex');
const tenantId = 'layout_test_' + runId;
const userId1 = 'layout_user1_' + runId;
const userId2 = 'layout_user2_' + runId;
const password = 'TestPassword123!';

async function request(path, options = {}, cookie = '') {
  const response = await fetch(origin + path, { ...options, headers: { ...(options.headers || {}), ...(cookie ? { cookie } : {}) } });
  const contentType = response.headers.get('content-type') || '';
  const value = contentType.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { response, value };
}

async function main() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const results = {};
  try {
    await db.execute('INSERT INTO agencies (id, name) VALUES (?, ?)', [tenantId, 'Layout Test Agency']);
    await db.execute('INSERT INTO users (uid, email, displayName, role, tenant_id, password) VALUES (?, ?, ?, ?, ?, ?)', [userId1, userId1 + '@invalid.test', 'Layout User 1', 'designer', tenantId, await bcrypt.hash(password, 10)]);
    await db.execute('INSERT INTO users (uid, email, displayName, role, tenant_id, password) VALUES (?, ?, ?, ?, ?, ?)', [userId2, userId2 + '@invalid.test', 'Layout User 2', 'admin', tenantId, await bcrypt.hash(password, 10)]);

    await db.execute("DELETE FROM rate_limits WHERE bucket_key LIKE 'login%'").catch(() => {});
    // Login user 1 (designer)
    const login1 = await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: userId1 + '@invalid.test', password }) });
    if (!login1.response.ok) { console.log('LOGIN1 ERR:', login1.response.status, login1.value); throw new Error('LOGIN1_FAILED'); }
    const cookie1 = (login1.response.headers.get('set-cookie') || '').split(';')[0];

    // Login user 2 (admin)
    const login2 = await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: userId2 + '@invalid.test', password }) });
    if (!login2.response.ok) throw new Error('LOGIN2_FAILED');
    const cookie2 = (login2.response.headers.get('set-cookie') || '').split(';')[0];

    // 1. GET /api/dashboard/layout (initial)
    const initialGet = await request('/api/dashboard/layout', {}, cookie1);
    results.initialGetOk = initialGet.response.ok && initialGet.value.layoutVersion === 1;

    // 2. PUT /api/dashboard/layout (save new layout)
    const payload1 = {
      layoutJson: [
        { id: 'my_work', size: 'wide' },
        { id: 'deadlines', size: 'compact' },
        { id: 'recent_activity', size: 'medium' }
      ]
    };
    const putRes1 = await request('/api/dashboard/layout', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload1) }, cookie1);
    results.saveOk = putRes1.response.ok && putRes1.value.layoutVersion === 1 && putRes1.value.layoutJson.length === 3;

    // 3. Confirm persistence in MySQL table user_dashboard_layouts
    const [dbRows] = await db.execute('SELECT tenantId, userId, layoutVersion, layoutJson FROM user_dashboard_layouts WHERE tenantId = ? AND userId = ?', [tenantId, userId1]);
    results.mysqlPersistenceOk = dbRows.length === 1 && dbRows[0].layoutVersion === 1;

    // 4. Test Optimistic Locking (HTTP 409)
    // Save layout again from user 1 -> version becomes 2
    const putRes2 = await request('/api/dashboard/layout', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layoutJson: payload1.layoutJson, expectedLayoutVersion: 1 }) }, cookie1);
    results.versionUpdateOk = putRes2.response.ok && putRes2.value.layoutVersion === 2;

    // Now attempt to save with outdated version (expectedLayoutVersion: 1 when current DB version is 2)
    const conflictRes = await request('/api/dashboard/layout', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layoutJson: payload1.layoutJson, expectedLayoutVersion: 1 }) }, cookie1);
    results.conflict409Ok = conflictRes.response.status === 409 && conflictRes.value.code === 'LAYOUT_VERSION_CONFLICT';

    // 5. Test User Isolation (User 2 has separate layout)
    const user2Get = await request('/api/dashboard/layout', {}, cookie2);
    results.userIsolationOk = user2Get.response.ok && user2Get.value.layoutJson === null;

    // 6. Test Unpermitted Widget Rejection (User without canViewProductionGallery capability trying to add production_bi)
    const userId3 = 'layout_user3_' + runId;
    await db.execute('INSERT INTO custom_roles (id, permissions, tenant_id) VALUES (?, ?, ?)', ['no_pipeline', JSON.stringify({ canViewProductionGallery: false }), tenantId]);
    await db.execute('INSERT INTO users (uid, email, displayName, role, tenant_id, password) VALUES (?, ?, ?, ?, ?, ?)', [userId3, userId3 + '@invalid.test', 'Layout User 3', 'no_pipeline', tenantId, await bcrypt.hash(password, 10)]);
    const login3 = await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: userId3 + '@invalid.test', password }) });
    const cookie3 = (login3.response.headers.get('set-cookie') || '').split(';')[0];
    const unpermittedPut = await request('/api/dashboard/layout', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layoutJson: [{ id: 'production_bi', size: 'wide' }, { id: 'my_work', size: 'medium' }] }) }, cookie3);
    results.unpermittedStrippedOk = unpermittedPut.response.ok && !unpermittedPut.value.layoutJson.some(x => x.id === 'production_bi');

    // 7. Test DELETE /api/dashboard/layout
    const delRes = await request('/api/dashboard/layout', { method: 'DELETE' }, cookie1);
    results.deleteOk = delRes.response.ok;
    const postDelGet = await request('/api/dashboard/layout', {}, cookie1);
    results.postDeleteOk = postDelGet.response.ok && postDelGet.value.layoutJson === null;

    console.log(JSON.stringify(results));
  } finally {
    await db.execute('DELETE FROM user_dashboard_layouts WHERE tenantId = ?', [tenantId]).catch(() => {});
    await db.execute('DELETE FROM custom_roles WHERE tenant_id = ?', [tenantId]).catch(() => {});
    await db.execute('DELETE FROM users WHERE tenant_id = ?', [tenantId]).catch(() => {});
    await db.execute('DELETE FROM agencies WHERE id = ?', [tenantId]).catch(() => {});
    await db.end();
  }
}

main().catch(error => { console.error(error.message || 'TEST_FAILED'); process.exit(1); });
