import React, { type CSSProperties } from "react";
import { Palette } from "lucide-react";
import { Input } from "../../components/ui/Input/Input";
import styles from "./AgencyThemeTab.module.css";

type AgencyThemeTabProps = {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
};

const PRESET_COLORS = [
  "#e3002f",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#14b8a6",
];

export function AgencyThemeTab({ formData, setFormData }: AgencyThemeTabProps) {
  const primaryColor = formData.theme_config?.primary || "#e3002f";

  const handleColorChange = (color: string) => {
    setFormData({
      ...formData,
      theme_config: {
        ...formData.theme_config,
        primary: color,
      },
    });
  };

  const handleModeColorChange = (
    mode: "light" | "dark",
    key: "background" | "surface",
    color: string,
  ) => {
    setFormData({
      ...formData,
      theme_config: {
        ...formData.theme_config,
        [mode]: {
          ...formData.theme_config?.[mode],
          [key]: color,
        },
      },
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <div className={styles.label}>
          <Palette /> Cor Primária da Marca
        </div>

        <div className="flex items-center gap-4">
          {/* style-architecture-exception: tenant-selected color is runtime data exposed through a scoped CSS variable. */}
          <div className={styles.currentColor} style={{ "--preview-color": primaryColor } as CSSProperties} />
          <Input
            label="Cor primária em hexadecimal"
            type="text"
            value={primaryColor}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-36"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {PRESET_COLORS.map((color) => (
            /* style-architecture-button-exception: theme swatches select a tenant color value. */
            <button
              key={color}
              type="button"
              onClick={() => handleColorChange(color)}
              className={styles.swatch}
              style={{ "--preview-color": color } as CSSProperties}
            />
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.label}>Cores das superfícies</div>
        <div className={styles.colorGrid}>
          <Input
            label="Fundo — modo claro"
            type="color"
            value={formData.theme_config?.light?.background || "#ffffff"}
            onChange={(event) => handleModeColorChange("light", "background", event.target.value)}
          />
          <Input
            label="Superfície — modo claro"
            type="color"
            value={formData.theme_config?.light?.surface || "#f8fafc"}
            onChange={(event) => handleModeColorChange("light", "surface", event.target.value)}
          />
          <Input
            label="Fundo — modo escuro"
            type="color"
            value={formData.theme_config?.dark?.background || "#0f172a"}
            onChange={(event) => handleModeColorChange("dark", "background", event.target.value)}
          />
          <Input
            label="Superfície — modo escuro"
            type="color"
            value={formData.theme_config?.dark?.surface || "#1e293b"}
            onChange={(event) => handleModeColorChange("dark", "surface", event.target.value)}
          />
        </div>
      </div>

      <div className={styles.previewSection}>
        <h4>Pré-visualização do Tema</h4>
        <div className={styles.previews}>
          <div className={styles.preview} data-theme="light">
            <span>Modo Claro</span>
            {/* style-architecture-exception: tenant-selected color is runtime data exposed through a scoped CSS variable. */}
            <div className={styles.previewButton} style={{ "--preview-color": primaryColor } as CSSProperties}>
              Botão Primário
            </div>
          </div>
          <div className={styles.preview} data-theme="dark">
            <span>Modo Escuro</span>
            {/* style-architecture-exception: tenant-selected color is runtime data exposed through a scoped CSS variable. */}
            <div className={styles.previewButton} style={{ "--preview-color": primaryColor } as CSSProperties}>
              Botão Primário
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
