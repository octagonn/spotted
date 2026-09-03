import { useLocalSearchParams } from "expo-router";
import { CalendarOff, ImageOff, Moon } from "lucide-react-native";
import { useMemo } from "react";

import { PostPagerScreen } from "@/components/post/PostPagerScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMyProfile, useProfileById } from "@/hooks/queries/useProfile";
import { useSignedUserPosts, type SignedPost } from "@/hooks/queries/useSignedUserPosts";
import { useStreakDays } from "@/hooks/queries/useStreakDays";
import { type FeedMockPost } from "@/lib/redesignData";
import { signedPostToFeedPost } from "@/lib/toFeedPost";
import { localDateKey } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon } from "@/theme/tokens";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

/**
 * Card stamp: clock time ("9:41 AM") while the day is still today, feed-style
 * relative age ("10d") once it's history — testers read a bare date/time on an
 * old post as a bug because every other surface shows relative age.
 */
function timeOf(iso: string): string {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins >= 60 * 24) return `${Math.round(mins / (60 * 24))}d`;
  return then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Day viewer (rework 1a): a calendar day is the unit of history. Opening a day
 * shows EVERY post from that local date — each as the full feed card with its
 * photo carousel + attached workout slides — oldest first, so the day reads
 * top to bottom. `?user=<id>` opens someone else's day (RLS gates visibility);
 * `?post=<id>` lands on a specific post within the day.
 */
export default function DayScreen() {
  const { date = "", user, post } = useLocalSearchParams<{ date: string; user?: string; post?: string }>();
  const myProfile = useMyProfile();
  const otherProfile = useProfileById(user);
  const ownerId = user ?? myProfile.data?.id;
  const owner = user ? otherProfile.data : myProfile.data;
  const posts = useSignedUserPosts(ownerId);
  // The gym-day ledger keeps a day alive after its post is deleted (that's what
  // preserves the streak) — so this screen must be able to SAY that, instead of
  // a bare "no posts" that contradicts the calendar cell the user just tapped.
  const streakDays = useStreakDays(ownerId);
  const ledgerDay = streakDays.data instanceof Map ? streakDays.data.get(date) : undefined;

  const parts = date.split("-").map(Number);
  const day = Number.isFinite(parts[2]) ? parts[2] : 1;
  const month = MONTHS[(parts[1] || 1) - 1] ?? "";

  const name = owner?.display_name ?? "You";
  const handle = owner?.username ?? "you";
  const avatarUrl = owner?.avatar_url ?? null;

  // Every post from this local day, oldest first.
  const dayPosts = useMemo(
    () =>
      (posts.data ?? [])
        .filter((p) => p.hasMedia && localDateKey(new Date(p.created_at)) === date)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [posts.data, date]
  );

  const feedPosts: FeedMockPost[] = useMemo(
    () => dayPosts.map((p: SignedPost) => signedPostToFeedPost(p, { name, handle, avatarUrl }, timeOf(p.created_at))),
    [dayPosts, name, handle, avatarUrl]
  );

  return (
    <PostPagerScreen
      title={`${month} ${day}`}
      sub={
        feedPosts.length
          ? `@${handle} · ${feedPosts.length} ${feedPosts.length === 1 ? "post" : "posts"}`
          : `@${handle}`
      }
      posts={feedPosts}
      initialPostId={post}
      isLoading={posts.isLoading || streakDays.isLoading}
      empty={
        ledgerDay?.kind === "gym" ? (
          // The day counted (and still counts toward the streak) but its post
          // is gone — say so, or the calendar looks like it's lying.
          <EmptyState
            icon={<ImageOff size={icon.size.sm + 2} color={colors.fog} strokeWidth={icon.stroke.thin} />}
            title="This day's post was deleted"
            body={`The gym day still counts — ${user ? "their" : "your"} streak keeps it.`}
            paddingTop={48}
          />
        ) : ledgerDay?.kind === "rest" ? (
          <EmptyState
            icon={<Moon size={icon.size.sm + 2} color={colors.silver} strokeWidth={icon.stroke.thin} />}
            title="Rest day"
            body="No post — the streak was frozen for the day, not broken."
            paddingTop={48}
          />
        ) : (
          <EmptyState
            icon={<CalendarOff size={icon.size.sm + 2} color={colors.fog} strokeWidth={icon.stroke.thin} />}
            title="Nothing on this day"
            body="No posts saved for this date."
            paddingTop={48}
          />
        )
      }
    />
  );
}
