import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import theme from "../theme";

const { colors, typography, spacing } = theme;

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);

  const [stats, setStats] = useState({
    booksRead: 0,
    pagesRead: 0,
    currentStreak: 0, // (keep 0 until you implement a sessions table)
    totalAnnotations: 0,
  });

  const [recentBooks, setRecentBooks] = useState([]);
  const [savedBooks, setSavedBooks] = useState([]);
  const [loading, setLoading] = useState(false);

  const avatarFallback = useMemo(() => {
    const displayName = user?.name || "Reader";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&size=200&background=4A4A4A&color=fff`;
  }, [user?.name]);

  const fetchProfileEverything = useCallback(async () => {
    try {
      setLoading(true);

      // 1) Auth
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const authUser = authData?.user;
      if (!authUser) {
        setUser(null);
        setRecentBooks([]);
        setSavedBooks([]);
        setStats({ booksRead: 0, pagesRead: 0, currentStreak: 0, totalAnnotations: 0 });
        return;
      }

      // 2) Profile
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url, bio")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileErr) console.log("Profile fetch error:", profileErr.message);

      const displayName = profileData?.display_name || profileData?.username || "Reader";
      const username = profileData?.username ? `@${profileData.username}` : "@reader";

      setUser({
        name: displayName,
        username,
        email: authUser.email ?? "",
        bio: profileData?.bio || "",
        avatar:
          profileData?.avatar_url ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&size=200&background=4A4A4A&color=fff`,
        joinDate: authUser.created_at
          ? new Date(authUser.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : "",
      });

      // 3) Total annotations (highlights count)
      const { count: hlCount, error: hlErr } = await supabase
        .from("highlights")
        .select("id", { count: "exact", head: true })
        .eq("user_id", authUser.id);

      if (hlErr) console.log("Highlights count error:", hlErr.message);

      
      const { data: allUserBooks, error: allUserBooksErr } = await supabase
        .from("user_books")
        .select(
          `
            id,
            status,
            current_page,
            books (
              id,
              page_count
            )
          `
        )
        .eq("user_id", authUser.id);

      if (allUserBooksErr) throw allUserBooksErr;

      const completed = (allUserBooks ?? []).filter((r) => r.status === "completed");
      const booksRead = completed.length;

      // Pages Read:
      
      const pagesRead = (allUserBooks ?? []).reduce((sum, r) => {
        const total = r.books?.page_count ?? 0;
        const cp = Number(r.current_page ?? 0);

        if (cp > 0) return sum + Math.min(cp, total || cp);
        if (r.status === "completed") return sum + (total || 0);
        return sum;
      }, 0);

      setStats((prev) => ({
        ...prev,
        booksRead,
        pagesRead,
        totalAnnotations: hlCount ?? 0,
      }));

      
      const { data: recentData, error: recentErr } = await supabase
        .from("user_books")
        .select(
          `
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
          `
        )
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(3);

      if (recentErr) throw recentErr;
      setRecentBooks(recentData ?? []);

      //saved books 
      const { data: savedData, error: savedErr } = await supabase
        .from("saved_books")
        .select(`created_at, books:book_id (id, title, cover_url, page_count, authors)`)
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (savedErr) throw savedErr;

      const books = (savedData ?? []).map((r) => r.books).filter(Boolean);
      setSavedBooks(books);
    } catch (e) {
      console.log("Profile fetch error:", e?.message ?? e);
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

  // NOTE: This will only work if "EditProfile" is registered in your navigator.
  const handleEditProfile = () => navigation.navigate("EditProfile");
  const handleSettings = () => alert("Settings coming soon!");
  const handleViewAllStats = () => navigation.navigate("ReadingStats");

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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: user?.avatar || avatarFallback }}
            style={styles.avatar}
            onError={() => {
              // If image fails, swap to fallback avatar
              setUser((prev) => (prev ? { ...prev, avatar: avatarFallback } : prev));
            }}
          />
          <TouchableOpacity style={styles.editAvatarButton} onPress={handleEditProfile}>
            <Ionicons name="camera" size={16} color={colors.buttonText} />
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>{user?.name || "Reader"}</Text>
        <Text style={styles.username}>{user?.username || "@reader"}</Text>
        {!!user?.bio && <Text style={styles.bio}>{user.bio}</Text>}

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
          <StatCard icon="book" label="Books Read" value={stats.booksRead} color={colors.buttonPrimary} />
          <StatCard
            icon="document-text"
            label="Pages Read"
            value={Number(stats.pagesRead || 0).toLocaleString()}
            color="#2196F3"
          />
          <StatCard icon="flame" label="Day Streak" value={stats.currentStreak} color="#FF6B35" />
          <StatCard icon="bookmark" label="Highlights" value={stats.totalAnnotations} color="#9C27B0" />
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

        {loading ? (
          <Text style={styles.mutedText}>Loading…</Text>
        ) : recentBooks.length === 0 ? (
          <Text style={styles.mutedText}>No recent activity yet.</Text>
        ) : (
          recentBooks.map((row) => {
            const book = row.books;
            const authors = Array.isArray(book?.authors) ? book.authors.join(", ") : book?.authors || "";

            const statusColor =
              row.status === "reading" ? "#4CAF50" : row.status === "completed" ? "#2196F3" : "#FF9800";
            const statusText =
              row.status === "reading" ? "Currently Reading" : row.status === "completed" ? "Completed" : "Want to Read";

            return (
              <View key={row.id} style={styles.activityItem}>
                <Image source={{ uri: book?.cover_url || avatarFallback }} style={styles.activityCover} />
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {book?.title || "Untitled"}
                  </Text>
                  <Text style={styles.activityAuthor} numberOfLines={1}>
                    {authors || (book?.page_count ? `${book.page_count} pages` : "Pages N/A")}
                  </Text>

                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={styles.statusText}>{statusText}</Text>
                  </View>

                  {!!row.current_page && (
                    <Text style={styles.progressText}>
                      Page {row.current_page}
                      {book?.page_count ? ` / ${book.page_count}` : ""}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
              </View>
            );
          })
        )}
      </View>

      {/* Saved Books */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved Books</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={styles.mutedText}>Loading…</Text>
        ) : savedBooks.length === 0 ? (
          <Text style={styles.mutedText}>No saved books yet.</Text>
        ) : (
          savedBooks.map((book) => (
            <View key={book.id} style={styles.activityItem}>
              <Image source={{ uri: book.cover_url || avatarFallback }} style={styles.activityCover} />
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {book.title}
                </Text>
                <Text style={styles.activityAuthor} numberOfLines={1}>
                  {book.page_count ? `${book.page_count} pages` : "Pages N/A"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
            </View>
          ))
        )}
      </View>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.secondary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || ""}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.secondary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>{user?.joinDate || ""}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  avatarContainer: { position: "relative", marginBottom: spacing.md },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.buttonPrimary,
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.buttonPrimary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
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
    textAlign: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  actionButtons: { flexDirection: "row", gap: spacing.sm },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
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
    justifyContent: "center",
    alignItems: "center",
  },

  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },

  viewAllButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  viewAllText: { fontSize: typography.fontSizes.sm, color: colors.secondary, fontWeight: typography.fontWeights.medium },
  seeAllText: { fontSize: typography.fontSizes.sm, color: colors.secondary, fontWeight: typography.fontWeights.medium },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: { fontSize: typography.fontSizes.xs, color: colors.secondary, textAlign: "center" },

  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityCover: { width: 50, height: 75, borderRadius: 4, marginRight: spacing.md },
  activityInfo: { flex: 1 },
  activityTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  activityAuthor: { fontSize: typography.fontSizes.sm, color: colors.secondary, marginBottom: spacing.xs },

  statusBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: typography.fontSizes.xs, color: colors.secondary },

  progressText: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: spacing.xs },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  infoDivider: { height: 1, backgroundColor: colors.border },
  infoText: { marginLeft: spacing.md, flex: 1 },
  infoLabel: { fontSize: typography.fontSizes.sm, color: colors.secondary, marginBottom: spacing.xs },
  infoValue: { fontSize: typography.fontSizes.base, color: colors.primary, fontWeight: typography.fontWeights.medium },

  mutedText: { color: colors.secondary, fontSize: typography.fontSizes.sm },
});