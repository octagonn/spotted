import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

type EmptyStateProps = {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
};

export function EmptyState({ title, body, action, onAction }: EmptyStateProps) {
  return (
    <View className="min-h-[420px] justify-end rounded-card border border-hairline-strong bg-glass-strong p-6">
      <Text variant="display-md">{title}</Text>
      <Text variant="italic" className="mt-5 max-w-[260px]">
        {body}
      </Text>
      {action ? (
        <Button className="mt-8 self-start" onPress={onAction}>
          {action}
        </Button>
      ) : null}
    </View>
  );
}
