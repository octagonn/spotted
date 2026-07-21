import type { FeedPost } from "@/types/domain";

// Feed ranking. Reverse-chron is the skeleton (recency dominates via an
// exponential decay), with bounded boosts so the feed still feels live:
//   - unviewed posts float above ones you've already opened
//   - verified-at-gym drops (the core product promise) rank above couch posts
//   - daily-drop prompts get a nudge while their moment lasts
//   - light social proof from replies/replays, capped so nothing goes viral-sticky
//   - your own posts sink slightly — you've seen them, friends haven't
export const RECENCY_HALF_LIFE_HOURS = 6;
export const RECENCY_WEIGHT = 100;
export const UNVIEWED_BONUS = 40;
export const VERIFIED_BONUS = 15;
export const DAILY_DROP_BONUS = 10;
export const ENGAGEMENT_CAP = 20;
export const OWN_POST_PENALTY = 25;

export type RankContext = {
  viewerId: string | null;
  viewedPostIds: ReadonlySet<string>;
  now?: Date;
};

export function scorePost(post: FeedPost, context: RankContext): number {
  const now = context.now ?? new Date();
  const ageHours = Math.max(0, (now.getTime() - new Date(post.created_at).getTime()) / 3_600_000);
  let score = RECENCY_WEIGHT * Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);

  if (!context.viewedPostIds.has(post.id)) {
    score += UNVIEWED_BONUS;
  }
  if (post.is_verified_at_gym) {
    score += VERIFIED_BONUS;
  }
  if (post.is_daily_drop) {
    score += DAILY_DROP_BONUS;
  }
  score += Math.min(ENGAGEMENT_CAP, post.reply_count * 3 + post.replay_count * 2);
  if (context.viewerId !== null && post.user_id === context.viewerId) {
    score -= OWN_POST_PENALTY;
  }
  return score;
}

export function rankFeed(posts: readonly FeedPost[], context: RankContext): FeedPost[] {
  const now = context.now ?? new Date();
  const scored = posts.map((post) => ({ post, score: scorePost(post, { ...context, now }) }));
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // stable tiebreak: newest first
    return new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime();
  });
  return scored.map((entry) => entry.post);
}
