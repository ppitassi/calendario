import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { ClientData } from "../../types";
import { compressImage } from "../../components/SmartMediaUploader";
import { api } from "../../lib/api";
import styles from "./BrandingTab.module.css";

type BrandingTabProps = {
  selectedClient: ClientData;
  setClient: React.Dispatch<React.SetStateAction<ClientData | null>>;
  setUploadingImage: (uploading: boolean) => void;
  toast: (msg: string, type: "success" | "error" | "info") => void;
};

export function BrandingTab({
  selectedClient,
  setClient,
  setUploadingImage,
  toast,
}: BrandingTabProps) {
  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <div className={styles.logoWrap}>
          <div className={styles.logoPreview}>
            {selectedClient.logoUrl ? (
              <img
                src={selectedClient.logoUrl}
                alt={`Logo de ${selectedClient.name}`}
                className={styles.logo}
              />
            ) : (
              <ImageIcon />
            )}
          </div>
          <label className={styles.uploadOverlay}>
            <span>
              Alterar Logo
            </span>
            {/* style-architecture-exception: native file input is required for browser upload integration. */}
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setUploadingImage(true);
                  try {
                    const compressed = await compressImage(file);
                    const url = await api.uploadImage(
                      compressed,
                      `logo_${selectedClient.id}`,
                      "logos",
                      selectedClient.name,
                      undefined,
                      undefined,
                      selectedClient.id,
                    );
                    setClient({ ...selectedClient, logoUrl: url });
                  } catch (error: any) {
                    toast(error?.response?.data?.error || "Falha ao enviar a logo.", "error");
                  } finally {
                    setUploadingImage(false);
                  }
                }
                e.currentTarget.value = "";
              }}
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
        </div>
        <div className={styles.copy}>
          <h4>Identidade Visual da Marca</h4>
          <p>
            Esta logo será exibida nos relatórios de BI e no Modo Apresentação.
          </p>
        </div>
      </div>
    </div>
  );
}
