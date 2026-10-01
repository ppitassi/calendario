"use client";
/**
 * Representação Discreta e Elegante de Feed do Instagram no final da Apresentação.
 * Mostra como o feed do cliente ficará após a publicação de todas as artes do mês.
 * Inclui múltiplos perfis e distribui posts collab em ambos os perfis.
 */

import { useState, useMemo } from "react";
import { Grid3X3, Layers } from "lucide-react";
import type { CalendarRecord, ContentItem } from "@/lib/types";
import styles from "./PresentationDiscreteFeed.module.css";

export function PresentationDiscreteFeed({
  calendar,
  items,
}: {
  calendar: CalendarRecord;
  items: ContentItem[];
}) {
  // Coleta perfis únicos presentes nas publicações
  const detectedProfiles = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.profile && item.profile.trim()) set.add(item.profile.trim());
      if (item.collabProfile && item.collabProfile.trim()) set.add(item.collabProfile.trim());
    });
    return Array.from(set);
  }, [items]);

  const [activeProfile, setActiveProfile] = useState<string>(() => {
    if (detectedProfiles.length > 0) return detectedProfiles[0];
    return calendar.brand ? `@${calendar.brand.toLowerCase().replace(/\s+/g, "")}` : "@perfil";
  });

  // Filtra publicações para o perfil ativo (collabs aparecem em ambos os perfis relacionados)
  const profilePosts = useMemo(() => {
    // Se não há perfis detectados, exibe todas
    if (detectedProfiles.length === 0) {
      return [...items].reverse();
    }

    return items
      .filter((item) => {
        const p = (item.profile || "").trim();
        const cp = (item.collabProfile || "").trim();
        return p === activeProfile || (item.isCollab && cp === activeProfile);
      })
      // No feed do Instagram, a postagem mais recente fica no topo (ordem cronológica reversa)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [items, detectedProfiles, activeProfile]);

  const scrollToPost = (postId: string) => {
    const el = document.getElementById(`post-${postId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const brandInitials = (calendar.brand || "CP").slice(0, 2).toUpperCase();

  return (
    <section className={styles.discreteFeedSection}>
      <div className={styles.sectionHeading}>
        <span>Feed Mockup</span>
        <h3>Simulação do Feed</h3>
        <p>
          Visualização compacta de como o perfil ficará após a publicação de todas as artes do mês.
        </p>
      </div>

      {/* Alternador de Perfis (se houver mais de 1) */}
      {detectedProfiles.length > 1 && (
        <div className={styles.profileSelector}>
          {detectedProfiles.map((p) => {
            const count = items.filter(
              (it) => it.profile === p || (it.isCollab && it.collabProfile === p)
            ).length;
            return (
              <button
                key={p}
                type="button"
                className={`${styles.profileTabBtn} ${activeProfile === p ? styles.active : ""}`}
                onClick={() => setActiveProfile(p)}
              >
                <span>{p}</span>
                <span className={styles.postCountBadge}>{count} posts</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Moldura Discreta do Smartphone com Feed Realista */}
      <div className={styles.phoneFrame}>
        {/* Cabeçalho do Perfil Instagram */}
        <div className={styles.instaHeader}>
          <div className={styles.instaTopRow}>
            <div className={styles.instaAvatar}>
              <div className={styles.avatarInner}>
                {calendar.client_logo_url ? (
                  <img
                    src={calendar.client_logo_url}
                    alt={calendar.brand}
                    className={styles.avatarImg}
                  />
                ) : (
                  <span className={styles.avatarFallback}>{brandInitials}</span>
                )}
              </div>
            </div>

            <div className={styles.instaStats}>
              <div className={styles.statCol}>
                <strong>{profilePosts.length}</strong>
                <span>posts</span>
              </div>
              <div className={styles.statCol}>
                <strong>--</strong>
                <span>seguidores</span>
              </div>
              <div className={styles.statCol}>
                <strong>--</strong>
                <span>seguindo</span>
              </div>
            </div>
          </div>

          <div className={styles.instaBio}>
            <span className={styles.instaBioName}>{calendar.brand}</span>
            <span className={styles.instaBioHandle}>{activeProfile}</span>
          </div>
        </div>

        {/* Aba do Feed (Grade) */}
        <div className={styles.instaTabsBar}>
          <div className={styles.gridTabActive}>
            <Grid3X3 size={16} />
          </div>
        </div>

        {/* Grade 3x3 de Miniaturas das Publicações */}
        <div className={styles.instaGrid}>
          {profilePosts.map((post, idx) => {
            const thumb =
              post.imageUrl ||
              (post as any).image_url ||
              (post as any).imageurl ||
              post.storyUrl ||
              (post as any).story_url ||
              "";

            return (
              <button
                key={post.id}
                type="button"
                className={styles.gridCell}
                onClick={() => scrollToPost(post.id)}
                title={`Post #${idx + 1} (${post.date}) - Clique para ver o briefing`}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={post.title}
                    className={styles.gridThumbImg}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.gridNoMedia}>
                    <Layers size={13} />
                    <span className={styles.gridNoMediaTitle}>
                      {post.head || post.title || "Arte"}
                    </span>
                  </div>
                )}

                {post.isCollab && (
                  <span className={styles.collabBadgeOverlay}>Collab</span>
                )}
                <span className={styles.orderBadgeOverlay}>{post.date.slice(8, 10)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
