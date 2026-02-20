import React from "react";
import { View, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

export default function ReaderScreen({ route }) {
  const { url } = route.params;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ uri: url }}
        startInLoadingState
        renderLoading={() => (
          <ActivityIndicator style={{ marginTop: 20 }} size="large" />
        )}
      />
    </View>
  );
}