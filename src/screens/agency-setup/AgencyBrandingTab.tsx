import React, { useRef } from "react";
import { FileText, Upload, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";
import { Button } from "../../components/ui/Button/Button";
import { Input } from "../../components/ui/Input/Input";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./AgencyBrandingTab.module.css";

type AgencyBrandingTabProps = {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>, type: "light" | "dark") => Promise<void>;
  isUploadingAsset: boolean;
  setIsUploadingAsset: React.Dispatch<React.SetStateAction<boolean>>;
};

export function AgencyBrandingTab({
  formData,
  setFormData,
  handleLogoUpload,
  isUploadingAsset,
  setIsUploadingAsset,
}: AgencyBrandingTabProps) {
  const { toast } = useNotifications();
  const manualInputRef = useRef<HTMLInputElement>(null);
  const palette = Array.isArray(formData.theme_config?.brandPalette) ? formData.theme_config.brandPalette : [];

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploadingAsset(true);
    try {
      const digest = await api.uploadBrandManual(file);
      setFormData((previous: any) => ({
        ...previous,
        theme_config: {
          ...previous.theme_config,
          brandManual: digest.manual,
          brandPalette: digest.colors.map((color) => color.hex),
        },
      }));
      toast(`${digest.colors.length} cores extraídas do manual.`, "success");
    } catch (error: any) {
      toast(error?.response?.data?.error || "Não foi possível processar o manual.", "error");
    } finally {
      setIsUploadingAsset(false);
      event.target.value = "";
    }
  };
  return (
    <div className={styles.root}>
      <div className={styles.fieldsGrid}>
        <div>
          <Input
            label="Nome da Agência / Tenant"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Third Floor"
          />
        </div>
        <div>
          <Input
            label="Slogan / Posicionamento"
            type="text"
            value={formData.slogan}
            onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
            placeholder="Ex: Estratégia Digital & Performance"
          />
        </div>
      </div>

      <div className={styles.logoGrid}>
        {/* Logo Light */}
        <div className={styles.logoField}>
          <span className={styles.label}>Logo (Modo Claro)</span>
          <div className={styles.logoPreview} data-theme="light">
            {formData.logo_url ? (
              <>
                <img src={formData.logo_url} alt="Logo Light" />
                <IconButton
                  label="Remover logo claro"
                  onClick={() => setFormData({ ...formData, logo_url: "" })}
                  className={styles.removeAction}
                  variant="danger"
                  size="small"
                >
                  <Trash2 />
                </IconButton>
              </>
            ) : (
              <label className={styles.uploadLabel}>
                <Upload />
                <span>Enviar PNG ou SVG completo</span>
                {/* style-architecture-exception: native file input is required for browser upload integration. */}
                <input
                  type="file"
                  accept="image/png,image/svg+xml,.png,.svg"
                  onChange={(e) => handleLogoUpload(e, "light")}
                  className="hidden"
                  disabled={isUploadingAsset}
                />
              </label>
            )}
          </div>
        </div>

        {/* Logo Dark */}
        <div className={styles.logoField}>
          <span className={styles.label}>Logo (Modo Escuro)</span>
          <div className={styles.logoPreview} data-theme="dark">
            {formData.logo_dark_url ? (
              <>
                <img src={formData.logo_dark_url} alt="Logo Dark" />
                <IconButton
                  label="Remover logo escuro"
                  onClick={() => setFormData({ ...formData, logo_dark_url: "" })}
                  className={styles.removeAction}
                  variant="danger"
                  size="small"
                >
                  <Trash2 />
                </IconButton>
              </>
            ) : (
              <label className={styles.uploadLabel}>
                <Upload />
                <span>Enviar PNG ou SVG completo</span>
                {/* style-architecture-exception: native file input is required for browser upload integration. */}
                <input
                  type="file"
                  accept="image/png,image/svg+xml,.png,.svg"
                  onChange={(e) => handleLogoUpload(e, "dark")}
                  className="hidden"
                  disabled={isUploadingAsset}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      <section className={styles.manualSection}>
        <div className={styles.manualHeading}>
          <div className={styles.manualIcon}><FileText /></div>
          <div>
            <h3>Manual da marca</h3>
            <p>Envie o PDF para identificar automaticamente as cores da apresentação.</p>
          </div>
          <div className={styles.manualUpload}>
            <Button disabled={isUploadingAsset} loading={isUploadingAsset} icon={<Upload />} onClick={() => manualInputRef.current?.click()}>Selecionar PDF</Button>
            {/* style-architecture-exception: native file input is required for browser PDF upload integration. */}
            <input ref={manualInputRef} type="file" accept="application/pdf,.pdf" onChange={handleManualUpload} disabled={isUploadingAsset} />
          </div>
        </div>
        {formData.theme_config?.brandManual && (
          <div className={styles.manualMeta}>
            <strong>{formData.theme_config.brandManual.name}</strong>
            <span>{formData.theme_config.brandManual.sampledPages} páginas analisadas</span>
          </div>
        )}
        {palette.length > 0 && (
          <div className={styles.digestPalette}>
            <span>Cores encontradas - clique para usar como cor principal</span>
            <div className={styles.swatches}>
              {palette.map((color: string) => (
                /* style-architecture-button-exception: extracted runtime brand swatches select a tenant color value. */
                <button
                  key={color}
                  type="button"
                  title={`Usar ${color}`}
                  aria-label={`Usar ${color} como cor principal`}
                  className={styles.brandSwatch}
                  style={{ "--brand-color": color } as React.CSSProperties}
                  onClick={() => setFormData((previous: any) => ({ ...previous, theme_config: { ...previous.theme_config, primary: color } }))}
                ><span>{color}</span></button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
