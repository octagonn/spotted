type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "post_view"
  | "post_reaction"
  | "streak_break_friend"
  | "streak_milestone"
  | "dm"
  | "gym_arrival_friend";

type PushContext = {
  actorName?: string;
  gymName?: string;
  reaction?: string;
  messagePreview?: string;
  muscleGroup?: string;
  streakCount?: number;
};

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function pemToDer(pem: string) {
  const clean = pem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function formatPushPayload(type: NotificationType, context: PushContext) {
  const actorName = context.actorName ?? "Someone";
  if (type === "friend_request") {
    return { title: "New friend request", body: `${actorName} wants to add you` };
  }
  if (type === "friend_accepted") {
    return { title: "Friend added", body: `You and ${actorName} are now friends 💪` };
  }
  if (type === "post_view") {
    return { title: "Eyes on you 👀", body: `${actorName} viewed your pump drop` };
  }
  if (type === "post_reaction") {
    return { title: context.reaction ?? "Reaction", body: `${actorName} reacted to your drop` };
  }
  if (type === "streak_break_friend") {
    return {
      title: "💀 Streak broken",
      body: `${actorName} skipped ${context.muscleGroup ?? "training"} day. Streak ended at ${context.streakCount ?? 0}.`
    };
  }
  if (type === "streak_milestone") {
    return { title: `🔥 ${context.streakCount ?? 0}-day streak`, body: "Don't break it now." };
  }
  if (type === "dm") {
    return { title: actorName, body: context.messagePreview ?? "New message" };
  }
  return { title: "👀 At the gym", body: `${actorName} just got to ${context.gymName ?? "the gym"}` };
}

export async function apnsJwt() {
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");
  if (!teamId || !keyId || !privateKey) {
    throw new Error("missing_apns_env");
  }
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const signingInput = `${header}.${payload}`;
  const pem = new TextDecoder().decode(Uint8Array.from(atob(privateKey), (letter) => letter.charCodeAt(0)));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

export async function sendApns(deviceToken: string, payload: { title: string; body: string; data?: Record<string, unknown> }) {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  const environment = Deno.env.get("APNS_ENV") ?? "development";
  if (!bundleId) {
    throw new Error("missing_apns_bundle");
  }
  const host = environment === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const jwt = await apnsJwt();
  const response = await fetch(`${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: payload.title,
          body: payload.body
        },
        sound: "default"
      },
      data: payload.data ?? {}
    })
  });
  if (!response.ok) {
    throw new Error(`apns_${response.status}`);
  }
}
