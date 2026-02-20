import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../theme";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../Fenoon/lsupabase";

// Sample user data
const USER_DATA = {
  name: 'Nicole Flanders',
  username: '@nicoleflanders',
  email: 'nicole@nextchapter.com',
  bio: 'Building NextChapter',
  avatar: 'https://ui-avatars.com/api/?name=Nicole+Flanders&size=200&background=4A4A4A&color=fff',
  joinDate: 'January 2026',
  stats: {
    booksRead: 0,
    pagesRead: 0,
    currentStreak: 0,
    totalAnnotations: 0,
  },
};

// Sample recent books
const RECENT_BOOKS = [
  {
    id: 1,
    title: 'The Housemaid',
    author: 'Freida McFadden',
    cover: 'https://covers.openlibrary.org/b/id/14653835-L.jpg',
    status: 'reading',
  },
  {
    id: 2,
    title: 'IT',
    author: 'Stephen King',
    cover: 'https://covers.openlibrary.org/b/isbn/9780451149510-L.jpg',
    status: 'completed',
  },
  {
    id: 3,
    title: 'The Hunger Games',
    author: 'Suzanne Collins',
    cover: 'https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg',
    status: 'want-to-read',
  },
];

export default function ProfileScreen({ navigation }) {
  //me 
  const [savedBooks, setSavedBooks] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  //me
  const [user, setUser] = useState(USER_DATA);

  const fetchSavedBooks = useCallback(async () => {
    try {
      setLoadingSaved(true);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setSavedBooks([]);
        return;
      }

      const { data, error } = await supabase
        .from("saved_books")
        .select(`created_at, books:book_id (id, title, cover_url, page_count)`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setSavedBooks((data ?? []).map((r) => r.books).filter(Boolean));
    } catch (e) {
      console.log("Profile fetch error:", e.message);
    } finally {
      setLoadingSaved(false);
    }
  }, []);
    useFocusEffect(
    useCallback(() => {
      fetchSavedBooks();
    }, [fetchSavedBooks])
  );


  const handleEditProfile = () => {
    // For editing the profile screen
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
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
          <TouchableOpacity style={styles.editAvatarButton}>
            <Ionicons name="camera" size={16} color={colors.buttonText} />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.bio}>{user.bio}</Text>
        
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
        <Text style={styles.sectionTitle}>Reading Stats</Text>
        <View style={styles.statsGrid}>
          <StatCard 
            icon="book" 
            label="Books Read" 
            value={user.stats.booksRead}
            color={colors.buttonPrimary}
          />
          <StatCard 
            icon="document-text" 
            label="Pages Read" 
            value={user.stats.pagesRead.toLocaleString()}
            color={colors.buttonPrimary}
          />
          <StatCard 
            icon="flame" 
            label="Day Streak" 
            value={user.stats.currentStreak}
            color="#FF6B35"
          />
          <StatCard 
            icon="bookmark" 
            label="Annotations" 
            value={user.stats.totalAnnotations}
            color={colors.buttonPrimary}
          />
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>
      {loadingSaved ? (
  <Text style={styles.username}>Loading…</Text>
) : savedBooks.length === 0 ? (
  <Text style={styles.username}>No saved books yet.</Text>
) : (
  savedBooks.map((book) => (
    <View key={book.id} style={styles.activityItem}>
      <Image source={{ uri: book.cover_url }} style={styles.activityCover} />
      <View style={styles.activityInfo}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {book.title}
        </Text>
        <Text style={styles.activityAuthor}>
          {book.page_count ? `${book.page_count} pages` : "Pages N/A"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
    </View>
  ))
)}

       {/* 
        {RECENT_BOOKS.map((book) => (
          <View key={book.id} style={styles.activityItem}>
            <Image source={{ uri: book.cover }} style={styles.activityCover} />
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle} numberOfLines={1}>{book.title}</Text>
              <Text style={styles.activityAuthor}>{book.author}</Text>
              <View style={styles.statusBadge}>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: 
                    book.status === 'reading' ? '#4CAF50' : 
                    book.status === 'completed' ? '#2196F3' : 
                    '#FF9800' 
                  }
                ]} >/
              
                <Text style={styles.statusText}>
                  {book.status === 'reading' ? 'Currently Reading' : 
                   book.status === 'completed' ? 'Completed' : 
                   'Want to Read'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
          </View>
        ))*/}
      </View>

      {/* Your Annotations */}
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

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={20} color={colors.secondary} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={20} color={colors.secondary} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>{user.joinDate}</Text>
          </View>
        </View>
      </View>

      {/* Bottom padding */}
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Header Section
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
  
  // Stats Section
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
  
  // Activity Section
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
  
  // Annotations Section
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
  
  // Account Info Section
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