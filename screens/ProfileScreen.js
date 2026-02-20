import React, { useState, useCallback } from 'react'; // added useCallback
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase'; //added -- link to DB
import { colors, typography, spacing } from '../theme';

export default function ProfileScreen({ navigation }) {
  // replaced useState(USER_DATA) with real state initialized as null/empty
  const [user, setUser] = useState(null);
  const [recentBooks, setRecentBooks] = useState([]);
  const [stats, setStats] = useState({
    booksRead: 0,
    pagesRead: 0,
    currentStreak: 0,
    totalAnnotations: 0,
  });

  // fetch real user data from Supabase when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        // Fetch profile from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', authUser.id)
          .single();

        // Build user object to match same shape the UI already expects
        setUser({
          name: profileData?.display_name || profileData?.username || 'Reader',
          username: `@${profileData?.username || 'reader'}`,
          email: authUser.email,
          bio: profileData?.bio || '',
          avatar: profileData?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData?.display_name || profileData?.username || 'Reader')}&size=200&background=4A4A4A&color=fff`,
          joinDate: new Date(authUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        });

        // Fetch user_books joined with books for stats + recent activity
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
          // Calculate stats from real data
          const completed = userBooks.filter(b => b.status === 'completed');
          const pagesRead = completed.reduce((sum, b) => sum + (b.books?.page_count || 0), 0);

          setStats({
            booksRead: completed.length,
            pagesRead,
            currentStreak: 0,       // pending until streak logic is built
            totalAnnotations: 0,    // pending until annotations are wired up
          });

          // Show 3 most recent books in activity section
          setRecentBooks(userBooks.slice(0, 3));
        }
      };
      fetchData();
    }, [])
  );

  //  handlers, StatCard, and JSX 
  const handleEditProfile = () => {
    alert('Edit Profile coming soon!\n\nYou\'ll be able to:\n• Update your photo\n• Edit your bio\n• Change preferences');
  };

  const handleSettings = () => {
    alert('Settings coming soon!');
  };

  const StatCard = ({ icon, label, value, color = colors.primary }) => (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {/*user.avatar → user?.avatar (safe access since user starts as null) */}
          <Image source={{ uri: user?.avatar }} style={styles.avatar} />
          <TouchableOpacity style={styles.editAvatarButton}>
            <Ionicons name="camera" size={16} color={colors.buttonText} />
          </TouchableOpacity>
        </View>
        
        {/*user.name → user?.name with fallback (safe access) */}
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

      {/* use real stats state */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reading Stats</Text>
        <View style={styles.statsGrid}>
          <StatCard 
            icon="book" 
            label="Books Read" 
            value={stats.booksRead} // change was user.stats.booksRead
            color={colors.buttonPrimary}
          />
          <StatCard 
            icon="document-text" 
            label="Pages Read" 
            value={stats.pagesRead.toLocaleString()} // change - user.stats.pagesRead
            color={colors.buttonPrimary}
          />
          <StatCard 
            icon="flame" 
            label="Day Streak" 
            value={stats.currentStreak} // change - user.stats.currentStreak
            color="#FF6B35"
          />
          <StatCard 
            icon="bookmark" 
            label="Annotations" 
            value={stats.totalAnnotations} // change - user.stats.totalAnnotations
            color={colors.buttonPrimary}
          />
        </View>
      </View>

      {/* Recent Activity — maps over real recentBooks from Supabase */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {/* change - uses real recentBooks state */}
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
                {/* change - book.cover → book?.cover_url (new column name from DB) */}
                <Image source={{ uri: book?.cover_url }} style={styles.activityCover} />
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{book?.title}</Text>
                  {/* change - book.author → authors (handles array from DB) */}
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

      {/* Annotations keeping until annotations feature is built */}
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
            I- what???!!!!
          </Text>
        </View>
      </View>

      {/* Account Info — real user?.email and user?.joinDate */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={20} color={colors.secondary} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || ''}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={20} color={colors.secondary} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>{user?.joinDate || ''}</Text>
          </View>
        </View>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
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
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.buttonPrimary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
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
    backgroundColor: colors.surface,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
});