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
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import theme from "../theme";
import { supabase } from "../lib/supabase";

const { colors, typography, spacing } = theme;
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

const CATEGORIES = [
  { key: "Horror", label: "Horror" },
  { key: "Fiction", label: "Fiction" },
  { key: "Romance", label: "Romance" },
  { key: "Mystery", label: "Mystery" },
  { key: "Fantasy", label: "Fantasy" },
  { key: "Science Fiction", label: "Sci-Fi" },
];

// Curated classics only
const GUTENBERG_CLASSICS = [
  { title: "Dracula", author: "Bram Stoker" },
  { title: "Frankenstein; Or, The Modern Prometheus", author: "Mary Wollstonecraft Shelley" },
  { title: "Pride and Prejudice", author: "Jane Austen" },
  { title: "Jane Eyre: An Autobiography", author: "Charlotte Bronte" },
  { title: "The Picture of Dorian Gray", author: "Oscar Wilde" },
  { title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle" },
  { title: "Wuthering Heights", author: "Emily Bronte" },
  { title: "Strange Case of Dr Jekyll and Mr Hyde", author: "Robert Louis Stevenson" },
];

function normalizeCover(url) {
  if (!url) return "https://via.placeholder.com/140x210?text=No+Cover";
  return String(url).replace("http://", "https://");
}

function pickPreviewUrl(book) {
  return book?.webReaderLink || book?.previewLink || null;
}

function formatCount(n) {
  const x = Number(n) || 0;
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}K`;
  return `${x}`;
}

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

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleLooksSimilar(a, b) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  return x === y || x.includes(y) || y.includes(x);
}

function authorLooksSimilar(a, b) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  return x === y || x.includes(y) || y.includes(x);
}

// ---------------- GUTENBERG ----------------
// IMPORTANT: plain text only, not HTML
async function gutendexSearch(query) {
  const url = "https://gutendex.com/books?search=" + encodeURIComponent(query);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Gutendex search failed");
  }

  const data = await res.json();

  return (data?.results ?? []).map((b) => {
    const author = b.authors?.[0]?.name ?? "Unknown author";
    const cover = normalizeCover(b.formats?.["image/jpeg"]);

    const textUrl =
      b.formats?.["text/plain; charset=utf-8"] ||
      b.formats?.["text/plain; charset=us-ascii"] ||
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
      fullTextAvailable: !!textUrl,
      hasVerifiedPreview: false,
    };
  });
}

async function fetchCuratedGutenbergClassics() {
  const results = await Promise.all(
    GUTENBERG_CLASSICS.map(async (target) => {
      try {
        const books = await gutendexSearch(`${target.title} ${target.author}`);

        const candidates = books.filter((b) => b.fullTextAvailable);

        const exact = candidates.find(
          (b) =>
            titleLooksSimilar(b.title, target.title) &&
            authorLooksSimilar(b.author, target.author)
        );

        if (exact) return exact;
        return candidates[0] || null;
      } catch {
        return null;
      }
    })
  );

  const seen = new Set();
  return results.filter((b) => {
    if (!b) return false;
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

// ---------------- GOOGLE BOOKS ----------------
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
    ratingsCount:
      typeof info.ratingsCount === "number" ? info.ratingsCount : 0,
    isbn,
    previewLink: info.previewLink ?? null,
    webReaderLink: access.webReaderLink ?? null,
    hasVerifiedPreview: !!(access.webReaderLink ?? info.previewLink),
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
    "&printType=books" +
    "&maxResults=12" +
    "&orderBy=relevance" +
    "&filter=partial" +
    "&key=" +
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

  const tryQueries = [];
  if (isbn) tryQueries.push(`isbn:${isbn}`);
  if (author) tryQueries.push(`intitle:${title} inauthor:${author}`);
  tryQueries.push(`intitle:${title}`);
  if (author) tryQueries.push(`${title} ${author}`);

  for (const q of tryQueries) {
    try {
      const items = await googleBooksSearch(q);
      const withPreview = items.filter((b) => pickPreviewUrl(b));

      if (withPreview.length > 0) {
        withPreview.sort((a, b) => {
          const ar = a.rating ?? 0;
          const br = b.rating ?? 0;
          const ac = a.ratingsCount ?? 0;
          const bc = b.ratingsCount ?? 0;
          if (br !== ar) return br - ar;
          return bc - ac;
        });

        return pickPreviewUrl(withPreview[0]);
      }
    } catch {}
  }

  return null;
}

// ---------------- SUPABASE DATASET ----------------
function toBookCardDataset(row) {
  return {
    id: row.id,
    source: "dataset",
    title: row.title ?? "Untitled",
    author: cleanAuthor(row.author) || "Unknown author",
    cover: normalizeCover(row.cover_url),
    pages: row.pages ?? 0,
    rating: typeof row.average_rating === "number" ? row.average_rating : null,
    ratingsCount: row.ratings_count ?? 0,
    isbn: row.isbn ?? null,
    genres: row.genres_clean ?? row.genres ?? null,
    previewLink: null,
    webReaderLink: null,
    hasVerifiedPreview: false,
  };
}

async function fetchCategoryBooks(catKey) {
  let { data, error } = await supabase
    .from("goodreads_books")
    .select(
      "id,title,author,cover_url,pages,average_rating,ratings_count,genres_clean,isbn"
    )
    .contains("genres_clean", [catKey])
    .not("average_rating", "is", null)
    .order("average_rating", { ascending: false })
    .order("ratings_count", { ascending: false })
    .limit(12);

  if (error) {
    const fallback = await supabase
      .from("goodreads_books")
      .select("id,title,author,cover_url,pages,average_rating,genres_clean,isbn")
      .contains("genres_clean", [catKey])
      .not("average_rating", "is", null)
      .order("average_rating", { ascending: false })
      .limit(12);

    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  return (data ?? []).map(toBookCardDataset);
}

// ---------------- UI ----------------
function SectionRow({
  title,
  books,
  loading,
  error,
  onPressBook,
  onPrimaryAction,
  listKey = "list",
  savedSet = new Set(),
  onToggleSave,
}) {
  return (
    <View style={styles.sectionGroup}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <View style={styles.sectionCard}>
        {loading ? (
          <View style={styles.rowStatus}>
            <ActivityIndicator />
            <Text style={styles.rowStatusText}>Loading…</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : books.length === 0 ? (
          <Text style={styles.emptyText}>No books found.</Text>
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
              const hasPreview =
                b.source === "gutenberg" ? !!b.textUrl : !!pickPreviewUrl(b);

              const showReadButton =
                b.source === "gutenberg" || b.source === "google" || b.hasVerifiedPreview;

              return (
                <TouchableOpacity
                  key={`${listKey}-${b.source}-${b.id}-${idx}`}
                  style={styles.bookCard}
                  onPress={() => onPressBook?.(b)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.bookCoverShadow, { position: "relative" }]}>
                    <Image source={{ uri: b.cover }} style={styles.bookCover} />

                    <TouchableOpacity
                      onPress={(e) => {
                        if (e && typeof e.stopPropagation === "function") {
                          e.stopPropagation();
                        }
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

                      {b.source === "gutenberg" && b.fullTextAvailable ? (
                        <Text style={styles.fullTextBadge} numberOfLines={1}>
                          Full text
                        </Text>
                      ) : b.hasVerifiedPreview ? (
                        <Text style={styles.previewBadge} numberOfLines={1}>
                          Preview
                        </Text>
                      ) : typeof b.rating === "number" ? (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={12} color="#f5c400" />
                          <Text style={styles.cardRating} numberOfLines={1}>
                            {b.rating.toFixed(2)}
                            {b.ratingsCount
                              ? ` · ${formatCount(b.ratingsCount)}`
                              : ""}
                          </Text>
                        </View>
                      ) : hasPreview ? (
                        <Text style={styles.previewBadge} numberOfLines={1}>
                          Preview
                        </Text>
                      ) : (
                        <Text style={styles.noRating} numberOfLines={1}>
                          No rating
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.beginBtn}
                      onPress={() => onPrimaryAction?.(b)}
                    >
                      <Text style={styles.beginBtnText}>
                        {b.source === "gutenberg"
                          ? "Read Full Text"
                          : showReadButton
                          ? "Read Preview"
                          : "View Details"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

export default function BooksPage() {
  const navigation = useNavigation();

  const [pdBooks, setPdBooks] = useState([]);
  const [googleSearchBooks, setGoogleSearchBooks] = useState([]);

  const [featuredGutenbergBooks, setFeaturedGutenbergBooks] = useState([]);
  const [featuredGutenbergLoading, setFeaturedGutenbergLoading] = useState(false);
  const [featuredGutenbergError, setFeaturedGutenbergError] = useState("");

  const [previewUrl, setPreviewUrl] = useState(null);
  const [savedSet, setSavedSet] = useState(new Set());

  const [query, setQuery] = useState("");
  const hasSearch = useMemo(() => query.trim().length > 0, [query]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [categoryBooks, setCategoryBooks] = useState({});
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryErrors, setCategoryErrors] = useState({});

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setFeaturedGutenbergLoading(true);
        setFeaturedGutenbergError("");
        const books = await fetchCuratedGutenbergClassics();

        if (mounted) {
          setFeaturedGutenbergBooks(books);
        }
      } catch (e) {
        if (mounted) {
          setFeaturedGutenbergError(e?.message ?? "Failed to load classics");
        }
      } finally {
        if (mounted) {
          setFeaturedGutenbergLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setCategoryLoading(true);

        const results = await Promise.all(
          CATEGORIES.map(async (cat) => {
            try {
              const books = await fetchCategoryBooks(cat.key);

              const enriched = await Promise.all(
                books.map(async (book) => {
                  try {
                    const preview = await googlePreviewForDatasetBook({
                      title: book.title,
                      author: book.author,
                      isbn: book.isbn,
                    });

                    if (!preview) {
                      return {
                        ...book,
                        previewLink: null,
                        webReaderLink: null,
                        hasVerifiedPreview: false,
                      };
                    }

                    return {
                      ...book,
                      previewLink: preview,
                      webReaderLink: preview,
                      hasVerifiedPreview: true,
                    };
                  } catch {
                    return {
                      ...book,
                      previewLink: null,
                      webReaderLink: null,
                      hasVerifiedPreview: false,
                    };
                  }
                })
              );

              return { key: cat.key, books: enriched, err: "" };
            } catch (e) {
              return {
                key: cat.key,
                books: [],
                err: e?.message ?? "Failed to load",
              };
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
          (data ?? []).map((r) => r.books?.google_volume_id).filter(Boolean)
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

      setPdBooks(gutenbergItems.filter((b) => b.fullTextAvailable));
      setGoogleSearchBooks(googleItems.filter((b) => pickPreviewUrl(b)));
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

  const onPressBook = (book) => {
    navigation.navigate("BookDetails", { book });
  };

  const onPrimaryAction = async (b) => {
    try {
      if (b.source === "gutenberg") {
        if (!b.textUrl) {
          Alert.alert("Not available", "No readable plain-text version for this book.");
          return;
        }

        navigation.navigate("Reader", {
          book: { ...b, source: "gutenberg", externalId: b.id },
          url: b.textUrl,
        });
        return;
      }

      if (b.source === "google") {
        const url = pickPreviewUrl(b);
        if (!url) {
          Alert.alert("No preview available");
          return;
        }
        setPreviewUrl(url);
        return;
      }

      const existingPreview = pickPreviewUrl(b);
      if (existingPreview) {
        setPreviewUrl(existingPreview);
        return;
      }

      navigation.navigate("BookDetails", { book: b });
    } catch (e) {
      Alert.alert("Open failed", e?.message ?? "Unknown error");
    }
  };

  return (
    <>
      <View style={styles.backgroundContainer}>
        <Image
          source={require("../assets/background2.png")}
          style={styles.backgroundImage}
          resizeMode="cover"
        />

        <ScrollView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.subtitle}>Search Books</Text>

            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={18} color={colors.secondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search books (title, author, ISBN)..."
                placeholderTextColor={colors.secondary}
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={onSearch}
              />
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={onSearch}
                disabled={!hasSearch}
              >
                <Text
                  style={[styles.searchBtnText, !hasSearch && { opacity: 0.4 }]}
                >
                  Go
                </Text>
              </TouchableOpacity>
            </View>

            {(searchLoading ||
              searchError ||
              pdBooks.length > 0 ||
              googleSearchBooks.length > 0) && (
              <>
                <SectionRow
                  title="Books with full text available"
                  books={pdBooks}
                  loading={searchLoading}
                  error={searchError}
                  onPressBook={onPressBook}
                  onPrimaryAction={onPrimaryAction}
                  listKey="pd-search"
                  savedSet={savedSet}
                  onToggleSave={onToggleSave}
                />

                <SectionRow
                  title="Previewable books"
                  books={googleSearchBooks}
                  loading={false}
                  error=""
                  onPressBook={onPressBook}
                  onPrimaryAction={onPrimaryAction}
                  listKey="google-search"
                  savedSet={savedSet}
                  onToggleSave={onToggleSave}
                />
              </>
            )}

            <SectionRow
              title="Free Classics"
              books={featuredGutenbergBooks}
              loading={featuredGutenbergLoading}
              error={featuredGutenbergError}
              onPressBook={onPressBook}
              onPrimaryAction={onPrimaryAction}
              listKey="gutenberg-featured"
              savedSet={savedSet}
              onToggleSave={onToggleSave}
            />

            {CATEGORIES.map((cat) => (
              <SectionRow
                key={cat.key}
                title={cat.label}
                books={categoryBooks[cat.key] || []}
                loading={categoryLoading}
                error={categoryErrors[cat.key] || ""}
                onPressBook={onPressBook}
                onPrimaryAction={onPrimaryAction}
                listKey={cat.key}
                savedSet={savedSet}
                onToggleSave={onToggleSave}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={!!previewUrl}
        animationType="slide"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View style={{ flex: 1, backgroundColor: "black" }}>
          {previewUrl ? (
            <WebView source={{ uri: previewUrl }} style={{ flex: 1 }} />
          ) : null}

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
  backgroundContainer: { flex: 1, width: "100%", height: "100%" },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },

  container: { flex: 1, backgroundColor: "transparent" },
  content: { paddingTop: 92, paddingBottom: spacing.lg },

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
    backgroundColor: "rgba(255, 255, 255, 0.58)",
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
    color: "#1F1F1F",
    fontSize: typography.fontSizes.base,
    paddingVertical: 6,
  },
  searchBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.buttonPrimary,
    borderRadius: 10,
  },
  searchBtnText: {
    color: colors.buttonText,
    fontWeight: typography.fontWeights.semibold,
  },

  sectionGroup: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xs,
  },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 16,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
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
    color: "#1F1F1F",
    fontFamily: "Georgia",
  },

  rowStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.lg,
  },
  rowStatusText: { color: "#666666" },
  errorText: { color: "#B00020", paddingHorizontal: spacing.lg },
  emptyText: {
    color: "#666666",
    paddingHorizontal: spacing.lg,
    opacity: 0.8,
  },

  horizontalScroll: { paddingLeft: spacing.lg, paddingBottom: spacing.xs },

  bookCard: {
    width: 138,
    marginRight: spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.30)",
    borderRadius: 18,
    overflow: "visible",
  },
  bookCoverShadow: {
    borderRadius: 8,
    marginBottom: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
    elevation: 7,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 7px 16px rgba(0, 0, 0, 0.22)" }
      : {}),
  },
  bookCover: {
    width: "100%",
    height: 207,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },

  cardBody: {
    padding: spacing.md,
    flexDirection: "column",
    height: 190,
  },

  cardTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: "#1F1F1F",
    lineHeight: 18,
    minHeight: 36,
  },
  cardAuthor: {
    fontSize: typography.fontSizes.xs,
    color: "#666666",
    marginTop: 4,
  },

  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cardMeta: {
    fontSize: typography.fontSizes.xs,
    color: "#666666",
    flex: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  cardRating: {
    marginLeft: 6,
    fontSize: typography.fontSizes.xs,
    color: "#1F1F1F",
    fontWeight: typography.fontWeights.semibold,
  },
  noRating: {
    marginLeft: 8,
    fontSize: typography.fontSizes.xs,
    color: "#666666",
    opacity: 0.7,
  },
  fullTextBadge: {
    marginLeft: 8,
    fontSize: typography.fontSizes.xs,
    color: "#0F766E",
    fontWeight: typography.fontWeights.semibold,
  },
  previewBadge: {
    marginLeft: 8,
    fontSize: typography.fontSizes.xs,
    color: "#2563EB",
    fontWeight: typography.fontWeights.semibold,
  },

  beginBtn: {
    marginTop: "auto",
    backgroundColor: "#581215",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    width: 140,
    alignSelf: "center",
  },
  beginBtnText: {
    color: colors.buttonText,
    fontWeight: typography.fontWeights.semibold,
    fontSize: typography.fontSizes.sm,
  },

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