import * as RNIap from "react-native-iap";

import { supabase } from "@/lib/supabase";

export const products = {
  monthly: "com.octavio.spotted.plus.monthly",
  annual: "com.octavio.spotted.plus.annual",
  streakRevival: "com.octavio.spotted.streak_revival",
  dropSaver: "com.octavio.spotted.drop_saver",
  vintageIron: "com.octavio.spotted.theme_vintage_iron",
  neonLocker: "com.octavio.spotted.theme_neon_locker"
} as const;

export async function initIap() {
  await RNIap.initConnection();
  return RNIap.getProducts({ skus: Object.values(products) });
}

export async function requestSubscription(productId: string) {
  await RNIap.requestSubscription({ sku: productId });
}

export async function grantConsumable(productId: string, transactionId: string) {
  const { data, error } = await supabase.functions.invoke("grant-consumable", {
    body: { product_id: productId, transaction_id: transactionId }
  });
  if (error) {
    throw error;
  }
  return data;
}
