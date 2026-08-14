"use client";

import { useState } from "react";
import { Bell, Plus } from "lucide-react";
import { Button } from "../../src/components/ui/Button/Button";
import { Checkbox } from "../../src/components/ui/Checkbox/Checkbox";
import { Dropdown } from "../../src/components/ui/Dropdown/Dropdown";
import { IconButton } from "../../src/components/ui/IconButton/IconButton";
import { Input } from "../../src/components/ui/Input/Input";
import { Modal } from "../../src/components/ui/Modal/Modal";
import { Radio } from "../../src/components/ui/Radio/Radio";
import { Select } from "../../src/components/ui/Select/Select";
import { Surface } from "../../src/components/ui/Surface/Surface";
import { Textarea } from "../../src/components/ui/Textarea/Textarea";
import { Tooltip } from "../../src/components/ui/Tooltip/Tooltip";
import styles from "./ui-catalog.module.css";

const menuItems = [
  { id: "overview", label: "Visão geral" },
  { id: "editor", label: "Editor" },
  { id: "disabled", label: "Indisponível", disabled: true },
];

function ThemeCatalog({ dark = false }: { dark?: boolean }) {
  const [menuValue, setMenuValue] = useState("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const radioName = `catalog-radio-${dark ? "dark" : "light"}`;

  return (
    <section className={dark ? `dark ${styles.theme}` : styles.theme} aria-label={dark ? "Tema escuro" : "Tema claro"}>
      <header className={styles.themeHeader}>
        <div><span className={styles.eyebrow}>Tema</span><h2>{dark ? "Escuro" : "Claro"}</h2></div>
        <Surface level="strong" className={styles.status}>Liquid Glass</Surface>
      </header>
      <Surface level="medium" className={styles.group}>
        <h3>Botões</h3>
        <div className={styles.row}>
          <Button variant="primary" icon={<Plus aria-hidden="true" />}>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="glass">Glass</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Perigo</Button>
          <Button loading>Carregando</Button>
          <Button disabled>Desabilitado</Button>
        </div>
        <div className={styles.row}>
          <Tooltip content="Abrir notificações"><IconButton label="Notificações" variant="glass"><Bell aria-hidden="true" /></IconButton></Tooltip>
          <IconButton label="Adicionar" variant="primary"><Plus aria-hidden="true" /></IconButton>
          <Dropdown label="Visões disponíveis" value={menuValue} items={menuItems} onSelect={setMenuValue} trigger={<Button variant="glass">Dropdown</Button>} />
          <Button variant="primary" onClick={() => setModalOpen(true)}>Abrir modal</Button>
        </div>
      </Surface>
      <Surface level="medium" className={styles.group}>
        <h3>Formulários</h3>
        <div className={styles.formGrid}>
          <Input label="Nome" description="Texto de apoio do campo." placeholder="Digite um nome" required />
          <Input label="Campo com erro" error="Revise este valor." defaultValue="Valor inválido" />
          <Select label="Cliente" description="Select nativo estilizado." defaultValue="ativa"><option value="ativa">Ativa</option><option value="third-floor">Third Floor</option></Select>
          <Input label="Desabilitado" disabled defaultValue="Sem edição" />
          <Textarea className={styles.wide} label="Descrição" placeholder="Escreva uma descrição" />
        </div>
        <div className={styles.choiceRow}>
          <Checkbox label="Selecionado" defaultChecked /><Checkbox label="Desabilitado" disabled />
          <Radio label="Opção A" name={radioName} defaultChecked /><Radio label="Opção B" name={radioName} />
        </div>
      </Surface>
      <div className={styles.surfaceGrid}>
        {(["subtle", "medium", "strong", "overlay"] as const).map(level => <Surface key={level} level={level} className={styles.sampleSurface}><strong>{level}</strong><span>Nível de superfície</span></Surface>)}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modal Liquid Glass">
        <p>Conteúdo de exemplo para validar foco, Escape, backdrop e camadas.</p>
        <div className={styles.modalActions}><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button variant="primary" onClick={() => setModalOpen(false)}>Confirmar</Button></div>
      </Modal>
    </section>
  );
}

export default function UiCatalogPage() {
  return <main className={styles.page}><header className={styles.pageHeader}><span className={styles.eyebrow}>Arquitetura de interface</span><h1>Catálogo de primitives</h1><p>Referência visual e funcional dos componentes recorrentes da aplicação.</p></header><div className={styles.themes}><ThemeCatalog /><ThemeCatalog dark /></div></main>;
}
