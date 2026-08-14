import { useMemo } from "react";
import { format } from "date-fns";
import { api } from "../../lib/api";
import { PostData, ClientData } from "../../types";
import { DEFAULT_POST } from "../../lib/constants";
import { mergeGeneratedFields, postNumberInCurrentMonth } from "./planner-ai-helpers";

type UsePlannerActionsProps = {
  posts: Record<string, PostData>;
  setPosts: (posts: Record<string, PostData>) => void;
  postsRef: React.MutableRefObject<Record<string, PostData>>;
  pendingPostsRef: React.MutableRefObject<Record<string, PostData>>;
  saveTimersRef: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout>>>;
  saveState: string;
  setSaveState: (state: "idle" | "saving" | "saved" | "error") => void;
  savePostInOrder: (clientId: string, date: string, post: PostData) => Promise<void>;
  schedulePostSave: (clientId: string, date: string, post: PostData) => void;
  selectedDateStr: string | null;
  setSelectedDateStr: (date: string | null) => void;
  currentClient: ClientData | null;
  currentDate: Date;
  setIsGeneratingPost: (val: boolean) => void;
  setIsGeneratingMonth: (val: boolean) => void;
  newComment: string;
  setNewComment: (val: string) => void;
  setComments: (comments: any[]) => void;
};

export function usePlannerActions({
  posts,
  setPosts,
  postsRef,
  pendingPostsRef,
  saveTimersRef,
  saveState,
  setSaveState,
  savePostInOrder,
  schedulePostSave,
  selectedDateStr,
  setSelectedDateStr,
  currentClient,
  currentDate,
  setIsGeneratingPost,
  setIsGeneratingMonth,
  newComment,
  setNewComment,
  setComments,
}: UsePlannerActionsProps) {
  const calendarDateFor = (key: string, post?: PostData) => post?.date || key.split("#")[0];
  const updateCurrentPost = (updates: Partial<PostData>) => {
    if (selectedDateStr && currentClient) {
      const basePost = postsRef.current[selectedDateStr] || { ...DEFAULT_POST, date: selectedDateStr.split("#")[0] };
      const updatedPost = { ...basePost, ...updates, date: calendarDateFor(selectedDateStr,basePost), updatedAt: Date.now() };
      postsRef.current = { ...postsRef.current, [selectedDateStr]: updatedPost };
      setPosts(postsRef.current);
      schedulePostSave(currentClient.id, selectedDateStr, updatedPost);
    }
  };

  const generateCurrentPostFields = async () => {
    if (!currentClient || !selectedDateStr) return;
    setIsGeneratingPost(true);
    try {
      const base = postsRef.current[selectedDateStr] || { ...DEFAULT_POST, date: selectedDateStr.split("#")[0] };
      const num = postNumberInCurrentMonth(posts, calendarDateFor(selectedDateStr,base));
      const generated = await api.generatePostFields(currentClient.id, { ...base, postNumber: num });
      const latestPost = postsRef.current[selectedDateStr] || base;
      const updated = mergeGeneratedFields(latestPost, generated, num);
      postsRef.current = { ...postsRef.current, [selectedDateStr]: updated };
      setPosts(postsRef.current);
      await savePostInOrder(currentClient.id, selectedDateStr, updated);
    } catch (error) {
      console.error("Error generating post fields:", error);
    } finally {
      setIsGeneratingPost(false);
    }
  };

  const generateMonthFields = async () => {
    if (!currentClient) return;
    const month = format(currentDate, "yyyy-MM");
    const entries = Object.entries(posts).filter(([key,post]) => calendarDateFor(key,post).startsWith(month));
    if (!entries.length) return;
    setIsGeneratingMonth(true);
    try {
      const orderedEntries = [...entries].sort(([keyA,postA], [keyB,postB]) => calendarDateFor(keyA,postA).localeCompare(calendarDateFor(keyB,postB))||keyA.localeCompare(keyB));
      const payload = orderedEntries.map(([key, post], index) => ({
        ...(post as PostData),
        date: calendarDateFor(key,post),
        postNumber: index + 1,
      }));
      const generated = await api.generateMonthFields(currentClient.id, payload);
      const updatedEntries = orderedEntries.map(([date, post], index) => {
        const latestPost = postsRef.current[date] || post;
        return [date, mergeGeneratedFields(latestPost, generated[index], index + 1)] as [string, PostData];
      });
      const newPosts: Record<string, PostData> = { ...postsRef.current };
      updatedEntries.forEach(([date, post]) => {
        newPosts[date] = post;
      });
      postsRef.current = newPosts;
      setPosts(postsRef.current);
      await Promise.all(updatedEntries.map(([date, post]) => savePostInOrder(currentClient.id, date, post)));
    } catch (error) {
      console.error("Error generating month fields:", error);
    } finally {
      setIsGeneratingMonth(false);
    }
  };

  const currentPost = selectedDateStr ? posts[selectedDateStr] || { ...DEFAULT_POST, date: selectedDateStr } : null;
  const orderedPlannedPosts = useMemo(
    () =>
      Object.keys(posts)
        .filter((dateStr) => {
          const date = new Date(`${calendarDateFor(dateStr,posts[dateStr])}T00:00:00`);
          return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
        })
        .sort((dateA, dateB) => calendarDateFor(dateA,posts[dateA]).localeCompare(calendarDateFor(dateB,posts[dateB]))||dateA.localeCompare(dateB))
        .map((date) => ({ date, id: posts[date]?.id })),
    [posts, currentDate],
  );

  const currentPlannedPostIndex = useMemo(() => {
    if (!selectedDateStr) return -1;
    const currentId = posts[selectedDateStr]?.id;
    return orderedPlannedPosts.findIndex((item) => (currentId != null && item.id != null ? String(item.id) === String(currentId) : item.date === selectedDateStr));
  }, [orderedPlannedPosts, posts, selectedDateStr]);

  const previousPlannedPost = currentPlannedPostIndex > 0 ? orderedPlannedPosts[currentPlannedPostIndex - 1] : null;
  const nextPlannedPost = currentPlannedPostIndex >= 0 && currentPlannedPostIndex < orderedPlannedPosts.length - 1 ? orderedPlannedPosts[currentPlannedPostIndex + 1] : null;

  const navigateToPlannedPost = async (targetDate?: string) => {
    if (!targetDate || targetDate === selectedDateStr || !currentClient) return;
    const currentDateKey = selectedDateStr;
    if (currentDateKey) {
      const queueKey = `${currentClient.id}:${currentDateKey}`;
      const pending = pendingPostsRef.current[queueKey];
      if (saveTimersRef.current[queueKey]) {
        clearTimeout(saveTimersRef.current[queueKey]);
        delete saveTimersRef.current[queueKey];
      }
      const latest = pending || (saveState === "error" ? postsRef.current[currentDateKey] : null);
      if (latest) {
        setSaveState("saving");
        try {
          await savePostInOrder(currentClient.id, currentDateKey, latest);
          delete pendingPostsRef.current[queueKey];
          setSaveState("saved");
        } catch {
          setSaveState("error");
          return;
        }
      }
    }
    setSelectedDateStr(targetDate);
  };

  const applyWorkflowPatch = (patch: Partial<PostData>) => {
    if (!selectedDateStr) return;
    const updated = { ...(postsRef.current[selectedDateStr] || currentPost || DEFAULT_POST), ...patch } as PostData;
    postsRef.current = { ...postsRef.current, [selectedDateStr]: updated };
    setPosts(postsRef.current);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedDateStr) return;
    const post = posts[selectedDateStr];
    if (!post?.id) return;
    try {
      await api.addPostComment(Number(post.id), newComment);
      const updated = await api.getPostComments(Number(post.id));
      setComments(updated);
      setNewComment("");
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  return {
    updateCurrentPost,
    generateCurrentPostFields,
    generateMonthFields,
    currentPost,
    orderedPlannedPosts,
    previousPlannedPost,
    nextPlannedPost,
    navigateToPlannedPost,
    applyWorkflowPatch,
    handleAddComment,
  };
}
