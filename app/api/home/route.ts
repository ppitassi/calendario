import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseMonthKey, monthLabel } from "@/lib/date";
import type { CalendarCycle } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedRole = searchParams.get("role") || user.role;
    const activeRole = user.role === "admin" ? requestedRole : user.role;

    const db = getDb();

    // 1. Determina o ciclo ativo (o ciclo mais recente cadastrado ou o mês atual)
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    let cycle = (await db
      .prepare("SELECT * FROM calendar_cycles WHERE month = ?")
      .get(currentMonthKey)) as CalendarCycle | undefined;

    if (!cycle) {
      cycle = (await db
        .prepare("SELECT * FROM calendar_cycles ORDER BY month DESC LIMIT 1")
        .get()) as CalendarCycle | undefined;
    }

    // Se ainda não existir nenhum ciclo cadastrado, cria um ciclo padrão provisório
    if (!cycle) {
      // Padrão: dia 09 do mês corrente
      const defaultDeadline = `${currentMonthKey}-09`;
      let mLabel = currentMonthKey;
      try {
        mLabel = monthLabel(parseMonthKey(currentMonthKey));
      } catch {}
      cycle = {
        id: "default-cycle",
        month: currentMonthKey,
        title: `Entrega dos Calendários de ${mLabel}`,
        global_deadline: defaultDeadline,
        notes: "Todos os designers devem concluir seus calendários até essa data.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const cycleMonth = cycle.month;
    const globalDeadline = cycle.global_deadline;

    // 2. Busca todos os calendários vinculados ao mês do ciclo ativo
    const calendarsQuery = `
      SELECT
        cal.id,
        cal.client_id,
        cal.title,
        cal.month,
        cal.status as cal_status,
        cal.brand,
        cal.accent,
        cal.owner_id as cal_owner_id,
        cal.executor_id,
        cal.assigned_to_id,
        c.name as client_name,
        c.logo_url as client_logo_url,
        COALESCE(executor.name, assigned.name, 'Não atribuído') as designer_name,
        COALESCE(cal.executor_id, cal.assigned_to_id) as designer_id,
        COALESCE(owner.name, creator.name, 'Admin') as owner_name,
        (SELECT COUNT(*) FROM calendar_items ci WHERE ci.calendar_id = cal.id AND (ci.deleted_at IS NULL)) as items_count,
        (SELECT COUNT(*) FROM calendar_items ci WHERE ci.calendar_id = cal.id AND ci.status = 'Aprovado' AND (ci.deleted_at IS NULL)) as approved_items_count
      FROM calendars cal
      INNER JOIN clients c ON c.id = cal.client_id
      LEFT JOIN users assigned ON assigned.id = cal.assigned_to_id
      LEFT JOIN users executor ON executor.id = cal.executor_id
      LEFT JOIN users owner ON owner.id = cal.owner_id
      LEFT JOIN users creator ON creator.id = cal.created_by_id
      WHERE cal.month = ? AND (cal.deleted_at IS NULL)
      ORDER BY c.name ASC
    `;

    const rawCalendars = (await db.prepare(calendarsQuery).all(cycleMonth)) as any[];

    // Calendários por Designer
    const calendarFollowUp = rawCalendars.map((cal) => {
      const isDelivered = cal.cal_status === "approved";
      return {
        id: cal.id,
        clientId: cal.client_id,
        clientName: cal.client_name || cal.brand,
        title: cal.title,
        month: cal.month,
        designerId: cal.designer_id,
        designerName: cal.designer_name,
        ownerName: cal.owner_name,
        status: cal.cal_status,
        isDelivered,
        itemsCount: cal.items_count,
        approvedItemsCount: cal.approved_items_count,
        progressPercent: cal.items_count > 0 ? Math.round((cal.approved_items_count / cal.items_count) * 100) : 0,
      };
    });

    const totalCalendars = calendarFollowUp.length;
    const deliveredCalendars = calendarFollowUp.filter((c) => c.isDelivered).length;
    const pendingCalendars = totalCalendars - deliveredCalendars;

    // Se o usuário for Designer (ou visualizando como Designer), filtra para seus calendários
    const designerCalendars =
      activeRole === "designer"
        ? calendarFollowUp.filter((c) => c.designerId === user.id)
        : calendarFollowUp;

    // 3. Bloco "Precisa de Atenção"
    // - Para Social Media: Copies pendentes (ideia/produção sem texto), ajustes solicitados (ressalvas), publicações sem responsável
    // - Para Designer: Artes com ajustes, tarefas atrasadas, demandas sem briefing
    const todayStr = today.toISOString().slice(0, 10);

    let attentionItems: Array<{
      id: string;
      title: string;
      clientName: string;
      reason: string;
      badgeType: "warning" | "danger" | "info";
      targetType: "calendar" | "workUnit" | "item";
      targetId: string;
      clientId: string;
      month: string;
    }> = [];

    let rawAttentionTasks: any[] = [];
    try {
      if (activeRole === "designer") {
        rawAttentionTasks = await db
          .prepare(
            `SELECT
               ci.id,
               ci.title,
               ci.date,
               ci.status,
               ci.calendar_id,
               c.name as client_name,
               c.id as client_id,
               cal.month
             FROM calendar_items ci
             INNER JOIN calendars cal ON cal.id = ci.calendar_id
             INNER JOIN clients c ON c.id = cal.client_id
             WHERE (ci.deleted_at IS NULL)
               AND (ci.assignee_id = ? OR (ci.assignee_id IS NULL AND cal.executor_id = ?))
               AND (
                 (ci.status = 'Revisão') OR
                 (ci.date < ? AND ci.status != 'Aprovado')
               )
             LIMIT 10`
          )
          .all(user.id, user.id, todayStr);

        rawAttentionTasks.forEach((t) => {
          const isOverdue = t.date < todayStr && t.status !== "Aprovado";
          attentionItems.push({
            id: t.id,
            title: t.title || "Arte sem título",
            clientName: t.client_name,
            reason: isOverdue ? "Arte atrasada" : "Ajuste solicitado",
            badgeType: isOverdue ? "danger" : "warning",
            targetType: "calendar",
            targetId: t.calendar_id,
            clientId: t.client_id,
            month: t.month,
          });
        });
      } else {
        // Social Media
        rawAttentionTasks = await db
          .prepare(
            `SELECT
               ci.id,
               ci.title,
               ci.date,
               ci.head,
               ci.status,
               ci.calendar_id,
               c.name as client_name,
               c.id as client_id,
               cal.month
             FROM calendar_items ci
             INNER JOIN calendars cal ON cal.id = ci.calendar_id
             INNER JOIN clients c ON c.id = cal.client_id
             WHERE (ci.deleted_at IS NULL)
               AND (
                 (ci.head = '' AND ci.status = 'Ideia') OR
                 (ci.status = 'Revisão')
               )
             LIMIT 10`
          )
          .all();

        rawAttentionTasks.forEach((t) => {
          const isMissingCopy = !t.head;
          attentionItems.push({
            id: t.id,
            title: t.title || "Publicação sem título",
            clientName: t.client_name,
            reason: isMissingCopy ? "Copywriting pendente" : "Revisão pendente",
            badgeType: isMissingCopy ? "warning" : "info",
            targetType: "calendar",
            targetId: t.calendar_id,
            clientId: t.client_id,
            month: t.month,
          });
        });
      }
    } catch {}

    // 4. Bloco "Meu Trabalho de Hoje"
    let todayWork: Array<{
      id: string;
      title: string;
      clientName: string;
      dueDate: string;
      status: string;
      type: string;
      actionLabel: string;
      calendarId: string;
      clientId: string;
      month: string;
      isAfterGlobalDeadline?: boolean;
    }> = [];

    try {
      const todayQuery = `
        SELECT
          ci.id,
          ci.title,
          ci.date,
          ci.status,
          ci.type,
          ci.head,
          ci.calendar_id,
          c.name as client_name,
          c.id as client_id,
          cal.month
        FROM calendar_items ci
        INNER JOIN calendars cal ON cal.id = ci.calendar_id
        INNER JOIN clients c ON c.id = cal.client_id
        WHERE (ci.deleted_at IS NULL)
          AND ci.date = ?
          ${
            activeRole === "designer"
              ? "AND (ci.assignee_id = ? OR (ci.assignee_id IS NULL AND cal.executor_id = ?))"
              : ""
          }
        ORDER BY ci.date ASC
        LIMIT 10
      `;

      const todayParams =
        activeRole === "designer" ? [todayStr, user.id, user.id] : [todayStr];
      const itemsToday = (await db.prepare(todayQuery).all(...todayParams)) as any[];

      todayWork = itemsToday.map((it) => {
        const isAfter = globalDeadline && it.date > globalDeadline;
        return {
          id: it.id,
          title: it.title || "Publicação",
          clientName: it.client_name,
          dueDate: "Hoje",
          status: it.status,
          type: it.type || "Feed",
          actionLabel:
            activeRole === "designer"
              ? it.status === "Produção"
                ? "Finalizar arte"
                : "Produzir arte"
              : !it.head
              ? "Escrever copy"
              : "Revisar copy",
          calendarId: it.calendar_id,
          clientId: it.client_id,
          month: it.month,
          isAfterGlobalDeadline: Boolean(isAfter),
        };
      });
    } catch {}

    // 5. Bloco "Próximos 7 Dias"
    const next7DaysEnd = new Date(today);
    next7DaysEnd.setDate(next7DaysEnd.getDate() + 7);
    const next7DaysEndStr = next7DaysEnd.toISOString().slice(0, 10);

    let next7DaysWork: Array<{
      date: string;
      dateFormatted: string;
      items: Array<{
        id: string;
        title: string;
        clientName: string;
        type: string;
        status: string;
        calendarId: string;
        clientId: string;
        month: string;
        isAfterGlobalDeadline?: boolean;
      }>;
    }> = [];

    try {
      const next7Query = `
        SELECT
          ci.id,
          ci.title,
          ci.date,
          ci.status,
          ci.type,
          ci.calendar_id,
          c.name as client_name,
          c.id as client_id,
          cal.month
        FROM calendar_items ci
        INNER JOIN calendars cal ON cal.id = ci.calendar_id
        INNER JOIN clients c ON c.id = cal.client_id
        WHERE (ci.deleted_at IS NULL)
          AND ci.date >= ? AND ci.date <= ?
          ${
            activeRole === "designer"
              ? "AND (ci.assignee_id = ? OR (ci.assignee_id IS NULL AND cal.executor_id = ?))"
              : ""
          }
        ORDER BY ci.date ASC
        LIMIT 25
      `;

      const next7Params =
        activeRole === "designer"
          ? [todayStr, next7DaysEndStr, user.id, user.id]
          : [todayStr, next7DaysEndStr];
      const rawNext7 = (await db.prepare(next7Query).all(...next7Params)) as any[];

      const groupedByDate = new Map<string, any[]>();
      rawNext7.forEach((it) => {
        const list = groupedByDate.get(it.date) || [];
        list.push(it);
        groupedByDate.set(it.date, list);
      });

      groupedByDate.forEach((its, dStr) => {
        const [y, m, d] = dStr.split("-").map(Number);
        const itemDate = new Date(y, m - 1, d);
        const dateFormatted = itemDate.toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        });

        next7DaysWork.push({
          date: dStr,
          dateFormatted,
          items: its.map((it) => ({
            id: it.id,
            title: it.title || "Publicação",
            clientName: it.client_name,
            type: it.type || "Feed",
            status: it.status,
            calendarId: it.calendar_id,
            clientId: it.client_id,
            month: it.month,
            isAfterGlobalDeadline: Boolean(globalDeadline && it.date > globalDeadline),
          })),
        });
      });
    } catch {}

    // 6. Bloco "Continuar de Onde Parei"
    const recentCalendars = calendarFollowUp.slice(0, 4);

    return NextResponse.json({
      cycle,
      globalDeadline,
      activeRole,
      summary: {
        totalCalendars,
        deliveredCalendars,
        pendingCalendars,
      },
      followUp: {
        calendars: designerCalendars,
      },
      attentionItems,
      todayWork,
      next7DaysWork,
      recentCalendars,
    });
  } catch (error: any) {
    console.error("Erro ao carregar dados da Home:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
