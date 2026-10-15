import { Stack } from "expo-router";
import * as React from "react";
import { Platform, View } from "react-native";

import { Button, Text } from "@studio/ui";

type SheetHeaderOptions = {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
};

const HIDE_NATIVE = { headerShown: false } as const;

/**
 * In-sheet toolbar: Cancel, title, Save. Drawn in the content (native header hidden) like the add sheet,
 * because iOS 26 form sheets with a native header rendered the body blank.
 */
export function useSheetHeader({
  title,
  onCancel,
  onSave,
  saveDisabled = false,
  saveLabel = "Save",
}: SheetHeaderOptions): React.ReactElement {
  return (
    <>
      <Stack.Screen options={HIDE_NATIVE} />
      <View
        className="h-12 flex-row items-center bg-bg px-2"
        style={{ marginTop: Platform.OS === "ios" ? 8 : 0 }}
      >
        <Button
          variant="barSecondary"
          size="sm"
          onPress={onCancel}
          accessibilityLabel="Cancel"
        >
          <Text variant="body">Cancel</Text>
        </Button>
        <Text
          variant="headline"
          accessibilityRole="header"
          numberOfLines={1}
          className="mx-2 min-w-0 flex-1 text-center"
        >
          {title}
        </Text>
        <Button
          variant="barPrimary"
          size="sm"
          disabled={saveDisabled}
          onPress={onSave}
          accessibilityLabel={saveLabel}
        >
          <Text
            variant="headline"
            style={saveDisabled ? { opacity: 0.4 } : undefined}
          >
            {saveLabel}
          </Text>
        </Button>
      </View>
    </>
  );
}
