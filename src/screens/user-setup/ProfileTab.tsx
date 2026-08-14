import React from "react";
import { Camera, Github, Globe } from "lucide-react";
import { UserProfile } from "../../types";
import { Input } from "../../components/ui/Input/Input";
import { compressImage } from "../../components/SmartMediaUploader";
import { api } from "../../lib/api";
import styles from "./ProfileTab.module.css";

type ProfileTabProps = {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  setUploadingImage: (uploading: boolean) => void;
  setPendingPhotoAssetId: (assetId: string | null) => void;
  toast: (msg: string, type?: "success" | "error" | "info") => void;
};

export function ProfileTab({
  user,
  setUser,
  setUploadingImage,
  setPendingPhotoAssetId,
  toast,
}: ProfileTabProps) {
  return (
    <div className={styles.root}>
      <div className={styles.profileHeader}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="Avatar" />
            ) : (
              user.displayName?.substring(0, 2).toUpperCase()
            )}
          </div>
          <label className={styles.avatarUpload}>
            <Camera />
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
                    const uploaded = await api.uploadProfileImage(compressed, `avatar_${user.uid}`);
                    setPendingPhotoAssetId(uploaded.thumbnailAssetId || uploaded.assetId);
                    setUser((current) =>
                      current ? { ...current, photoURL: uploaded.thumbnailUrl || uploaded.url } : current,
                    );
                  } catch (error: any) {
                    toast(error?.response?.data?.error || "Falha ao enviar a foto.", "error");
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
        <div className={styles.identity}>
          <h4>{user.displayName}</h4>
          <p>{user.email}</p>
          <div className={styles.role}>
            {user.role}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <Input
            label="Nome de Exibição"
            type="text"
            value={user.displayName || ""}
            onChange={(e) => setUser({ ...user, displayName: e.target.value })}
            className="w-full"
          />
        </div>
        <div>
          <Input
            label="Data de Nascimento"
            type="date"
            value={user.birthday || ""}
            onChange={(e) => setUser({ ...user, birthday: e.target.value })}
            className="w-full"
          />
        </div>
      </div>

      <div className={styles.linksSection}>
        <h4>Links Profissionais</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className={styles.inputWithIcon}>
            <Github />
            <Input
              type="text"
              placeholder="GitHub Username"
              value={user.githubUsername || ""}
              onChange={(e) => setUser({ ...user, githubUsername: e.target.value })}
              className="w-full"
            />
          </div>
          <div className={styles.inputWithIcon}>
            <Globe />
            <Input
              type="text"
              placeholder="Portfólio / Site"
              value={user.portfolioUrl || ""}
              onChange={(e) => setUser({ ...user, portfolioUrl: e.target.value })}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
