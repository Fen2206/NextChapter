import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../theme';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [recentBooks, setRecentBooks] = useState([]);
  const [stats, setStats] = useState({
    booksRead: 0,
    pagesRead: 0,
    currentStreak: 0,
    totalAnnotations: 0,
  });

  // keep saved books state
  const [savedBooks, setSavedBooks] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // keep saved books fetch
  const fetchSavedBooks = useCallback(async () => {
    try {
      setLoadingSaved(true);
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;
      if (!currentUser) { setSavedBooks([]); return; }

      const { data, error } = await supabase
        .from('saved_books')
        .select(`created_at, books:book_id (id, title, cover_url, page_count)`)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSavedBooks((data ?? []).map((r) => r.books).filter(Boolean));
    } catch (e) {
      console.log('Profile fetch error:', e.message);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  // main profile + stats fetch, also triggers savedBooks refresh
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url, bio')
          .eq('id', authUser.id)
          .single();

        setUser({
          name: profileData?.display_name || profileData?.username || 'Reader',
          username: `@${profileData?.username || 'reader'}`,
          email: authUser.email,
          bio: profileData?.bio || '',
          avatar: profileData?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              profileData?.display_name || profileData?.username || 'Reader'
            )}&size=200&background=4A4A4A&color=fff`,
          joinDate: new Date(authUser.created_at).toLocaleDateString('en-US', {
            month: 'long', year: 'numeric',
          }),
        });

        const { data: userBooks } = await supabase
          .from('user_books')
          .select(`
            id,
            status,
            current_page,
            books (
              id,
              title,
              authors,
              cover_url,
              page_count
            )
          `)
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (userBooks) {
          const completed = userBooks.filter(b => b.status === 'completed');
          const pagesRead = completed.reduce((sum, b) => sum + (b.books?.page_count || 0), 0);
          setStats({
            booksRead: completed.length,
            pagesRead,
            currentStreak: 0,       // pending until streak logic is built
            totalAnnotations: 0,    // pending until annotations are wired up
          });
          setRecentBooks(userBooks.slice(0, 3));
        }

        // refresh saved books at the same time
        fetchSavedBooks();
      };
      fetchData();
    }, [fetchSavedBooks])
  );

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  const handleViewAllStats = () => {
    navigation.navigate('ReadingStats');
  };

  const StatCard = ({ icon, label, value, color = colors.primary }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ImageBackground source={require('../assets/background2.png')} style={styles.backgroundContainer} resizeMode="cover">
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {/* no camera button here — photo only editable via Edit Profile */}
          <Image source={{ uri: user?.avatar }} style={styles.avatar} />
        </View>

        <Text style={styles.name}>{user?.name || 'Reader'}</Text>
        <Text style={styles.username}>{user?.username || '@reader'}</Text>
        <Text style={styles.bio}>{user?.bio || ''}</Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleEditProfile}>
            <Ionicons name="create-outline" size={18} color={colors.buttonText} />
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleSettings}>
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Reading Stats */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reading Stats</Text>
          <TouchableOpacity onPress={handleViewAllStats}>
            <View style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon="book"
            label="Books Read"
            value={stats.booksRead}
            color={colors.buttonPrimary}
          />
          <StatCard
            icon="document-text"
            label="Pages Read"
            value={stats.pagesRead.toLocaleString()}
            color="#2196F3"
          />
          <StatCard
            icon="flame"
            label="Day Streak"
            value={stats.currentStreak}
            color="#FF6B35"
          />
          <StatCard
            icon="bookmark"
            value={stats.totalAnnotations}
            color="#9C27B0"
          />
        </View>
      </View>

      {/* Recent Activity — from user_books */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentBooks.length === 0 ? (
          <Text style={{ color: colors.secondary, fontSize: typography.fontSizes.sm }}>
            No recent activity yet.
          </Text>
        ) : (
          recentBooks.map((userBook) => {
            const book = userBook.books;
            const authors = Array.isArray(book?.authors)
              ? book.authors.join(', ')
              : book?.authors || '';
            return (
              <View key={userBook.id} style={styles.activityItem}>
                <Image source={{ uri: book?.cover_url }} style={styles.activityCover} />
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{book?.title}</Text>
                  <Text style={styles.activityAuthor}>{authors}</Text>
                  <View style={styles.statusBadge}>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor:
                        userBook.status === 'reading' ? '#4CAF50' :
                        userBook.status === 'completed' ? '#2196F3' :
                        '#FF9800'
                      }
                    ]} />
                    <Text style={styles.statusText}>
                      {userBook.status === 'reading' ? 'Currently Reading' :
                       userBook.status === 'completed' ? 'Completed' :
                       'Want to Read'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
              </View>
            );
          })
        )}
      </View>

      {/* Saved Books — teammate's feature */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved Books</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loadingSaved ? (
          <Text style={{ color: colors.secondary, fontSize: typography.fontSizes.sm }}>
            Loading…
          </Text>
        ) : savedBooks.length === 0 ? (
          <Text style={{ color: colors.secondary, fontSize: typography.fontSizes.sm }}>
            No saved books yet.
          </Text>
        ) : (
          savedBooks.map((book) => (
            <View key={book.id} style={styles.activityItem}>
              <Image source={{ uri: book.cover_url }} style={styles.activityCover} />
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle} numberOfLines={1}>{book.title}</Text>
                <Text style={styles.activityAuthor}>
                  {book.page_count ? `${book.page_count} pages` : 'Pages N/A'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
            </View>
          ))
        )}
      </View>

      {/* Annotations — keeping until annotations feature is built */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Annotations</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.annotationPreview}>
          <View style={styles.annotationHeader}>
            <Text style={styles.annotationBook}>The Housemaid</Text>
            <Text style={styles.annotationDate}>2 days ago</Text>
          </View>
          <Text style={styles.annotationText}>
            "Every day I clean the Winchesters' beautiful house top to bottom."
          </Text>
          <Text style={styles.annotationNote}>
            Great opening line, I'm already interested in what's going on.
          </Text>
        </View>

        <View style={styles.annotationPreview}>
          <View style={styles.annotationHeader}>
            <Text style={styles.annotationBook}>IT</Text>
            <Text style={styles.annotationDate}>5 days ago</Text>
          </View>
          <Text style={styles.annotationText}>
            "We all float down here."
          </Text>
          <Text style={styles.annotationNote}>
            I- no thank you.
          </Text>
        </View>
      </View>

      <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.buttonPrimary,
  },
  name: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  username: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    marginBottom: spacing.sm,
  },
  bio: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.66)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  viewAllText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },
  seeAllText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityCover: {
    width: 50,
    height: 75,
    borderRadius: 4,
    marginRight: spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  activityAuthor: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },
  annotationPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  annotationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  annotationBook: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  annotationDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },
  annotationText: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
    backgroundColor: colors.highlight,
    padding: spacing.sm,
    borderRadius: 4,
  },
  annotationNote: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },
});