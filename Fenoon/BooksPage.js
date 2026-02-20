import React, { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";

import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import theme from "../theme";
import { supabase } from "../Fenoon/lsupabase";

const { colors, typography, spacing } = theme;
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

const CATEGORIES = [
  { key: "horror", label: "Horror", query: "subject:horror" },
  { key: "fiction", label: "Fiction", query: "subject:fiction" },
  { key: "romance", label: "Romance", query: "subject:romance" },
  { key: "mystery", label: "Mystery", query: "subject:mystery" },
  { key: "fantasy", label: "Fantasy", query: "subject:fantasy" },
  { key: "scifi", label: "Sci-Fi", query: "subject:science fiction" },
];

function normalizeCover(url) {
  if (!url) return "https://via.placeholder.com/140x210?text=No+Cover";
  return url.replace("http://", "https://");
}

function toBookCard(item) {
  //preview
 // const previewLink = info.previewLink || null;
  //const webReaderLink = item.accessInfo?.webReaderLink || null;
  const info = item.volumeInfo || {};
  const access = item.accessInfo || {};

  const title = info.title || "Untitled";
  const author =
    Array.isArray(info.authors) && info.authors.length > 0 ? info.authors[0] : "Unknown author";
  const cover = normalizeCover(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail);
  const pages = info.pageCount ?? 0;
  const rating = typeof info.averageRating === "number" ? info.averageRating : null;
  const ratingsCount = typeof info.ratingsCount === "number" ? info.ratingsCount : 0;

  return {
    id: item.id,
    title,
    author,
    cover,
    pages,
    rating,
    ratingsCount,

    previewLink: info.previewLink ?? null,
    webReaderLink: access.webReaderLink ?? null,
    //viewability: access.viewability ?? null,
  };
}

async function googleBooksSearch(query) {
  if (!API_KEY) throw new Error("Missing EXPO_PUBLIC_GOOGLE_BOOKS_KEY (restart Expo after setting)");

  const url =
    "https://www.googleapis.com/books/v1/volumes?q=" +
    encodeURIComponent(query) +
    "&printType=books&maxResults=12&orderBy=relevance&key=" +
    encodeURIComponent(API_KEY);

  const res = await fetch(url);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.error?.message ?? "Google Books error";
    throw new Error(msg);
  }

  return (data?.items ?? []).map(toBookCard);
}

function SectionRow({
  title,
  books,
  loading,
  error,
  onSeeAll,
  onPressBook,
  onBeginReading,
  listKey = "list",
}) {
  //return (
    return (
      
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>

        <TouchableOpacity onPress={onSeeAll} disabled={!books?.length}>
          <Text style={[styles.seeAllText, !books?.length && { opacity: 0.4 }]}>
            See All
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.rowStatus}>
          <ActivityIndicator />
          <Text style={styles.rowStatusText}>Loading…</Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
        >
          {books.map((b, idx) => (
            <TouchableOpacity
              key={`${listKey}-${b.id}-${idx}`}
              style={styles.bookCard}
              onPress={() => onPressBook?.(b)}   
              activeOpacity={0.85}
            >
              <Image source={{ uri: b.cover }} style={styles.bookCover} />

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {b.title}
                </Text>

                <Text style={styles.cardAuthor} numberOfLines={1}>
                  {b.author}
                </Text>

                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {b.pages ? `${b.pages} pages` : "Pages N/A"}
                  </Text>

                  {typeof b.rating === "number" ? (
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color="#f5c400" />
                      <Text style={styles.cardRating} numberOfLines={1}>
                        {b.rating.toFixed(2)}
                        {b.ratingsCount ? ` (${b.ratingsCount})` : ""}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noRating} numberOfLines={1}>
                      No ratings yet
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.beginBtn}
                  onPress={() => onBeginReading?.(b)}
                >
                  <Text style={styles.beginBtnText}>Begin Reading</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
   
   
const testSupabaseWrite = async () => {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return Alert.alert("No user");

  const { error } = await supabase.from("books").insert({
    google_volume_id: "TEST-" + Date.now(),
    title: "Test Book",
  });

  Alert.alert(error ? "DB failed" : "DB ok", error?.message ?? "Inserted");
};

export default function BooksPage() {
  const [previewUrl, setPreviewUrl] = useState(null);
  //console.log("GOOGLE BOOKS KEY?", process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY);
  const [query, setQuery] = useState("");
  const [searchBooks, setSearchBooks] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [categoryBooks, setCategoryBooks] = useState({});
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryErrors, setCategoryErrors] = useState({});

  const hasSearch = useMemo(() => query.trim().length > 0, [query]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setCategoryLoading(true);
        const booksMap = {};
        const errMap = {};

        for (const cat of CATEGORIES) {
          try {
            await new Promise((r) => setTimeout(r, 200));
            const items = await googleBooksSearch(cat.query);
            booksMap[cat.key] = items;
            errMap[cat.key] = "";
          } catch (e) {
            booksMap[cat.key] = [];
            errMap[cat.key] = e.message || "Failed to load";
          }
          if (!mounted) break;
        }

        if (!mounted) return;
        setCategoryBooks(booksMap);
        setCategoryErrors(errMap);
      } finally {
        if (mounted) setCategoryLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const onSearch = async () => {
    const q = query.trim();
    if (!q) return;

    try {
      setSearchLoading(true);
      setSearchError("");
      setSearchBooks([]);

      const items = await googleBooksSearch(`intitle:${q}`);
      setSearchBooks(items);
    } catch (e) {
      setSearchError(e.message || "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };


  const onPressBook = async (book) => {
    //Alert.alert("Selected", `${book.title}\nby ${book.author}`);
  const url = book.webReaderLink || book.previewLink;

  if (!url) {
    Alert.alert("No preview available");
    return;
  }

  setPreviewUrl(url);
};

    
  

  const onBeginReading = async (b) => {
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) {
        Alert.alert("Not signed in", "Please sign in to save books.");
        return;
      }

      const bookRow = {
        google_volume_id: b.id,
        title: b.title,
        authors: b.author && b.author !== "Unknown author" ? [b.author] : null,
        cover_url: b.cover,
        page_count: b.pages || null,
      };

      const { data: bookData, error: bookErr } = await supabase
        .from("books")
        .upsert(bookRow, { onConflict: "google_volume_id" })
        .select("id")
        .single();

      if (bookErr) throw bookErr;

      const { error: linkErr } = await supabase
        .from("saved_books")
        .insert({ user_id: user.id, book_id: bookData.id });

      if (linkErr) {
        if (linkErr.code === "23505") {
          Alert.alert("Already saved", `"${b.title}" is already in your profile.`);
          return;
        }
        throw linkErr;
      }

      Alert.alert("Saved!", `"${b.title}" is now in your profile.`);
    } catch (e) {
      Alert.alert("Save failed", e?.message ?? "Unknown error");
    }
  };
  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Books</Text>
          <Text style={styles.subtitle}>Browse by category or search</Text>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={colors.secondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search books (title, author, ISBN)…"
              placeholderTextColor={colors.secondary}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={onSearch}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={onSearch} disabled={!hasSearch}>
              <Text style={[styles.searchBtnText, !hasSearch && { opacity: 0.4 }]}>Go</Text>
            </TouchableOpacity>
          </View>

          {(searchLoading || searchError || searchBooks.length > 0) && (
            <SectionRow
              title="Search Results"
              books={searchBooks}
              loading={searchLoading}
              error={searchError}
              onSeeAll={() => {}}
              onPressBook={onPressBook}
              listKey="search"
              onBeginReading={onBeginReading}
            />
          )}

          {CATEGORIES.map((cat) => (
            <SectionRow
              key={cat.key}
              title={cat.label}
              books={categoryBooks[cat.key] || []}
              loading={categoryLoading}
              error={categoryErrors[cat.key] || ""}
              onSeeAll={() => {}}
              onPressBook={onPressBook}
              listKey={cat.key}
              onBeginReading={onBeginReading}
            />
          ))}
        </View>
      </ScrollView>

      <Modal
  visible={!!previewUrl}
  animationType="slide"
  onRequestClose={() => setPreviewUrl(null)}
>
  <View style={{ flex: 1, backgroundColor: "black" }}>
    
    {/* WebView FIRST */}
    {previewUrl ? (
      <WebView source={{ uri: previewUrl }} style={{ flex: 1 }} />
    ) : null}

    {/* Close Button OVERLAY */}
    <TouchableOpacity
      onPress={() => setPreviewUrl(null)}
      style={{
        position: "absolute",
        top: 50,
        right: 20,
        backgroundColor: "rgba(0,0,0,0.7)",
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
      }}
    >
      <Text style={{ color: "white", fontWeight: "bold" }}>
        ✕ Close
      </Text>
    </TouchableOpacity>

  </View>
</Modal>
    </>
  );
} 

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingVertical: spacing.lg },

  title: {
    fontSize: typography.fontSizes.xxxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.primary,
    fontSize: typography.fontSizes.base,
    paddingVertical: 6,
  },
  searchBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.buttonPrimary,
    borderRadius: 10,
  },
  searchBtnText: { color: colors.buttonText, fontWeight: typography.fontWeights.semibold },

  section: { marginTop: spacing.xl },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
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

  rowStatus: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.lg },
  rowStatusText: { color: colors.secondary },
  errorText: { color: "#B00020", paddingHorizontal: spacing.lg },

  horizontalScroll: { paddingLeft: spacing.lg },

  bookCard: {
    width: 170,
    marginRight: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookCover: { width: "100%", height: 220, backgroundColor: colors.surface },

  cardBody: {
    padding: spacing.md,
    flexDirection: "column",
    height: 175,
  },
  cardTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    lineHeight: 18,
    minHeight: 36,
  },
  cardAuthor: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 4 },

  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cardMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    flex: 1,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  cardRating: {
    marginLeft: 6,
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
  },
  noRating: {
    marginLeft: 8,
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    opacity: 0.7,
  },

  beginBtn: {
    marginTop: "auto",
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  beginBtnText: { color: colors.buttonText, fontWeight: typography.fontWeights.semibold },
});