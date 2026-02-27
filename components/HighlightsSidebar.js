// HighlightsSidebar.js
// Sidebar/panel showing all highlights with filtering options

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { HIGHLIGHT_COLORS } from './HighlightColorPicker';

export default function HighlightsSidebar({ visible, highlights, onClose, onJumpToHighlight }) {
  const [slideAnim] = useState(new Animated.Value(300));
  const [selectedFilter, setSelectedFilter] = useState('all');

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const filteredHighlights = highlights.filter(h => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'notes') return h.note !== null;
    return h.colorName.toLowerCase() === selectedFilter.toLowerCase();
  });

  const highlightsByColor = HIGHLIGHT_COLORS.reduce((acc, color) => {
    acc[color.name] = highlights.filter(h => h.colorName === color.name).length;
    return acc;
  }, {});

  const notesCount = highlights.filter(h => h.note).length;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Sidebar */}
        <Animated.View
          style={[
            styles.sidebar,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Highlights & Notes</Text>
              <Text style={styles.headerSubtitle}>
                {highlights.length} highlight{highlights.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContainer}
          >
            <TouchableOpacity
              style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
              onPress={() => setSelectedFilter('all')}
            >
              <Text style={[
                styles.filterChipText,
                selectedFilter === 'all' && styles.filterChipTextActive
              ]}>
                All ({highlights.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, selectedFilter === 'notes' && styles.filterChipActive]}
              onPress={() => setSelectedFilter('notes')}
            >
              <Ionicons name="chatbox" size={14} color={
                selectedFilter === 'notes' ? colors.buttonText : colors.primary
              } />
              <Text style={[
                styles.filterChipText,
                selectedFilter === 'notes' && styles.filterChipTextActive
              ]}>
                Notes ({notesCount})
              </Text>
            </TouchableOpacity>

            {HIGHLIGHT_COLORS.map((color) => (
              <TouchableOpacity
                key={color.id}
                style={[
                  styles.filterChip,
                  selectedFilter === color.name && styles.filterChipActive,
                  selectedFilter === color.name && { backgroundColor: color.color }
                ]}
                onPress={() => setSelectedFilter(color.name)}
              >
                <View style={[styles.colorDot, { backgroundColor: color.color }]} />
                <Text style={[
                  styles.filterChipText,
                  selectedFilter === color.name && { color: color.textColor }
                ]}>
                  {color.name} ({highlightsByColor[color.name] || 0})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Highlights List */}
          <ScrollView style={styles.highlightsList} showsVerticalScrollIndicator={false}>
            {filteredHighlights.length > 0 ? (
              filteredHighlights.map((highlight) => (
                <HighlightCard
                  key={highlight.id}
                  highlight={highlight}
                  onPress={() => {
                    onJumpToHighlight(highlight);
                    onClose();
                  }}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={48} color={colors.border} />
                <Text style={styles.emptyTitle}>No highlights yet</Text>
                <Text style={styles.emptyText}>
                  Long press on text to create your first highlight
                </Text>
              </View>
            )}

            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Individual Highlight Card Component
function HighlightCard({ highlight, onPress }) {
  return (
    <TouchableOpacity
      style={styles.highlightCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Color Indicator */}
      <View style={[styles.colorIndicator, { backgroundColor: highlight.color }]} />

      {/* Content */}
      <View style={styles.highlightContent}>
        {/* Highlighted Text */}
        <View style={[styles.highlightTextContainer, { backgroundColor: highlight.color }]}>
          <Text style={styles.highlightText} numberOfLines={4}>
            {highlight.text}
          </Text>
        </View>

        {/* Note (if exists) */}
        {highlight.note && (
          <View style={styles.noteContainer}>
            <Ionicons name="chatbox" size={14} color={colors.secondary} />
            <Text style={styles.noteText} numberOfLines={2}>
              {highlight.note}
            </Text>
          </View>
        )}

        {/* Timestamp */}
        <Text style={styles.timestamp}>
          {new Date(highlight.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    width: 320,
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  closeButton: {
    padding: spacing.xs,
  },

  // Filters
  filterScroll: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  filterChipText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  filterChipTextActive: {
    color: colors.buttonText,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  // Highlights List
  highlightsList: {
    flex: 1,
  },
  highlightCard: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colorIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  highlightContent: {
    flex: 1,
  },
  highlightTextContainer: {
    padding: spacing.sm,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  highlightText: {
    fontSize: typography.fontSizes.sm,
    lineHeight: typography.lineHeights.relaxed * typography.fontSizes.sm,
    color: colors.primary,
  },
  noteContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    textAlign: 'center',
  },
});