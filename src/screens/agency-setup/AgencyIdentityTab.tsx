import React from "react";
import { Input } from "../../components/ui/Input/Input";

type AgencyIdentityTabProps = { formData: any; setFormData: React.Dispatch<React.SetStateAction<any>> };

export function AgencyIdentityTab({ formData, setFormData }: AgencyIdentityTabProps) {
  return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
    <Input className="sm:col-span-2" label="Mês de planejamento ativo" type="month" value={formData.planning_month} onChange={e => setFormData({ ...formData, planning_month: e.target.value })} />
    <Input label="Prazo pré-pauta (textos)" type="date" value={formData.deadline_pre} onChange={e => setFormData({ ...formData, deadline_pre: e.target.value })} />
    <Input label="Prazo final (artes)" type="date" value={formData.deadline_final} onChange={e => setFormData({ ...formData, deadline_final: e.target.value })} />
  </div>;
}
