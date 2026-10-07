"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ContentItem } from "../../lib/types";

export interface EditorProfileSelectProps {
  item: ContentItem;
  profileSuggestions: string[];
  isProfileInUse: (p: string) => boolean;
  onSelectProfile: (newProfile: string) => void;
  onToggleCollab: (checked: boolean) => void;
  onCollabProfileChange: (collabProfile: string) => void;
  onDeleteProfileClick: (e: React.MouseEvent, p: string) => void;
  onCreateProfile?: (profile: string) => void;
}

export function EditorProfileSelect({
  item,
  profileSuggestions,
  isProfileInUse,
  onSelectProfile,
  onToggleCollab,
  onCollabProfileChange,
  onDeleteProfileClick,
  onCreateProfile,
}: EditorProfileSelectProps) {
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfileText, setNewProfileText] = useState("");

  const handleAddProfile = () => {
    const raw = newProfileText.trim().replace(/^@+/, "");
    if (!raw) return;
    const formatted = `@${raw}`;
    if (onCreateProfile) {
      onCreateProfile(formatted);
    } else {
      onSelectProfile(formatted);
    }
    setNewProfileText("");
    setShowAddProfile(false);
  };

  return (
    <div className="profileCollabBox">
      <div className="profileCollabHeader">
        <div>
          <span className="sectionTag">Distribuição de Perfis</span>
          <strong>Publicação em Perfil / Collab</strong>
        </div>
        <div className="profileCollabHeaderActions">
          {!showAddProfile && (
            <button
              type="button"
              className="addProfileSmallBtn"
              onClick={() => setShowAddProfile(true)}
              title="Criar novo perfil (@)"
            >
              <Plus size={12} />
              <span>{profileSuggestions.length === 0 ? "Criar Perfil" : "Novo Perfil"}</span>
            </button>
          )}
          <label className="collabSwitchLabel">
            <input
              type="checkbox"
              checked={Boolean(item.isCollab)}
              onChange={(e) => onToggleCollab(e.target.checked)}
            />
            <span className="collabSwitchBadge">
              {item.isCollab ? "Collab Ativo" : "Collab Desativado"}
            </span>
          </label>
        </div>
      </div>

      {showAddProfile && (
        <div className="addProfileInlineBox">
          <div className="addProfileInputGroup">
            <span className="addProfilePrefix">@</span>
            <input
              type="text"
              placeholder={profileSuggestions.length === 0 ? "nome_do_perfil (atribui a todas as artes)" : "segundo_perfil"}
              value={newProfileText.replace(/^@/, "")}
              onChange={(e) => setNewProfileText(e.target.value.replace(/^@/, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddProfile();
                }
              }}
              autoFocus
            />
          </div>
          <button
            type="button"
            className="confirmAddProfileBtn"
            onClick={handleAddProfile}
            title="Confirmar criação do perfil"
          >
            <Plus size={13} />
            <span>{profileSuggestions.length === 0 ? "Criar e Atribuir a Todas as Artes" : "Adicionar Perfil"}</span>
          </button>
          <button
            type="button"
            className="cancelAddProfileBtn"
            onClick={() => {
              setShowAddProfile(false);
              setNewProfileText("");
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="profileFieldsGrid">
        <div className="profileField">
          <div className="profileHeaderRow">
            <span>Perfil Principal ({item.isCollab ? "Autor 1" : "Conta"})</span>
          </div>

          <div className="profileCurrentInputGroup">
            <input
              id="mainProfileInput"
              type="text"
              value={item.profile || ""}
              onChange={(e) => onSelectProfile(e.target.value)}
              placeholder={
                profileSuggestions.length === 0
                  ? "Sem perfil vinculado (clique em Criar Perfil acima)"
                  : "Selecione um perfil abaixo ou digite @perfil"
              }
            />
            {item.profile && (
              <button
                type="button"
                className="clearProfileBtn"
                onClick={() => onSelectProfile("")}
                title="Remover arroba desta publicação"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {profileSuggestions.length > 0 && (
            <div className="profilePills">
              <button
                type="button"
                className={`profilePillBtn ${!item.profile ? "active outline" : ""}`}
                onClick={() => onSelectProfile("")}
                title="Publicar sem arroba vinculado"
              >
                <span className="pillLabel">Sem @</span>
              </button>
              {profileSuggestions.map((p) => {
                const inUse = isProfileInUse(p);
                const isSelected = item.profile === p;
                return (
                  <button
                    key={p}
                    type="button"
                    className={`profilePillBtn ${isSelected ? "active" : ""} ${!inUse && !isSelected ? "unused" : ""}`.trim()}
                    onClick={() => onSelectProfile(p)}
                    title={
                      inUse
                        ? `Perfil em uso: ${p}`
                        : `Perfil não utilizado (${p}). Clique para selecionar ou no X para remover`
                    }
                  >
                    <span className="pillLabel">{p}</span>
                    {!inUse && !isSelected && (
                      <span
                        className="pillDeleteBtn"
                        role="button"
                        tabIndex={0}
                        title={`Excluir tag ${p}`}
                        onClick={(e) => onDeleteProfileClick(e, p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onDeleteProfileClick(e as any, p);
                          }
                        }}
                      >
                        <X size={11} strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {item.isCollab && (
          <div className="profileField collabField">
            <div className="profileHeaderRow">
              <span>Perfil Colaborador (Autor 2 / Parceiro)</span>
            </div>
            <div className="profileCurrentInputGroup">
              <input
                type="text"
                value={item.collabProfile || ""}
                onChange={(e) => onCollabProfileChange(e.target.value)}
                placeholder="Ex: @perfilB ou @parceiro"
              />
              {item.collabProfile && (
                <button
                  type="button"
                  className="clearProfileBtn"
                  onClick={() => onCollabProfileChange("")}
                  title="Remover colaborador desta publicação"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {profileSuggestions.length > 0 && (
              <div className="profilePills">
                <button
                  type="button"
                  className={`profilePillBtn ${!item.collabProfile ? "active outline" : ""}`}
                  onClick={() => onCollabProfileChange("")}
                  title="Sem colaborador"
                >
                  <span className="pillLabel">Sem @</span>
                </button>
                {profileSuggestions.map((p) => {
                  const inUse = isProfileInUse(p);
                  const isSelected = item.collabProfile === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`profilePillBtn ${isSelected ? "active" : ""} ${!inUse && !isSelected ? "unused" : ""}`.trim()}
                      onClick={() => onCollabProfileChange(p)}
                      title={
                        inUse
                          ? `Perfil em uso: ${p}`
                          : `Perfil não utilizado (${p}). Clique para selecionar ou no X para remover`
                      }
                    >
                      <span className="pillLabel">{p}</span>
                      {!inUse && !isSelected && (
                        <span
                          className="pillDeleteBtn"
                          role="button"
                          tabIndex={0}
                          title={`Excluir tag ${p}`}
                          onClick={(e) => onDeleteProfileClick(e, p)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onDeleteProfileClick(e as any, p);
                            }
                          }}
                        >
                          <X size={11} strokeWidth={2.5} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {item.isCollab && (
        <div className="collabNotice">
          <span className="collabDot" />
          <span>
            Esta publicação será apresentada em conjunto como collab entre{" "}
            <strong>{item.profile || "Perfil A"}</strong> e{" "}
            <strong>{item.collabProfile || "Perfil B"}</strong>.
          </span>
        </div>
      )}
    </div>
  );
}
