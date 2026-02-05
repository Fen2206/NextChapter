import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, typography, spacing } from '../theme';

export default function CommunityScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>
          Book clubs and discussion threads
        </Text>
        
        {/* Placeholder for book clubs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Book Clubs</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Book clubs you've joined will appear here
            </Text>
          </View>
        </View>

        {/* Placeholder for discover clubs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discover Book Clubs</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Browse and join new book clubs
            </Text>
          </View>
        </View>

        {/* Placeholder for recent discussions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Discussions</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Recent chapter discussions will appear here
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSizes.xxxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  placeholder: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    textAlign: 'center',
  },
});