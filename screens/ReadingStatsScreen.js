import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Sample data, come from your API later
const STATS_DATA = {
  overview: {
    booksRead: 12,
    pagesRead: 4250,
    currentStreak: 7,
    totalAnnotations: 34,
    readingGoal: 24,
    hoursRead: 42.5,
    averagePagesPerDay: 45,
  },
  monthlyProgress: [
    { month: 'Jan', books: 2, pages: 650 },
    { month: 'Feb', books: 1, pages: 380 },
    { month: 'Mar', books: 3, pages: 920 },
    { month: 'Apr', books: 2, pages: 710 },
    { month: 'May', books: 1, pages: 450 },
    { month: 'Jun', books: 3, pages: 1140 },
  ],
  genreBreakdown: [
    { genre: 'Fiction', count: 5, color: '#4CAF50' },
    { genre: 'Mystery', count: 3, color: '#2196F3' },
    { genre: 'Fantasy', count: 2, color: '#9C27B0' },
    { genre: 'Non-Fiction', count: 1, color: '#FF9800' },
    { genre: 'Romance', count: 1, color: '#E91E63' },
  ],
  readingTime: {
    morning: 15,    // percentage
    afternoon: 25,
    evening: 45,
    night: 15,
  },
};

export default function ReadingStatsScreen({ navigation }) {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  
  const goalProgress = (STATS_DATA.overview.booksRead / STATS_DATA.overview.readingGoal) * 100;
  const maxPages = Math.max(...STATS_DATA.monthlyProgress.map(m => m.pages));

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reading Statistics</Text>
        <Text style={styles.headerSubtitle}>Track your reading journey</Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('week')}
        >
          <Text style={[styles.periodButtonText, selectedPeriod === 'week' && styles.periodButtonTextActive]}>
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('month')}
        >
          <Text style={[styles.periodButtonText, selectedPeriod === 'month' && styles.periodButtonTextActive]}>
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'year' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('year')}
        >
          <Text style={[styles.periodButtonText, selectedPeriod === 'year' && styles.periodButtonTextActive]}>
            Year
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reading Goal Card */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>2026 Reading Goal</Text>
          <TouchableOpacity>
            <Ionicons name="pencil" size={20} color={colors.secondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalProgress}>
                {STATS_DATA.overview.booksRead} / {STATS_DATA.overview.readingGoal}
              </Text>
              <Text style={styles.goalLabel}>books read</Text>
            </View>
            <View style={styles.goalBadge}>
              <Text style={styles.goalPercentage}>{Math.round(goalProgress)}%</Text>
            </View>
          </View>
          
          <View style={styles.goalBarContainer}>
            <View style={styles.goalBar}>
              <View style={[styles.goalBarFill, { width: `${Math.min(goalProgress, 100)}%` }]} />
            </View>
          </View>
          
          <Text style={styles.goalMessage}>
            {goalProgress >= 100 
              ? '🎉 Congratulations! You reached your goal!' 
              : `${STATS_DATA.overview.readingGoal - STATS_DATA.overview.booksRead} more books to reach your goal`
            }
          </Text>
        </View>
      </View>

      {/* Quick Stats Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.quickStatsGrid}>
          <QuickStatCard
            icon="book"
            label="Books Read"
            value={STATS_DATA.overview.booksRead}
            color={colors.buttonPrimary}
          />
          <QuickStatCard
            icon="document-text"
            label="Pages Read"
            value={STATS_DATA.overview.pagesRead.toLocaleString()}
            color="#2196F3"
          />
          <QuickStatCard
            icon="time"
            label="Hours Read"
            value={STATS_DATA.overview.hoursRead}
            color="#9C27B0"
          />
          <QuickStatCard
            icon="flame"
            label="Day Streak"
            value={STATS_DATA.overview.currentStreak}
            color="#FF6B35"
          />
        </View>
      </View>

      {/* Monthly Progress Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly Progress</Text>
        <View style={styles.chartCard}>
          <View style={styles.chart}>
            {STATS_DATA.monthlyProgress.map((item, index) => {
              const height = (item.pages / maxPages) * 120;
              return (
                <View key={index} style={styles.chartColumn}>
                  <View style={styles.chartBarContainer}>
                    <Text style={styles.chartValue}>{item.books}</Text>
                    <View style={[styles.chartBar, { height }]}>
                      <View style={styles.chartBarInner} />
                    </View>
                  </View>
                  <Text style={styles.chartLabel}>{item.month}</Text>
                </View>
              );
            })}
          </View>
          
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.buttonPrimary }]} />
              <Text style={styles.legendText}>Pages read per month</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Genre Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Genre Breakdown</Text>
        <View style={styles.genreCard}>
          {/* Genre Bars */}
          <View style={styles.genreList}>
            {STATS_DATA.genreBreakdown.map((item, index) => {
              const totalBooks = STATS_DATA.genreBreakdown.reduce((sum, g) => sum + g.count, 0);
              const percentage = (item.count / totalBooks) * 100;
              
              return (
                <View key={index} style={styles.genreItem}>
                  <View style={styles.genreInfo}>
                    <View style={[styles.genreDot, { backgroundColor: item.color }]} />
                    <Text style={styles.genreLabel}>{item.genre}</Text>
                  </View>
                  
                  <View style={styles.genreBarSection}>
                    <View style={styles.genreBarContainer}>
                      <View 
                        style={[
                          styles.genreBar, 
                          { width: `${percentage}%`, backgroundColor: item.color }
                        ]} 
                      />
                    </View>
                    <Text style={styles.genreCount}>{item.count}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Reading Time Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>When You Read</Text>
        <View style={styles.timeCard}>
          {Object.entries(STATS_DATA.readingTime).map(([period, percentage], index) => (
            <View key={index} style={styles.timeItem}>
              <View style={styles.timeHeader}>
                <Ionicons 
                  name={
                    period === 'morning' ? 'sunny' :
                    period === 'afternoon' ? 'partly-sunny' :
                    period === 'evening' ? 'moon' : 'moon-outline'
                  } 
                  size={20} 
                  color={colors.secondary} 
                />
                <Text style={styles.timePeriod}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Text>
              </View>
              
              <View style={styles.timeBarContainer}>
                <View style={[styles.timeBar, { width: `${percentage}%` }]} />
              </View>
              
              <Text style={styles.timePercentage}>{percentage}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Additional Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Stats</Text>
        <View style={styles.additionalStatsCard}>
          <View style={styles.statRow}>
            <View style={styles.statRowLeft}>
              <Ionicons name="trending-up" size={20} color={colors.secondary} />
              <Text style={styles.statRowLabel}>Average pages per day</Text>
            </View>
            <Text style={styles.statRowValue}>{STATS_DATA.overview.averagePagesPerDay}</Text>
          </View>
          
          <View style={styles.statRowDivider} />
          
          <View style={styles.statRow}>
            <View style={styles.statRowLeft}>
              <Ionicons name="bookmark" size={20} color={colors.secondary} />
              <Text style={styles.statRowLabel}>Total annotations</Text>
            </View>
            <Text style={styles.statRowValue}>{STATS_DATA.overview.totalAnnotations}</Text>
          </View>
          
          <View style={styles.statRowDivider} />
          
          <View style={styles.statRow}>
            <View style={styles.statRowLeft}>
              <Ionicons name="calendar" size={20} color={colors.secondary} />
              <Text style={styles.statRowLabel}>Reading streak</Text>
            </View>
            <Text style={styles.statRowValue}>{STATS_DATA.overview.currentStreak} days</Text>
          </View>
        </View>
      </View>

      {/* Bottom Padding */}
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

// Quick Stat Card Component
const QuickStatCard = ({ icon, label, value, color }) => (
  <View style={styles.quickStatCard}>
    <View style={[styles.quickStatIcon, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.quickStatValue}>{value}</Text>
    <Text style={styles.quickStatLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xxxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  periodButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  periodButtonTextActive: {
    color: colors.buttonText,
  },

  // Section
  section: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },

  // Goal Card
  goalCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  goalProgress: {
    fontSize: typography.fontSizes.xxxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  goalLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  goalBadge: {
    backgroundColor: colors.buttonPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  goalPercentage: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.buttonText,
  },
  goalBarContainer: {
    marginBottom: spacing.md,
  },
  goalBar: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  goalBarFill: {
    height: '100%',
    backgroundColor: colors.buttonPrimary,
    borderRadius: 6,
  },
  goalMessage: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    textAlign: 'center',
  },

  // Quick Stats Grid
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickStatCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickStatValue: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  quickStatLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    textAlign: 'center',
  },

  // Chart
  chartCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    marginBottom: spacing.md,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBarContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  chartValue: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  chartBar: {
    width: 32,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBarInner: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.buttonPrimary,
  },
  chartLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: spacing.sm,
  },
  chartLegend: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },

  // Genre Breakdown
  genreCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreList: {
    gap: spacing.md,
  },
  genreItem: {
    gap: spacing.sm,
  },
  genreInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  genreDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  genreLabel: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  genreBarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  genreBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  genreBar: {
    height: '100%',
    borderRadius: 4,
  },
  genreCount: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    minWidth: 24,
    textAlign: 'right',
  },

  // Reading Time
  timeCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  timeItem: {
    gap: spacing.sm,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timePeriod: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  timeBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  timeBar: {
    height: '100%',
    backgroundColor: colors.buttonPrimary,
    borderRadius: 4,
  },
  timePercentage: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    textAlign: 'right',
  },

  // Additional Stats
  additionalStatsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  statRowLabel: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
  },
  statRowValue: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  statRowDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
});