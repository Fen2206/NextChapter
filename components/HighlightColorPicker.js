// HighlightColorPicker.js
// Color picker component that appears when user selects text

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

// Highlight color options
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', name: 'Yellow', color: '#FFF59D', textColor: '#000000' },
  { id: 'green', name: 'Green', color: '#A5D6A7', textColor: '#000000' },
  { id: 'blue', name: 'Blue', color: '#90CAF9', textColor: '#000000' },
  { id: 'pink', name: 'Pink', color: '#F48FB1', textColor: '#000000' },
  { id: 'purple', name: 'Purple', color: '#CE93D8', textColor: '#000000' },
];

export default function HighlightColorPicker({ 
  visible, 
  onSelectColor, 
  onAddNote,
  onCancel,
  position = { x: 0, y: 0 } 
}) {
  const [scaleAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={[styles.container, { top: position.y, left: position.x }]}>
      <Animated.View 
        style={[
          styles.picker,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: scaleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0]
              })}
            ]
          }
        ]}
      >
        {/* Color Options */}
        <View style={styles.colorRow}>
          {HIGHLIGHT_COLORS.map((colorOption) => (
            <TouchableOpacity
              key={colorOption.id}
              style={[styles.colorButton, { backgroundColor: colorOption.color }]}
              onPress={() => onSelectColor(colorOption)}
              activeOpacity={0.7}
            >
              <View style={styles.colorInner} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onAddNote}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={styles.actionText}>Add Note</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Ionicons name="close-outline" size={20} color={colors.secondary} />
            <Text style={styles.actionTextSecondary}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Arrow pointing to selected text */}
      <View style={styles.arrow} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  picker: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 280,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  colorInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  actionText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  actionTextSecondary: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.secondary,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  arrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.surface,
  },
});