import axios from 'axios';
import { auth } from './auth';
import { ApprovalToken, ClientData, PostData, UserProfile } from '../types';
import { format, addDays } from 'date-fns';

export const API_URL = '/api';
axios.defaults.withCredentials = true;

function normalizeDate(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
        const match = value.match(/^\d{4}-\d{2}-\d{2}/);
        return match ? match[0] : '';
    }
    if (value instanceof Date) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return '';
}

function notifyPostsUpdated() {
    window.dispatchEvent(new CustomEvent('posts-updated'));
}

async function downloadPdf(endpoint: string, fileName = 'planejamento.pdf'): Promise<void> {
    try {
        const response = await axios.get(endpoint, { responseType: 'blob' });
        const contentType = String(response.headers['content-type'] || '');
        if (contentType.includes('application/json')) {
            const payload = JSON.parse(await response.data.text());
            if (!payload.downloadUrl) throw new Error(payload.error || 'URL do PDF nÃ£o retornada.');
            const directLink = document.createElement('a');
            directLink.href = payload.downloadUrl;
            directLink.rel = 'noopener';
            document.body.appendChild(directLink);
            directLink.click();
            directLink.remove();
            return;
        }
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error: any) {
        let message = 'Erro ao gerar PDF.';
        const data = error.response?.data;
        if (data instanceof Blob) {
            try {
                const parsed = JSON.parse(await data.text());
                message = parsed.error || message;
            } catch {}
        } else if (data?.error) {
            message = data.error;
        }
        throw new Error(message);
    }
}

axios.interceptors.response.use(response => response, error => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || '');
    if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/validate-token')) {
        auth.currentUser = null;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('auth-expired'));
    }
    return Promise.reject(error);
});

export const api = {
    // Clientes
    async getClients(): Promise<ClientData[]> {
        const response = await axios.get(`${API_URL}/clients`);
        return response.data;
    },

    async getClient(clientId: string): Promise<ClientData | null> {
        if (!clientId) return null;
        const response = await axios.get(`${API_URL}/clients/${clientId}`);
        return response.data;
    },

    async saveClient(client: ClientData): Promise<string> {
        const response = await axios.post(`${API_URL}/clients`, client);
        return response.data.id || client.id;
    },

    async deleteClient(clientId: string): Promise<void> {
        await axios.delete(`${API_URL}/clients/${clientId}`);
    },

    async saveMetaAccount(clientId: string, connectionId: string, pageId: string | null): Promise<any> {
        const response = await axios.post(`${API_URL}/clients/${clientId}/meta-account`, { connectionId, pageId });
        return response.data;
    },

    // Posts
    async getAllPosts(): Promise<PostData[]> {
        const response = await axios.get(`${API_URL}/posts`);
        return response.data;
    },

    async getPosts(clientId: string): Promise<Record<string, PostData>> {
        if (!clientId) return {};
        const response = await axios.get(`${API_URL}/posts/${clientId}`);
        const posts: Record<string, PostData> = {};
        response.data.forEach((post: any) => {
            const dateStr = normalizeDate(post.date);
            if (!dateStr) return;
            posts[dateStr] = {
                ...post,
                feedImages: typeof post.feedImages === 'string' ? JSON.parse(post.feedImages || '[]') : (post.feedImages || []),
                comments: post.comments || []
            };
        });
        return posts;
    },

    async savePost(clientId: string, date: string, post: PostData): Promise<{ id: string; date: string; workVersion?: number }> {
        const dateStr = normalizeDate(date || post.date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('Data de postagem invalida.');
        const data = {
            ...post,
            clientId,
            date: dateStr,
            feedImages: JSON.stringify(post.feedImages || [])
        };
        const response = await axios.post(`${API_URL}/posts`, data);
        notifyPostsUpdated();
        return response.data;
    },

    async generatePostFields(clientId: string, post: PostData): Promise<any> {
        const response = await axios.post(`${API_URL}/generate-objective`, { clientId, post });
        return response.data.results?.[0];
    },

    async generateMonthFields(clientId: string, posts: PostData[]): Promise<any[]> {
        const response = await axios.post(`${API_URL}/generate-objective`, { clientId, posts, mode: 'batch' });
        return response.data.results || [];
    },

    // Tokens
    async createToken(token: ApprovalToken): Promise<void> {
        await axios.post(`${API_URL}/tokens`, token);
    },

    async getTokens(params: { clientId?: string, month?: string, status?: string }): Promise<ApprovalToken[]> {
        const response = await axios.get(`${API_URL}/tokens`, { params });
        return response.data.map((token: ApprovalToken) => ({
            ...token,
            expiresAt: new Date(token.expiresAt).getTime(),
        }));
    },

    async submitPublicReviewAction(token: string, action: 'approve' | 'request_changes', note?: string): Promise<any> {
        const response = await axios.post(`${API_URL}/public/review/${token}/action`, { action, note });
        return response.data;
    },

    // UsuÃ¡rios e Roles
    async getUsers(): Promise<UserProfile[]> {
        const response = await axios.get(`${API_URL}/users`);
        return response.data;
    },

    async getTeamMembers(): Promise<UserProfile[]> {
        const response = await axios.get(`${API_URL}/team/members`);
        return response.data;
    },
    async getProductionGallery(): Promise<{ posts: PostData[]; clients: ClientData[]; members: UserProfile[] }> {
        const response = await axios.get(`${API_URL}/production-gallery`);
        return response.data;
    },

    async saveUser(user: UserProfile): Promise<void> {
        await axios.post(`${API_URL}/users`, user);
    },

    async getOwnProfile(): Promise<UserProfile> {
        const response = await axios.get(`${API_URL}/users/me`);
        return response.data;
    },

    async updateOwnProfile(profile: Pick<UserProfile, 'displayName' | 'birthday' | 'githubUsername' | 'portfolioUrl' | 'photoURL'> & { photoAssetId?: string | null }): Promise<UserProfile> {
        const response = await axios.patch(`${API_URL}/users/me`, {
            displayName: profile.displayName?.trim(), birthday: profile.birthday || null,
            githubUsername: profile.githubUsername?.trim() || null, portfolioUrl: profile.portfolioUrl?.trim() || null,
            photoURL: profile.photoURL || null, ...(profile.photoAssetId ? { photoAssetId: profile.photoAssetId } : {}),
        });
        return response.data;
    },

    async getPlanningWorkflow(planningId: string): Promise<any> { return (await axios.get(`${API_URL}/plannings/${planningId}`)).data; },
    async sendPlanningToDesign(planningId: string): Promise<any> { return (await axios.post(`${API_URL}/plannings/${planningId}/send-to-design`)).data; },
    async completePlanning(planningId: string): Promise<any> { return (await axios.post(`${API_URL}/plannings/${planningId}/complete`)).data; },
    async sendPlanningToApproval(planningId: string): Promise<any> { return (await axios.post(`${API_URL}/plannings/${planningId}/send-to-approval`)).data; },
    async markPostAwaitingApproval(postId: string | number): Promise<any> { return (await axios.post(`${API_URL}/work-items/posts/${postId}/mark-awaiting-approval`)).data; },
    async requestPostChanges(postId: string | number, reason: string): Promise<any> { return (await axios.post(`${API_URL}/work-items/posts/${postId}/request-changes`, { reason })).data; },
    async overridePostAssignment(postId: string | number, payload: any): Promise<any> { return (await axios.post(`${API_URL}/work-items/posts/${postId}/override-assignment`, payload)).data; },

    async getPostWorkItem(postId: string | number): Promise<any> { return (await axios.get(`${API_URL}/work-items/posts/${postId}`)).data; },
    async getPostActivity(postId: string | number): Promise<any[]> { return (await axios.get(`${API_URL}/work-items/posts/${postId}/activity`)).data; },
    async getPostRevisions(postId: string | number): Promise<any[]> { return (await axios.get(`${API_URL}/work-items/posts/${postId}/revisions`)).data; },
    async getPostAssignments(postId: string | number): Promise<any[]> { return (await axios.get(`${API_URL}/work-items/posts/${postId}/assignments`)).data; },
    async assignPost(postId: string | number, assignedToUserId: string, reason?: string): Promise<any> { return (await axios.post(`${API_URL}/work-items/posts/${postId}/assign`, { assignedToUserId, reason })).data; },
    async transitionPost(postId: string | number, toStage: string, version?: number, reason?: string, assignedToUserId?: string): Promise<any> { return (await axios.post(`${API_URL}/work-items/posts/${postId}/transition`, { toStage, version, reason, assignedToUserId })).data; },
    async getArtworkVersions(postId: string | number): Promise<any[]> { return (await axios.get(`${API_URL}/work-items/posts/${postId}/artwork-versions`)).data; },
    async createArtworkVersion(postId: string | number, mediaAssetIds: string[], notes?: string): Promise<any> { return (await axios.post(`${API_URL}/work-items/posts/${postId}/artwork-versions`, { mediaAssetIds, notes })).data; },
    async actOnArtworkVersion(postId: string | number, versionId: string | number, action: 'submit' | 'request-changes' | 'approve', reason?: string): Promise<any> { return (await axios.post(`${API_URL}/work-items/posts/${postId}/artwork-versions/${versionId}/${action}`, { reason })).data; },
    async getCustomRoles(): Promise<any[]> {
        const response = await axios.get(`${API_URL}/custom-roles`);
        return response.data;
    },

    async saveCustomRole(role: any): Promise<void> {
        await axios.post(`${API_URL}/custom-roles`, role);
    },

    async deletePostsBulk(clientId: string, dates: string[]): Promise<void> {
        await axios.post(`${API_URL}/posts-bulk/${clientId}`, { dates });
        notifyPostsUpdated();
    },

    async login(credentials: any) {
        const res = await axios.post(`${API_URL}/auth/login`, credentials);
        return res.data;
    },

    async validateToken() {
        const res = await axios.post(`${API_URL}/auth/validate-token`, {});
        return res.data;
    },

    async recordActivity(foregroundSeconds: number): Promise<void> {
        await axios.post(`${API_URL}/auth/activity`, {
            foregroundSeconds,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: navigator.language,
        });
    },

    async logout(): Promise<void> {
        await axios.post(`${API_URL}/auth/logout`);
    },

    async deleteUser(uid: string): Promise<void> {
        await axios.delete(`${API_URL}/users/${uid}`);
    },
    
    // Settings
    async getSettings(id: string): Promise<any> {
        const response = await axios.get(`${API_URL}/settings/${id}`);
        return response.data;
    },

    async saveSettings(id: string, data: any): Promise<void> {
        await axios.post(`${API_URL}/settings/${id}`, data);
    },

    async updateAgencySettings(data: { 
        deadline?: string; 
        name?: string;
        slogan?: string;
        logo_url?: string;
        logo_dark_url?: string;
        theme_config?: any;
        planning_month?: string;
        deadline_pre?: string;
        deadline_final?: string;
    }): Promise<void> {
        await axios.post(`${API_URL}/agency/settings`, data);
    },

    async getHolidays(year: number): Promise<any[]> {
        const res = await axios.get(`${API_URL}/holidays/${year}`);
        return res.data;
    },

    async getAgencies(): Promise<any[]> {
        const res = await axios.get(`${API_URL}/agencies`);
        return res.data;
    },

    async getAgencySettings(id: string): Promise<any> {
        const res = await axios.get(`${API_URL}/agency/settings/${id}`);
        return res.data;
    },

    async getUiPreferences(): Promise<any> {
        const res = await axios.get(`${API_URL}/users/preferences`);
        return res.data || {};
    },

    async updateUiPreferences(patch: Record<string, any>): Promise<any> {
        const res = await axios.post(`${API_URL}/users/preferences`, patch);
        if (auth.currentUser) auth.currentUser.ui_preferences = res.data || {};
        return res.data || {};
    },

    async uploadImage(base64: string, fileName: string, subfolder?: string, clientName?: string, postDate?: string, designerName?: string, clientId?: string, targetUserId?: string, ownerId?: string): Promise<string> {
        const res = await axios.post(`${API_URL}/upload-base64`, { base64, fileName, subfolder, clientName, postDate, designerName, clientId, targetUserId, ownerId });
        return res.data.url;
    },

    async uploadProfileImage(base64: string, fileName: string): Promise<{ url: string; assetId: string; thumbnailUrl?: string | null; thumbnailAssetId?: string | null }> {
        const res = await axios.post(`${API_URL}/upload-base64`, { base64, fileName, subfolder: 'avatars' });
        return res.data;
    },

    async uploadPostImage(base64: string, fileName: string, clientName: string, postDate: string | undefined, clientId: string, postId: string): Promise<{ url: string; assetId: string; thumbnailUrl?: string | null; thumbnailAssetId?: string | null }> {
        const res = await axios.post(`${API_URL}/upload-base64`, { base64, fileName, subfolder: 'posts', clientName, postDate, clientId, ownerId: postId });
        return res.data;
    },
    async uploadAudio(base64: string, fileName: string, subfolder?: string, clientId?: string): Promise<string> {
        const res = await axios.post(`${API_URL}/upload-audio`, { base64, fileName, subfolder, clientId });
        return res.data.url;
    },

    async uploadMediaFile(file: File, clientId: string, postDate?: string, ownerId?: string, category = 'media'): Promise<{ url: string; provider: string; assetId?: string }> {
        let initialized;
        try {
            initialized = await axios.post(`${API_URL}/uploads/media/init`, {
                clientId,
                postDate,
                fileName: file.name,
                mimeType: file.type,
                size: file.size,
                ownerId,
                category,
            });
        } catch (error: any) {
            if ([401, 403, 429].includes(Number(error?.response?.status))) throw error;
            const fallback = await axios.put(`${API_URL}/uploads/media`, file, {
                headers: {
                    'Content-Type': file.type,
                    'X-Client-Id': clientId,
                    'X-Post-Date': postDate || '',
                    'X-File-Name': encodeURIComponent(file.name),
                    'X-Owner-Id': ownerId || clientId,
                    'X-Category': category,
                },
            });
            return fallback.data;
        }
        const upload = await fetch(initialized.data.uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: file,
        });
        if (!upload.ok) throw new Error(`Falha no envio direto ao Nextcloud (${upload.status}).`);
        const finalized = await axios.post(`${API_URL}/uploads/media/finalize`, {
            intentId: initialized.data.intentId,
        });
        return finalized.data;
    },

    async geolocate(): Promise<any> {
        const res = await axios.get(`${API_URL}/geolocate`);
        return res.data;
    },

    // Logica de Approvals (Migrada do approvals.ts)
    async createApprovalToken(clientId: string, date: Date): Promise<ApprovalToken> {
        const monthStr = format(date, 'yyyy-MM');
        const existingTokens = await this.getTokens({ clientId, month: monthStr, status: 'pending' });
        
        if (existingTokens.length > 0 && existingTokens[0].expiresAt > Date.now()) {
            return existingTokens[0];
        }

        const clientPrefix = clientId.substring(0, 3).toUpperCase();
        const randomPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        const tokenId = `${clientPrefix}-${randomPart}`;
        
        const newToken: ApprovalToken = {
            id: tokenId,
            clientId,
            month: monthStr,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: addDays(new Date(), 30).getTime(),
        };

        await this.createToken(newToken);
        return newToken;
    },

    // Analytics
    async getAnalytics(clientId: string, filters: { 
        startDate: string; 
        endDate: string; 
        granularity: string; 
        platforms: string[] 
    }): Promise<any> {
        const response = await axios.get(`${API_URL}/analytics/${clientId}`, { 
            params: { ...filters, platforms: filters.platforms.join(',') }
        });
        return response.data;
    },

    async getAnalyticsPosts(clientId: string, filters?: { startDate?: string; endDate?: string }): Promise<any[]> {
        const response = await axios.get(`${API_URL}/analytics/${clientId}/posts`, { params: filters });
        return response.data;
    },

    async syncAnalytics(clientId: string): Promise<any> {
        const response = await axios.post(`${API_URL}/analytics/${clientId}/sync`);
        return response.data;
    },

    async chatWithLeia(clientId: string | null, message: string, history: Array<{ sender: string; text: string }>): Promise<string> {
        const response = await axios.post(`${API_URL}/leia/chat`, { clientId, message, history });
        return response.data.response;
    },

    async getWorkloadStats(): Promise<any[]> {
        const res = await axios.get(`${API_URL}/admin/workload-stats`);
        return res.data;
    },

    async getDashboardData(): Promise<any> {
        const res = await axios.get(`${API_URL}/dashboard`);
        return res.data;
    },

    async getDashboardLayout(): Promise<{ layoutVersion: number; schemaVersion: number; layoutJson: any[]; updatedAt?: string }> {
        const res = await axios.get(`${API_URL}/dashboard/layout`);
        return res.data;
    },

    async saveDashboardLayout(layoutJson: any[], expectedLayoutVersion?: number): Promise<any> {
        const res = await axios.put(`${API_URL}/dashboard/layout`, { layoutJson, expectedLayoutVersion });
        return res.data;
    },

    async resetDashboardLayout(): Promise<any> {
        const res = await axios.delete(`${API_URL}/dashboard/layout`);
        return res.data;
    },

    async getPerformanceStats(userId?: string): Promise<any> {
        const res = await axios.get(`${API_URL}/users/me/performance-stats`, { params: userId ? { userId, period: 'current_month' } : { period: 'current_month' } });
        return res.data;
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await axios.post(`${API_URL}/users/change-password`, { currentPassword, newPassword });
    },

    // Post Comments
    async getPostComments(postId: number): Promise<any[]> {
        const response = await axios.get(`${API_URL}/posts/${postId}/comments`);
        return response.data;
    },

    async addPostComment(postId: number, content: string): Promise<any> {
        const response = await axios.post(`${API_URL}/posts/${postId}/comments`, { content });
        return response.data;
    },

    async getPublicPostComments(token: string, postId: number): Promise<any[]> {
        const response = await axios.get(`${API_URL}/public/review/${token}/posts/${postId}/comments`);
        return response.data;
    },

    async addPublicPostComment(token: string, postId: number, authorName: string, content: string): Promise<any> {
        const response = await axios.post(`${API_URL}/public/review/${token}/posts/${postId}/comments`, { authorName, content });
        return response.data;
    },


    getReviewExportUrl(token: string): string {
        return `${window.location.origin}/review/${token}/export`;
    },

    getPresentationExportUrl(clientId: string, date: Date): string {
        const month = format(date, 'yyyy-MM');
        return `${window.location.origin}/presentation/${encodeURIComponent(clientId)}/${month}/export`;
    },

    async downloadPresentationPdf(clientId: string, date: Date): Promise<void> {
        const month = format(date, 'yyyy-MM');
        await downloadPdf(`${API_URL}/presentation/${encodeURIComponent(clientId)}/${month}/export-pdf`);
    },
    async downloadReviewPdf(token: string): Promise<void> {
        await downloadPdf(`${API_URL}/review/${token}/export-pdf`);
    },

    async sendReviewWhatsApp(token: string): Promise<void> {
        await axios.post(`${API_URL}/public/review/${token}/send-whatsapp`);
    }
};






