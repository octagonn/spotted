import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

function localDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function localWeekday(date: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const supabase = serviceClient();
  const now = new Date();
  const previous = new Date(now.getTime() - 15 * 60 * 1000);
  const { data: profiles, error } = await supabase.from("profiles").select("id, timezone, display_name");
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  let processed = 0;
  for (const profile of profiles) {
    if (localDate(now, profile.timezone) === localDate(previous, profile.timezone)) {
      continue;
    }
    const scheduledDate = localDate(previous, profile.timezone);
    const weekday = localWeekday(previous, profile.timezone);
    const { data: schedule } = await supabase
      .from("workout_schedule")
      .select("muscle_groups")
      .eq("user_id", profile.id)
      .eq("day_of_week", weekday)
      .maybeSingle();
    if (!schedule || schedule.muscle_groups.length === 0 || schedule.muscle_groups.includes("Rest")) {
      continue;
    }
    const { data: checkins } = await supabase
      .from("checkins")
      .select("id")
      .eq("user_id", profile.id)
      .eq("verified", true)
      .gte("checked_in_at", `${scheduledDate}T00:00:00`)
      .lt("checked_in_at", `${localDate(now, profile.timezone)}T00:00:00`);
    if (checkins && checkins.length > 0) {
      continue;
    }
    const { data: streak } = await supabase.from("streaks").select("*").eq("user_id", profile.id).single();
    if (streak && streak.freeze_tokens > 0) {
      await supabase.from("streaks").update({ freeze_tokens: streak.freeze_tokens - 1 }).eq("user_id", profile.id);
      processed += 1;
      continue;
    }
    await supabase.from("streaks").update({ current_streak: 0 }).eq("user_id", profile.id);
    await supabase.from("skip_events").upsert({
      user_id: profile.id,
      scheduled_date: scheduledDate,
      muscle_groups_missed: schedule.muscle_groups,
      notified_friends: true
    });
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);
    const recipients = friendships?.map((friendship) => (friendship.user_id === profile.id ? friendship.friend_id : friendship.user_id)) ?? [];
    const notifications = recipients.map((recipient) => ({
      recipient_id: recipient,
      actor_id: profile.id,
      type: "streak_break_friend",
      payload: {
        actorName: profile.display_name,
        muscleGroup: schedule.muscle_groups[0],
        streakCount: streak?.current_streak ?? 0
      }
    }));
    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }
    processed += 1;
  }
  return jsonResponse({ processed });
});
