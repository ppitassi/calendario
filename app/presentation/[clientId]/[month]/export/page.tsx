import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getPresentationData } from '../../../../../lib/next-review';
import { rows } from '../../../../../lib/db';
import { getPermissionMapForUser } from '../../../../../lib/api-core/context';
import { canAccessPresentationClient } from '../../../../../lib/presentation-access';
import { buildPresentationViewModel } from '../../../../../lib/presentation-model';
import { StaticPresentationDocument } from '../../../../../src/components/StaticPresentationDocument';
import { resolvePresentationMedia } from '../../../../../lib/presentation-pdf-jobs';

export default async function PresentationExportPage({ params }: { params: Promise<{ clientId: string; month: string }> }) {
  const { clientId, month } = await params;
  const session = (await cookies()).get('cp_session')?.value;
  const user = session ? (await rows('SELECT uid,role FROM users WHERE session_token=? AND session_expires_at>NOW() LIMIT 1',[session]))[0] : null;
  if (!user) notFound();
  const permissions = await getPermissionMapForUser(user);
  const ctx = { userUid:user.uid,userRole:user.role,isAuthenticated:true,permissions:new Set(Object.entries(permissions).filter(([,value])=>value===true).map(([key])=>key)) } as any;
  if (!(await canAccessPresentationClient(ctx,clientId))) notFound();
  const data = await getPresentationData(clientId, month);

  if ('error' in data) {
    if (data.status === 404) notFound();
    return <main style={{ padding: 48 }}>{data.error}</main>;
  }

  const model = buildPresentationViewModel(data);
  await resolvePresentationMedia(model);
  return <StaticPresentationDocument model={model} />;
}
