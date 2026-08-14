import React from "react";
import { Globe } from "lucide-react";
import { ClientData } from "../../types";
import { Input } from "../../components/ui/Input/Input";
import { Button } from "../../components/ui/Button/Button";
import styles from "./IntegrationsTab.module.css";

type IntegrationsTabProps = {
  selectedClient: ClientData;
  client: ClientData;
  setClient: React.Dispatch<React.SetStateAction<ClientData | null>>;
  setAccountSelector: (val: any) => void;
  toast: (msg: string, type: "success" | "error" | "info") => void;
  confirm: (title: string, msg: string, opts?: any) => Promise<boolean>;
};

export function IntegrationsTab({
  selectedClient,
  client,
  setClient,
  setAccountSelector,
  toast,
  confirm,
}: IntegrationsTabProps) {
  return (
    <div className={styles.root}>
      <div className={styles.heading}>
        <h3>Integrações de Redes Sociais</h3>
        <p>
          Conecte as contas do cliente para sincronizar métricas no painel de BI automaticamente.
        </p>
      </div>

      {[
        {
          platform: "facebook",
          label: "Facebook Page",
          tokenKey: "meta_access_token",
          idKey: "facebook_page_id",
          idLabel: "Facebook Page ID (auto-detectado)",
        },
        {
          platform: "instagram",
          label: "Instagram / Meta",
          tokenKey: "meta_access_token",
          idKey: "meta_account_id",
          idLabel: "Business Account ID (auto-detectado)",
        },
        {
          platform: "youtube",
          label: "YouTube",
          tokenKey: "youtube_token",
          idKey: "youtube_channel_id",
          idLabel: "Channel ID (auto-detectado)",
        },
        {
          platform: "tiktok",
          label: "TikTok",
          tokenKey: "tiktok_token",
          idKey: "tiktok_username",
          idLabel: "Username do TikTok",
        },
        {
          platform: "linkedin",
          label: "LinkedIn",
          tokenKey: "linkedin_token",
          idKey: "linkedin_org_id",
          idLabel: "Organization ID",
        },
        {
          platform: "x",
          label: "X (Twitter)",
          tokenKey: "x_token",
          idKey: "x_username",
          idLabel: "Username do X",
        },
      ].map(({ platform, label, tokenKey, idKey, idLabel }) => {
        const isConnected = !!(client as any)[tokenKey];
        const supportsOAuth = ["facebook", "instagram", "youtube"].includes(platform);

        return (
          <div key={platform} className={styles.integration}>
            <div className={styles.integrationHeader}>
              <div className={styles.identity}>
                <div className={styles.platformIcon} data-platform={platform}>
                  <Globe />
                </div>
                <div>
                  <h4>{label}</h4>
                  <span className={styles.connectionStatus} data-connected={isConnected || undefined}>
                    {isConnected ? "● Conectado" : "○ Não conectado"}
                  </span>
                </div>
              </div>

              {supportsOAuth ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => {
                      window.open(
                        platform === "facebook" || platform === "instagram"
                          ? `/api/integrations/meta/${platform}/start?clientId=${encodeURIComponent(selectedClient.id)}`
                          : `/api/auth/social/login/${platform}?clientId=${encodeURIComponent(selectedClient.id)}`,
                        "oauth",
                        "width=640,height=720,top=100,left=200",
                      );
                      const handler = (event: MessageEvent) => {
                        if (![window.location.origin, "https://wrangle-succulent-submersed.ngrok-free.dev"].includes(event.origin)) return;
                        if (typeof event.data === "string" && event.data.startsWith("oauth-result:")) {
                          window.removeEventListener("message", handler);
                          const result = JSON.parse(event.data.replace("oauth-result:", ""));
                          if (result.status === "success") { toast("Conta vinculada com sucesso!", "success"); window.location.reload(); }
                          else toast(result.message || (result.status === "cancelled" ? "Autorização cancelada." : "Erro ao conectar conta."), "error");
                          return;
                        }
                        if (typeof event.data === "string" && event.data.startsWith("oauth-payload:")) {
                          try {
                            const payload = JSON.parse(event.data.replace("oauth-payload:", ""));
                            window.removeEventListener("message", handler);
                            if (payload.platform === "instagram" || payload.platform === "facebook") {
                              setAccountSelector({
                                platform: payload.platform,
                                connectionId: payload.connectionId || payload.token,
                                accounts: payload.accounts,
                              });
                            }
                          } catch (e) {
                            console.error("Failed to parse oauth payload");
                          }
                        }
                      };
                      window.addEventListener("message", handler);
                    }}
                    className="flex-1"
                    variant="primary"
                  >
                    {isConnected ? "Reconectar" : "Conectar"}
                  </Button>

                  {isConnected && (
                    <Button
                      onClick={async () => {
                        const isConfirmed = await confirm(
                          "Desconectar Integração",
                          `Tem certeza que deseja desconectar o ${label}?`,
                          { confirmText: "Desconectar", type: "danger" },
                        );
                        if (isConfirmed) {
                          const updatedClient = { ...selectedClient, [tokenKey]: null, [idKey]: null } as any;
                          setClient(updatedClient);
                          import("../../lib/api").then(({ api }) => {
                            api.saveClient(updatedClient).then(() => {
                              toast(`${label} desconectado.`, "info");
                            });
                          });
                        }
                      }}
                      variant="danger"
                    >
                      Desconectar
                    </Button>
                  )}
                </div>
              ) : (
                <span className={styles.manualHint}>Preencha o campo abaixo manualmente</span>
              )}
            </div>

            <div>
              <Input
                label={idLabel}
                type="text"
                value={(client as any)[idKey] || ""}
                onChange={(e) => setClient({ ...selectedClient, [idKey]: e.target.value } as any)}
                placeholder={supportsOAuth ? "Preenchido automaticamente após o login" : "ex: @username"}
                className="w-full"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
