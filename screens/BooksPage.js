import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
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
import { supabase } from "../lib/supabase";

const { colors, typography, spacing } = theme;
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

// categories to show from dataset (Supabase)
const CATEGORIES = [
  { key: "Horror", label: "Horror" },
  { key: "Fiction", label: "Fiction" },
  { key: "Romance", label: "Romance" },
  { key: "Mystery", label: "Mystery" },
  { key: "Fantasy", label: "Fantasy" },
  { key: "Science Fiction", label: "Sci-Fi" },
];

function normalizeCover(url) {
  if (!url) return "https://via.placeholder.com/140x210?text=No+Cover";
  return String(url).replace("http://", "https://");
}

function pickPreviewUrl(book) {
  return book?.webReaderLink || book?.previewLink || null;
}

// guttenberg search (public domain books with full text available)
async function gutendexSearch(query) {
  const url = "https://gutendex.com/books?search=" + encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Gutendex search failed");
  const data = await res.json();

  return (data?.results ?? []).slice(0, 12).map((b) => {
    const author = b.authors?.[0]?.name ?? "Unknown author";
    const cover = normalizeCover(b.formats?.["image/jpeg"]);

    //pull out text 
    const htmlUrl =
      b.formats?.["text/html; charset=utf-8"] ||
      b.formats?.["text/html"] ||
      null;

    const textUrl =
  b.formats?.["text/plain; charset=utf-8"] ||
  b.formats?.["text/plain"] ||
  null;

return {
  id: String(b.id),
  source: "gutenberg",
  title: b.title ?? "Untitled",
  author,
  cover,
  pages: 0,
  rating: null,
  ratingsCount: 0,
  isbn: null,
  previewLink: null,
  webReaderLink: null,

  textUrl,
};
  });
}

// google books search (preview available)
function toBookCardGoogle(item) {
  const info = item.volumeInfo || {};
  const access = item.accessInfo || {};

  const title = info.title || "Untitled";
  const author =
    Array.isArray(info.authors) && info.authors.length > 0
      ? info.authors[0]
      : "Unknown author";

  const cover = normalizeCover(
    info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail
  );

  let isbn = null;
  const ids = info.industryIdentifiers;
  if (Array.isArray(ids) && ids.length) {
    const isbn13 = ids.find((x) => x.type === "ISBN_13")?.identifier;
    const isbn10 = ids.find((x) => x.type === "ISBN_10")?.identifier;
    isbn = isbn13 || isbn10 || ids[0]?.identifier || null;
  }

  return {
    id: item.id,
    source: "google",
    title,
    author,
    cover,
    pages: info.pageCount ?? 0,
    rating: typeof info.averageRating === "number" ? info.averageRating : null,
    //ratingsCount: typeof info.ratingsCount === "number" ? info.ratingsCount : 0,
    isbn,
    previewLink: info.previewLink ?? null,
    webReaderLink: access.webReaderLink ?? null,
  };
}

async function googleBooksSearch(query) {
  if (!API_KEY) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_BOOKS_KEY (restart Expo after setting)"
    );
  }

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

  return (data?.items ?? []).map(toBookCardGoogle);
}


async function googlePreviewForDatasetBook({ title, author, isbn }) {
  if (!title) return null;

  if (isbn) {
    try {
      const items = await googleBooksSearch(`isbn:${isbn}`);
      for (const b of items) {
        const url = pickPreviewUrl(b);
        if (url) return url;
      }
    } catch {}
  }

  const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
  const items = await googleBooksSearch(q);

  for (const b of items) {
    const url = pickPreviewUrl(b);
    if (url) return url;
  }

  return pickPreviewUrl(items[0]) || null;
}

//SUPABASE DATASET 
function cleanAuthor(author) {
  if (!author) return "Unknown author";
  const s = String(author).trim();

  const m = s.match(/'name'\s*:\s*'([^']+)'/);
  if (m?.[1]) return m[1];

  try {
    const obj = JSON.parse(s);
    if (obj?.name) return String(obj.name);
  } catch {}

  return s;
}

function toBookCardDataset(row) {
  return {
    id: row.id,
    source: "dataset",
    title: row.title ?? "Untitled",
    author: cleanAuthor(row.author) || "Unknown author",
    cover: normalizeCover(row.cover_url),
    pages: row.pages ?? 0,
    rating: typeof row.average_rating === "number" ? row.average_rating : null,
    //ratingsCount: row.ratings_count ?? 0,
    isbn: row.isbn ?? null,
    genres: row.genres_clean ?? row.genres ?? null,
    previewLink: null,
    webReaderLink: null,
  };
}

async function fetchCategoryBooks(catKey) {
  const { data, error } = await supabase
    .from("goodreads_books")
    .select(
      "id,title,author,cover_url,pages,average_rating,genres_clean,isbn"
    )
    .contains("genres_clean", [catKey])
    .limit(12);

  if (error) throw error;
  return (data ?? []).map(toBookCardDataset);
}

function formatCount(n) {
  const x = Number(n) || 0;
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}K`;
  return `${x}`;
}

// ---------------- UI COMPONENT ----------------
function SectionRow({
  title,
  books,
  loading,
  error,
  onPressBook,
  onBeginReading,
  listKey = "list",
  savedSet = new Set(),
  onToggleSave,
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
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
          {books.map((b, idx) => {
            const key =
              b.source === "google"
                ? b.id
                : b.source === "gutenberg"
                ? `gutenberg:${b.id}`
                : `dataset:${b.id}`;

            const isSaved = savedSet.has(key);

            return (
              <TouchableOpacity
                key={`${listKey}-${b.source}-${b.id}-${idx}`}
                style={styles.bookCard}
                onPress={() => onPressBook?.(b)}
                activeOpacity={0.85}
              >
                <View style={{ position: "relative" }}>
                  <Image source={{ uri: b.cover }} style={styles.bookCover} />

                  <TouchableOpacity
                    onPress={(e) => {
                      if (e && typeof e.stopPropagation === "function")
                        e.stopPropagation();
                      onToggleSave?.(b);
                    }}
                    style={styles.saveIcon}
                  >
                    <Ionicons
                      name={isSaved ? "heart" : "heart-outline"}
                      size={18}
                      color={isSaved ? "#E11D48" : colors.secondary}
                    />
                  </TouchableOpacity>
                </View>

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
                          {b.ratingsCount ? ` · ${formatCount(b.ratingsCount)}` : ""}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.noRating} numberOfLines={1}>
                        No rating
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
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default function BooksPage() {
  const navigation = useNavigation();
  const [pdBooks, setPdBooks] = useState([]);
  const [googleSearchBooks, setGoogleSearchBooks] = useState([]);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [savedSet, setSavedSet] = useState(new Set());

  const [query, setQuery] = useState("");
  const hasSearch = useMemo(() => query.trim().length > 0, [query]);

  // Search results (Google + Gutenberg)
  const [searchBooks, setSearchBooks] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Categories (Supabase)
  const [categoryBooks, setCategoryBooks] = useState({});
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryErrors, setCategoryErrors] = useState({});

  // Load category rows from dataset only (fast)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setCategoryLoading(true);

        const results = await Promise.all(
          CATEGORIES.map(async (cat) => {
            try {
              const books = await fetchCategoryBooks(cat.key);
              return { key: cat.key, books, err: "" };
            } catch (e) {
              return { key: cat.key, books: [], err: e?.message ?? "Failed to load" };
            }
          })
        );

        if (!mounted) return;

        const map = {};
        const errs = {};
        for (const r of results) {
          map[r.key] = r.books;
          errs[r.key] = r.err;
        }
        setCategoryBooks(map);
        setCategoryErrors(errs);
      } finally {
        if (mounted) setCategoryLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Load saved keys for current user
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) return;

        const { data, error } = await supabase
          .from("saved_books")
          .select("book_id, books:book_id (google_volume_id)")
          .eq("user_id", user.id);

        if (error) throw error;

        const keys = new Set(
          (data ?? [])
            .map((r) => r.books?.google_volume_id)
            .filter(Boolean)
        );

        if (mounted) setSavedSet(keys);
      } catch (e) {
        console.log("Load saved error:", e?.message);
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
    setPdBooks([]);
    setGoogleSearchBooks([]);

    const [gutenbergItems, googleItems] = await Promise.all([
      gutendexSearch(q),
      googleBooksSearch(q),
    ]);

    setPdBooks(gutenbergItems);
    setGoogleSearchBooks(googleItems);
  } catch (e) {
    setSearchError(e?.message ?? "Search failed");
  } finally {
    setSearchLoading(false);
  }
};

  const onToggleSave = async (b) => {
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) {
        Alert.alert("Not signed in", "Please sign in to save books.");
        return;
      }

    
      const googleVolumeId =
        b.source === "google"
          ? b.id
          : b.source === "gutenberg"
          ? `gutenberg:${b.id}`
          : `dataset:${b.id}`;

      const alreadySaved = savedSet.has(googleVolumeId);

      // optimistic UI
      if (alreadySaved) {
        setSavedSet((prev) => {
          const next = new Set(prev);
          next.delete(googleVolumeId);
          return next;
        });
      } else {
        setSavedSet((prev) => new Set(prev).add(googleVolumeId));
      }

      const bookRow = {
        google_volume_id: googleVolumeId,
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

      if (alreadySaved) {
        const { error: delErr } = await supabase
          .from("saved_books")
          .delete()
          .eq("user_id", user.id)
          .eq("book_id", bookData.id);

        if (delErr) throw delErr;
      } else {
        const { error: linkErr } = await supabase
          .from("saved_books")
          .insert({ user_id: user.id, book_id: bookData.id });

        if (linkErr && linkErr.code !== "23505") throw linkErr;
      }
    } catch (e) {
      Alert.alert("Save failed", e?.message ?? "Unknown error");
    }
  };

  const onPressBook = async (book) => {
    if (book.source === "google") {
      const url = pickPreviewUrl(book);
      if (!url) return Alert.alert("No preview available");
      setPreviewUrl(url);
      return;
    }

    if (book.source === "gutenberg") {
      //Alert.alert("Public domain", "Tap Begin Reading to open the full book.");
      return;
    }

    //Alert.alert("Preview", "Tap Begin Reading to open the preview.");
  };

  const onBeginReading = async (b) => {
    try {
      // PUBLIC DOMAIN (Gutenberg)
     if (b.source === "gutenberg") {
  if (!b.textUrl) {
    Alert.alert("Not available", "No text format for this book.");
    return;
  }

  navigation.navigate("Reader", {
  book: { ...b, source: "gutenberg", externalId: b.id },
  url: b.textUrl,
});
  return;
}

      //  GOOGLE
      if (b.source === "google") {
        const url = pickPreviewUrl(b);
        if (!url) return Alert.alert("No preview available");
        setPreviewUrl(url);
        return;
      }

      //  DATASET
      const url = await googlePreviewForDatasetBook({
        title: b.title,
        author: b.author,
        isbn: b.isbn,
      });

      if (!url) {
        Alert.alert("No preview", "Google Books doesn't have a preview for this title.");
        return;
      }

      setPreviewUrl(url);
    } catch (e) {
      Alert.alert("Open failed", e?.message ?? "Unknown error");
    }
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          
          <Text style={styles.subtitle}>Search Books </Text>

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

          {(searchLoading || searchError || pdBooks.length > 0 || googleSearchBooks.length > 0) && (
  <>
    <SectionRow
      title="Books with full text available"
      books={pdBooks}
      loading={searchLoading}
      error={searchError}
      onPressBook={onPressBook}
      onBeginReading={onBeginReading}
      listKey="pd"
      savedSet={savedSet}
      onToggleSave={onToggleSave}
    />

    <SectionRow
      title="More search results"
      books={googleSearchBooks}
      loading={false}
      error={""}
      onPressBook={onPressBook}
      onBeginReading={onBeginReading}
      listKey="google"
      savedSet={savedSet}
      onToggleSave={onToggleSave}
    />
  </>
)}

          {CATEGORIES.map((cat) => (
            <SectionRow
              key={cat.key}
              title={cat.label}
              books={categoryBooks[cat.key] || []}
              loading={categoryLoading}
              error={categoryErrors[cat.key] || ""}
              onPressBook={onPressBook}
              onBeginReading={onBeginReading}
              listKey={cat.key}
              savedSet={savedSet}
              onToggleSave={onToggleSave}
            />
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!previewUrl} animationType="slide" onRequestClose={() => setPreviewUrl(null)}>
        <View style={{ flex: 1, backgroundColor: "black" }}>
          {previewUrl ? <WebView source={{ uri: previewUrl }} style={{ flex: 1 }} /> : null}

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
            <Text style={{ color: "white", fontWeight: "bold" }}>✕ Close</Text>
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

  cardBody: { padding: spacing.md, flexDirection: "column", height: 190 },

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
  cardMeta: { fontSize: typography.fontSizes.xs, color: colors.secondary, flex: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  cardRating: {
    marginLeft: 6,
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
  },
  noRating: { marginLeft: 8, fontSize: typography.fontSizes.xs, color: colors.secondary, opacity: 0.7 },

  beginBtn: {
    marginTop: "auto",
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  beginBtnText: { color: colors.buttonText, fontWeight: typography.fontWeights.semibold },

  saveIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 999,
    padding: 6,
  },
});