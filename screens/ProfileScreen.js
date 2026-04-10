import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../theme';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [recentBooks, setRecentBooks] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({
    booksRead: 0,
    pagesRead: 0,
    currentStreak: 0,
    totalAnnotations: 0,
  });

  const avatarFallback =
    'https://ui-avatars.com/api/?name=Reader&size=200&background=4A4A4A&color=fff';

  const fetchProfileEverything = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user: authUser },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr) throw authErr;

      if (!authUser) {
        setUser(null);
        setRecentBooks([]);
        setRecentNotes([]);
        setStats({
          booksRead: 0,
          pagesRead: 0,
          currentStreak: 0,
          totalAnnotations: 0,
        });
        return;
      }

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, bio')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      const displayName =
        profileData?.display_name || profileData?.username || 'Reader';
      const username = `@${profileData?.username || 'reader'}`;

      setUser({
        name: displayName,
        username,
        email: authUser.email ?? '',
        bio: profileData?.bio || '',
        avatar:
          profileData?.avatar_url ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            displayName
          )}&size=200&background=4A4A4A&color=fff`,
        joinDate: authUser.created_at
          ? new Date(authUser.created_at).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })
          : '',
      });

      const { count: hlCount, error: hlErr } = await supabase
        .from('highlights')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authUser.id);

      if (hlErr) console.log('Highlights count error:', hlErr.message);

      const { count: annCount, error: annErr } = await supabase
        .from('annotations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authUser.id);

      if (annErr) console.log('Annotations count error:', annErr.message);

      const { data: allUserBooks, error: allUserBooksErr } = await supabase
        .from('user_books')
        .select(`
          id,
          status,
          current_page,
          created_at,
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

      if (allUserBooksErr) throw allUserBooksErr;

      const completed = (allUserBooks ?? []).filter(
        (r) => r.status === 'completed'
      );

      const booksRead = completed.length;

      const pagesRead = (allUserBooks ?? []).reduce((sum, r) => {
        const total = Number(r.books?.page_count ?? 0);
        const current = Number(r.current_page ?? 0);

        if (r.status === 'completed') {
          return sum + (total || current || 0);
        }

        if (current > 0) {
          return sum + (total > 0 ? Math.min(current, total) : current);
        }

        return sum;
      }, 0);

      setStats({
        booksRead,
        pagesRead,
        currentStreak: annCount ?? 0,
        totalAnnotations: hlCount ?? 0,
      });

      setRecentBooks((allUserBooks ?? []).slice(0, 3));

      const { data: anns, error: aErr } = await supabase
        .from('annotations')
        .select('id, highlight_id, body, created_at')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (aErr) {
        console.log('Recent annotations fetch error:', aErr.message);
        setRecentNotes([]);
      } else {
        const highlightIds = (anns ?? [])
          .map((a) => a.highlight_id)
          .filter(Boolean);

        let mergedNotes = [];

        if (highlightIds.length) {
          const { data: hls, error: hErr } = await supabase
            .from('highlights')
            .select(
              'id, book_id, chapter, page, text_snippet, start_offset, end_offset'
            )
            .in('id', highlightIds);

          if (hErr) console.log('Highlights fetch error:', hErr.message);

          const hlMap = new Map((hls ?? []).map((h) => [h.id, h]));
          const bookIds = [
            ...new Set((hls ?? []).map((h) => h.book_id).filter(Boolean)),
          ];

          const { data: books, error: bErr } = bookIds.length
            ? await supabase
                .from('books')
                .select('id, title, cover_url, authors, page_count')
                .in('id', bookIds)
            : { data: [], error: null };

          if (bErr) console.log('Books for annotations fetch error:', bErr.message);

          const bookMap = new Map((books ?? []).map((bk) => [bk.id, bk]));

          mergedNotes = (anns ?? [])
            .map((a) => {
              const hl = hlMap.get(a.highlight_id);
              const bk = hl ? bookMap.get(hl.book_id) : null;
              if (!hl || !bk) return null;
              return { ...a, highlight: hl, book: bk };
            })
            .filter(Boolean);
        }

        setRecentNotes(mergedNotes);
      }
    } catch (e) {
      console.log('Profile fetch error:', e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfileEverything();
      return () => {};
    }, [fetchProfileEverything])
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
      <View
        style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ImageBackground
      source={require('../assets/background2.png')}
      style={styles.backgroundContainer}
      resizeMode="cover"
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: user?.avatar || avatarFallback }}
              style={styles.avatar}
              onError={() => {
                setUser((prev) =>
                  prev ? { ...prev, avatar: avatarFallback } : prev
                );
              }}
            />
          </View>

          <Text style={styles.name}>{user?.name || 'Reader'}</Text>
          <Text style={styles.username}>{user?.username || '@reader'}</Text>
          <Text style={styles.bio}>{user?.bio || ''}</Text>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleEditProfile}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={colors.buttonText}
              />
              <Text style={styles.primaryButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSettings}
            >
              <Ionicons
                name="settings-outline"
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reading Stats</Text>
            <TouchableOpacity onPress={handleViewAllStats}>
              <View style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.secondary}
                />
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
              icon="create"
              label="Annotations"
              value={stats.currentStreak}
              color="#FF6B35"
            />
            <StatCard
              icon="bookmark"
              label="Highlights"
              value={stats.totalAnnotations}
              color="#9C27B0"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <Text style={styles.mutedText}>Loading…</Text>
          ) : recentNotes.length === 0 && recentBooks.length === 0 ? (
            <Text style={styles.mutedText}>No recent activity yet.</Text>
          ) : (
            <>
              {recentNotes.map((item) => {
                const book = item.book;
                return (
                  <View key={`ann:${item.id}`} style={styles.activityItem}>
                    <Image
                      source={{ uri: book?.cover_url || avatarFallback }}
                      style={styles.activityCover}
                    />
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {book?.title || 'Untitled'}
                      </Text>
                      <Text style={styles.activityAuthor} numberOfLines={2}>
                        Page {item.highlight?.page ?? '?'} • {item.body}
                      </Text>
                      <Text style={styles.progressText} numberOfLines={2}>
                        “{item.highlight?.text_snippet || ''}”
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.secondary}
                    />
                  </View>
                );
              })}

              {recentBooks.map((row) => {
                const book = row.books;
                const authors = Array.isArray(book?.authors)
                  ? book.authors.join(', ')
                  : book?.authors || '';

                const statusColor =
                  row.status === 'reading'
                    ? '#4CAF50'
                    : row.status === 'completed'
                    ? '#2196F3'
                    : '#FF9800';

                const statusText =
                  row.status === 'reading'
                    ? 'Currently Reading'
                    : row.status === 'completed'
                    ? 'Completed'
                    : 'Want to Read';

                return (
                  <View key={`book:${row.id}`} style={styles.activityItem}>
                    <Image
                      source={{ uri: book?.cover_url || avatarFallback }}
                      style={styles.activityCover}
                    />
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {book?.title || 'Untitled'}
                      </Text>
                      <Text style={styles.activityAuthor} numberOfLines={1}>
                        {authors ||
                          (book?.page_count
                            ? `${book.page_count} pages`
                            : 'Pages N/A')}
                      </Text>

                      <View style={styles.statusBadge}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusColor },
                          ]}
                        />
                        <Text style={styles.statusText}>{statusText}</Text>
                      </View>

                      {!!row.current_page && (
                        <Text style={styles.progressText}>
                          Page {row.current_page}
                          {book?.page_count ? ` / ${book.page_count}` : ''}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.secondary}
                    />
                  </View>
                );
              })}
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Annotations</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <Text style={styles.mutedText}>Loading…</Text>
          ) : recentNotes.length === 0 ? (
            <Text style={styles.mutedText}>No annotations yet.</Text>
          ) : (
            recentNotes.map((item) => (
              <View key={`preview:${item.id}`} style={styles.annotationPreview}>
                <View style={styles.annotationHeader}>
                  <Text style={styles.annotationBook} numberOfLines={1}>
                    {item.book?.title || 'Untitled'}
                  </Text>
                  <Text style={styles.annotationDate}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : ''}
                  </Text>
                </View>
                <Text style={styles.annotationText}>
                  “{item.highlight?.text_snippet || ''}”
                </Text>
                <Text style={styles.annotationNote}>
                  {item.body || 'No note body'}
                </Text>
              </View>
            ))
          )}
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
  mutedText: {
    color: colors.secondary,
    fontSize: typography.fontSizes.sm,
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
  progressText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: spacing.xs,
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
    flex: 1,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginRight: spacing.sm,
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