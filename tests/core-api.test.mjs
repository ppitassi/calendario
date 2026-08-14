import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

const base = "http://127.0.0.1:3016/api";
async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/health/db`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Servidor não iniciou");
}
async function request(path, options = {}, cookie = "") {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(
      `${options.method || "GET"} ${path} returned ${response.status} without JSON: ${responseText.slice(0, 300)}`,
    );
  }
  return {
    response,
    payload,
    cookie:
      response.headers.getSetCookie?.()[0]?.split(";", 1)[0] ||
      response.headers.get("set-cookie")?.split(";", 1)[0] ||
      cookie,
  };
}

test("auth and universal work item hierarchy", async () => {
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port=3016"],
    { stdio: "ignore" },
  );
  try {
    await waitForServer();
    const login = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@contentplanner.local",
        password: process.env.ADMIN_INITIAL_PASSWORD || "ChangeMe!2026",
      }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.success, true);
    assert.match(login.cookie, /cp_session=/);
    const roles = await request("/custom-roles", {}, login.cookie);
    assert.equal(roles.response.status, 200);
    assert.ok(
      roles.payload.some(
        (role) => role.key === "ADMIN" && Array.isArray(role.permissions),
      ),
    );
    const create = async (type, title, parentId) =>
      request(
        "/work-items",
        { method: "POST", body: JSON.stringify({ type, title, parentId }) },
        login.cookie,
      );
    const project = await create("PROJECT", "Projeto de teste");
    assert.equal(project.response.status, 201);
    const demand = await create(
      "DEMAND",
      "Demanda de teste",
      project.payload.id,
    );
    assert.equal(demand.response.status, 201);
    const task = await create("TASK", "Tarefa de teste", demand.payload.id);
    assert.equal(task.response.status, 201);
    const invalid = await request(
      `/work-items/${project.payload.id}/move`,
      { method: "POST", body: JSON.stringify({ parentId: task.payload.id }) },
      login.cookie,
    );
    assert.equal(invalid.response.status, 422);
    const standalone = await create("TASK", "Tarefa avulsa");
    assert.equal(standalone.response.status, 201);
    const moved = await request(
      `/work-items/${standalone.payload.id}/move`,
      { method: "POST", body: JSON.stringify({ parentId: demand.payload.id }) },
      login.cookie,
    );
    assert.equal(moved.response.status, 200);
    const detail = await request(
      `/work-items/${standalone.payload.id}`,
      {},
      login.cookie,
    );
    assert.equal(detail.payload.parent_id, demand.payload.id);
    const clientId = crypto.randomUUID();
    const client = await request(
      "/clients",
      {
        method: "POST",
        body: JSON.stringify({ id: clientId, name: "Cliente Teste" }),
      },
      login.cookie,
    );
    assert.equal(client.response.status, 200);
    const member = await request(
      `/clients/${clientId}/members`,
      {
        method: "POST",
        body: JSON.stringify({
          userId: login.payload.user.uid,
          role: "SOCIAL_MEDIA",
          isPrimary: true,
        }),
      },
      login.cookie,
    );
    assert.equal(member.response.status, 201);
    const contact = await request(
      `/clients/${clientId}/contacts`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "Contato Teste",
          email: "contato@example.com",
          isPrimary: true,
        }),
      },
      login.cookie,
    );
    assert.equal(contact.response.status, 201);
    const contacts = await request(
      `/clients/${clientId}/contacts`,
      {},
      login.cookie,
    );
    assert.equal(contacts.response.status, 200);
    assert.ok(
      contacts.payload.some(
        (entry) => entry.id === contact.payload.id && entry.isPrimary,
      ),
    );
    const contentTask = await request(
      "/work-items",
      {
        method: "POST",
        body: JSON.stringify({
          type: "TASK",
          title: "Reel de teste",
          clientId,
        }),
      },
      login.cookie,
    );
    assert.equal(contentTask.response.status, 201);
    const content = await request(
      `/work-items/${contentTask.payload.id}/content`,
      {
        method: "PUT",
        body: JSON.stringify({
          head: "Título",
          caption: "Legenda",
          channel: "INSTAGRAM",
          format: "REEL",
        }),
      },
      login.cookie,
    );
    assert.equal(content.response.status, 200);
    assert.equal(content.payload.version, 1);
    const approval = await request(
      `/work-items/${contentTask.payload.id}/approvals`,
      {
        method: "POST",
        body: JSON.stringify({
          contentVersionId: content.payload.versionId,
          steps: [
            { name: "Revisão interna", approverUserId: login.payload.user.uid },
          ],
        }),
      },
      login.cookie,
    );
    assert.equal(approval.response.status, 201);
    assert.equal(approval.payload.stepIds.length, 1);
    const approvalDecision = await request(
      `/work-items/${contentTask.payload.id}/approvals/decision`,
      {
        method: "POST",
        body: JSON.stringify({
          stepId: approval.payload.stepIds[0],
          decision: "APPROVED",
          comment: "Aprovado no teste",
        }),
      },
      login.cookie,
    );
    assert.equal(approvalDecision.response.status, 200);
    assert.equal(approvalDecision.payload.flowStatus, "APPROVED");
    const approvalDetail = await request(
      `/work-items/${contentTask.payload.id}/approvals`,
      {},
      login.cookie,
    );
    assert.equal(approvalDetail.response.status, 200);
    assert.equal(
      approvalDetail.payload[0].steps[0].decisions[0].decision,
      "APPROVED",
    );
    const photo = await request(
      `/work-items/${demand.payload.id}/photo-job`,
      {
        method: "PUT",
        body: JSON.stringify({
          capturedCount: 1238,
          selectedCount: 186,
          targetEditCount: 186,
          editedCount: 143,
          exportedCount: 120,
          deliveredCount: 0,
        }),
      },
      login.cookie,
    );
    assert.equal(photo.response.status, 200);
    assert.equal(photo.payload.progress, 77);
    const external = await request(
      `/work-items/${demand.payload.id}/external-operation`,
      {
        method: "PUT",
        body: JSON.stringify({ operationType: "CAPTURE", title: "Captação" }),
      },
      login.cookie,
    );
    assert.equal(external.response.status, 200);
    for (const status of [
      "READY",
      "DEPARTED",
      "IN_TRANSIT",
      "ARRIVED",
      "IN_PROGRESS",
    ]) {
      const transition = await request(
        `/work-items/${demand.payload.id}/external-operation/transition`,
        { method: "POST", body: JSON.stringify({ status }) },
        login.cookie,
      );
      assert.equal(transition.response.status, 200);
    }
    const blocker = await request(
      `/work-items/${demand.payload.id}/external-operation/plan-items`,
      {
        method: "POST",
        body: JSON.stringify({
          title: "Conferir cartões",
          required: true,
          blocking: true,
          category: "POST_OPERATION",
        }),
      },
      login.cookie,
    );
    assert.equal(blocker.response.status, 201);
    for (const status of ["FINISHING", "RETURNING"]) {
      const transition = await request(
        `/work-items/${demand.payload.id}/external-operation/transition`,
        { method: "POST", body: JSON.stringify({ status }) },
        login.cookie,
      );
      assert.equal(transition.response.status, 200);
    }
    const blockedFinish = await request(
      `/work-items/${demand.payload.id}/external-operation/transition`,
      { method: "POST", body: JSON.stringify({ status: "COMPLETED" }) },
      login.cookie,
    );
    assert.equal(blockedFinish.response.status, 409);
    const check = await request(
      `/work-items/${demand.payload.id}/external-operation/plan-items`,
      {
        method: "PATCH",
        body: JSON.stringify({ id: blocker.payload.id, completed: true }),
      },
      login.cookie,
    );
    assert.equal(check.response.status, 200);
    const finished = await request(
      `/work-items/${demand.payload.id}/external-operation/transition`,
      { method: "POST", body: JSON.stringify({ status: "COMPLETED" }) },
      login.cookie,
    );
    assert.equal(finished.response.status, 200);
    const token = await request(
      `/work-items/${contentTask.payload.id}/approvals/public-token`,
      {
        method: "POST",
        body: JSON.stringify({
          clientId,
          contentVersionId: content.payload.versionId,
          approvalFlowId: approval.payload.id,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      },
      login.cookie,
    );
    assert.equal(token.response.status, 201);
    const publicReview = await request(`/public/review/${token.payload.token}`);
    assert.equal(publicReview.response.status, 200);
    assert.equal(publicReview.payload.client.id, clientId);
    const publicDecision = await request(
      `/public/review/${token.payload.token}/action`,
      {
        method: "POST",
        body: JSON.stringify({ action: "approve", note: "Cliente aprovou" }),
      },
    );
    assert.equal(publicDecision.response.status, 200);
    assert.equal(publicDecision.payload.status, "APPROVED");
    const editorial = await request(
      "/posts",
      {
        method: "POST",
        body: JSON.stringify({
          clientId,
          date: "2026-08-20",
          type: "reel",
          title: "Conteúdo editorial",
          head: "Head",
          caption: "Legenda",
          feedImages: [],
        }),
      },
      login.cookie,
    );
    assert.equal(editorial.response.status, 200);
    const calendar = await request(`/posts/${clientId}`, {}, login.cookie);
    assert.equal(calendar.response.status, 200);
    assert.ok(
      calendar.payload.some(
        (post) => post.id === editorial.payload.id && post.head === "Head",
      ),
    );
  } finally {
    server.kill();
  }
});
