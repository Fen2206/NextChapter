import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing, typography } from '../theme';
import { supabase } from '../lib/supabase';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

function normalizeCover(url) {
  if (!url) return 'https://via.placeholder.com/140x210?text=No+Cover';
  return String(url).replace('http://', 'https://');
}

function pickPreviewUrl(book) {
  return book?.webReaderLink || book?.previewLink || null;
}

async function googleBooksSearch(query) {
  if (!API_KEY) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_BOOKS_KEY (restart Expo after setting it)'
    );
  }

  const url =
    'https://www.googleapis.com/books/v1/volumes?q=' +
    encodeURIComponent(query) +
    '&printType=books&maxResults=12&orderBy=relevance&key=' +
    encodeURIComponent(API_KEY);

  const res = await fetch(url);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.error?.message ?? 'Google Books error';
    throw new Error(msg);
  }

  return data?.items ?? [];
}

async function googlePreviewForDatasetBook({ title, author, isbn }) {
  if (!title) return null;

  if (isbn) {
    try {
      const isbnItems = await googleBooksSearch(`isbn:${isbn}`);
      for (const item of isbnItems) {
        const info = item.volumeInfo || {};
        const access = item.accessInfo || {};
        const url = access.webReaderLink || info.previewLink || null;
        if (url) return url;
      }
    } catch (e) {}
  }

  const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
  const items = await googleBooksSearch(q);

  for (const item of items) {
    const info = item.volumeInfo || {};
    const access = item.accessInfo || {};
    const url = access.webReaderLink || info.previewLink || null;
    if (url) return url;
  }

  return null;
}

async function fetchAccessibleShelves(userId) {
  const { data: ownedShelves, error: ownedErr } = await supabase
    .from('bookshelves')
    .select('id, name, owner_user_id, created_at')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false });

  if (ownedErr) throw ownedErr;

  const { data: memberRows, error: memberErr } = await supabase
    .from('bookshelf_members')
    .select(`
      shelf_id,
      bookshelves:shelf_id (
        id,
        name,
        owner_user_id,
        created_at
      )
    `)
    .eq('user_id', userId);

  if (memberErr) throw memberErr;

  const sharedShelves = (memberRows || [])
    .map((row) => row.bookshelves)
    .filter(Boolean);

  const merged = [...(ownedShelves || []), ...sharedShelves];
  const dedupedMap = new Map();

  merged.forEach((shelf) => {
    if (!dedupedMap.has(shelf.id)) {
      dedupedMap.set(shelf.id, {
        ...shelf,
        isOwner: shelf.owner_user_id === userId,
      });
    }
  });

  return Array.from(dedupedMap.values());
}

async function resolveEmailsToProfiles(rawEmailInput) {
  const emails = rawEmailInput
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    return { foundProfiles: [], missingEmails: [] };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, display_name')
    .in('email', emails);

  if (error) throw error;

  const foundProfiles = data || [];
  const foundEmails = new Set(
    foundProfiles.map((p) => String(p.email || '').toLowerCase())
  );

  const missingEmails = emails.filter((email) => !foundEmails.has(email));

  return { foundProfiles, missingEmails };
}

export default function BookDetailsScreen({ route, navigation }) {
  const incomingBook = route?.params?.book ?? null;

  const [previewUrl, setPreviewUrl] = useState(null);
  const [libraryState, setLibraryState] = useState({
    loading: true,
    isSaved: false,
    userBookId: null,
    internalBookId: null,
    readingStatus: null,
    currentPage: 0,
    progress: 0,
  });

  const [shelfModalVisible, setShelfModalVisible] = useState(false);
  const [shelves, setShelves] = useState([]);
  const [newShelfName, setNewShelfName] = useState('');
  const [friendEmails, setFriendEmails] = useState('');
  const [savingToShelf, setSavingToShelf] = useState(false);

  const [ratingState, setRatingState] = useState({
    loading: true,
    saving: false,
    userRating: 0,
    appAverageRating: null,
    appTotalRatings: 0,
    sourceAverageRating:
      typeof incomingBook?.rating === 'number' ? incomingBook.rating : null,
    sourceTotalRatings: incomingBook?.ratingsCount ?? 0,
  });

  const book = useMemo(() => {
    return {
      id: incomingBook?.id ?? null,
      source: incomingBook?.source ?? null,
      title: incomingBook?.title ?? 'Untitled',
      author: incomingBook?.author ?? 'Unknown author',
      rating:
        typeof incomingBook?.rating === 'number' ? incomingBook.rating : null,
      totalRatings: incomingBook?.ratingsCount ?? 0,
      cover: normalizeCover(incomingBook?.cover),
      description:
        incomingBook?.description ?? 'No description available for this book yet.',
      pageCount: incomingBook?.pages ?? incomingBook?.pageCount ?? 0,
      publishYear: incomingBook?.publishYear ?? 'N/A',
      genres: incomingBook?.genres ?? [],
      isbn: incomingBook?.isbn ?? 'N/A',
      textUrl: incomingBook?.textUrl ?? null,
      previewLink: incomingBook?.previewLink ?? null,
      webReaderLink: incomingBook?.webReaderLink ?? null,
    };
  }, [incomingBook]);

  const safeGenres = useMemo(() => {
    if (Array.isArray(book.genres)) return book.genres;
    if (typeof book.genres === 'string' && book.genres.trim()) return [book.genres];
    return [];
  }, [book.genres]);

  const storageKey = useMemo(() => {
    if (book.source === 'google') return book.id;
    if (book.source === 'gutenberg') return `gutenberg:${book.id}`;
    return `dataset:${book.id}`;
  }, [book.id, book.source]);

  const loadShelves = async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      if (!user) {
        setShelves([]);
        return;
      }

      const accessibleShelves = await fetchAccessibleShelves(user.id);
      setShelves(accessibleShelves);
    } catch (e) {
      console.log('Shelf load error:', e?.message);
      setShelves([]);
    }
  };

  const loadRatingState = async (internalBookId) => {
    try {
      setRatingState((prev) => ({ ...prev, loading: true }));

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = authData?.user;

      const [{ data: aggregateRows, error: aggregateErr }, userRatingResult] =
        await Promise.all([
          supabase
            .from('book_ratings')
            .select('rating')
            .eq('book_id', internalBookId),
          user
            ? supabase
                .from('book_ratings')
                .select('rating')
                .eq('user_id', user.id)
                .eq('book_id', internalBookId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

      if (aggregateErr) throw aggregateErr;
      if (userRatingResult?.error) throw userRatingResult.error;

      const ratings = aggregateRows || [];
      const appTotalRatings = ratings.length;
      const appAverageRating =
        appTotalRatings > 0
          ? ratings.reduce((sum, row) => sum + Number(row.rating || 0), 0) /
            appTotalRatings
          : null;

      setRatingState({
        loading: false,
        saving: false,
        userRating: userRatingResult?.data?.rating ?? 0,
        appAverageRating,
        appTotalRatings,
        sourceAverageRating:
          typeof incomingBook?.rating === 'number' ? incomingBook.rating : null,
        sourceTotalRatings: incomingBook?.ratingsCount ?? 0,
      });
    } catch (e) {
      console.log('Rating load error:', e?.message);
      setRatingState((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadBookState = async () => {
      try {
        setLibraryState((prev) => ({ ...prev, loading: true }));

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) {
          if (mounted) {
            setLibraryState({
              loading: false,
              isSaved: false,
              userBookId: null,
              internalBookId: null,
              readingStatus: null,
              currentPage: 0,
              progress: 0,
            });
            setRatingState((prev) => ({
              ...prev,
              loading: false,
              userRating: 0,
              appAverageRating: null,
              appTotalRatings: 0,
              sourceAverageRating:
                typeof incomingBook?.rating === 'number' ? incomingBook.rating : null,
              sourceTotalRatings: incomingBook?.ratingsCount ?? 0,
            }));
          }
          return;
        }

        const { data: existingBook, error: existingBookErr } = await supabase
          .from('books')
          .select('id, google_volume_id, page_count')
          .eq('google_volume_id', storageKey)
          .maybeSingle();

        if (existingBookErr) throw existingBookErr;

        if (!existingBook) {
          if (mounted) {
            setLibraryState({
              loading: false,
              isSaved: false,
              userBookId: null,
              internalBookId: null,
              readingStatus: null,
              currentPage: 0,
              progress: 0,
            });
            setRatingState((prev) => ({
              ...prev,
              loading: false,
              userRating: 0,
              appAverageRating: null,
              appTotalRatings: 0,
              sourceAverageRating:
                typeof incomingBook?.rating === 'number' ? incomingBook.rating : null,
              sourceTotalRatings: incomingBook?.ratingsCount ?? 0,
            }));
          }
          return;
        }

        const internalBookId = existingBook.id;

        const [{ data: savedRow, error: savedErr }, { data: userBookRow, error: userBookErr }] =
          await Promise.all([
            supabase
              .from('saved_books')
              .select('book_id')
              .eq('user_id', user.id)
              .eq('book_id', internalBookId)
              .maybeSingle(),
            supabase
              .from('user_books')
              .select('id, status, current_page')
              .eq('user_id', user.id)
              .eq('book_id', internalBookId)
              .maybeSingle(),
          ]);

        if (savedErr) throw savedErr;
        if (userBookErr) throw userBookErr;

        const currentPage = userBookRow?.current_page ?? 0;
        const totalPages = book.pageCount || existingBook.page_count || 0;
        const progress =
          totalPages > 0 && currentPage > 0
            ? Math.min(100, Math.round((currentPage / totalPages) * 100))
            : 0;

        if (mounted) {
          setLibraryState({
            loading: false,
            isSaved: !!savedRow,
            userBookId: userBookRow?.id ?? null,
            internalBookId,
            readingStatus: userBookRow?.status ?? null,
            currentPage,
            progress,
          });
        }

        await loadRatingState(internalBookId);
      } catch (e) {
        console.log('Book state load error:', e?.message);
        if (mounted) {
          setLibraryState((prev) => ({ ...prev, loading: false }));
          setRatingState((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    if (incomingBook) {
      loadBookState();
      loadShelves();
    }

    return () => {
      mounted = false;
    };
  }, [incomingBook, storageKey, book.pageCount]);

  const saveUserRating = async (selectedRating) => {
    try {
      setRatingState((prev) => ({ ...prev, saving: true }));

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) {
        Alert.alert('Not signed in', 'Please sign in to rate books.');
        return;
      }

      let internalBookId = libraryState.internalBookId;
      if (!internalBookId) {
        const bookRow = await ensureBookRow();
        internalBookId = bookRow.id;
        setLibraryState((prev) => ({
          ...prev,
          internalBookId: bookRow.id,
        }));
      }

      const { error } = await supabase
        .from('book_ratings')
        .upsert(
          {
            user_id: user.id,
            book_id: internalBookId,
            rating: selectedRating,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,book_id' }
        );

      if (error) throw error;

      await loadRatingState(internalBookId);
    } catch (e) {
      Alert.alert('Rating failed', e?.message ?? 'Unknown error');
    } finally {
      setRatingState((prev) => ({ ...prev, saving: false }));
    }
  };

  const renderInteractiveStars = () => {
    return [1, 2, 3, 4, 5].map((star) => (
      <TouchableOpacity
        key={star}
        onPress={() => saveUserRating(star)}
        disabled={ratingState.saving}
        style={styles.ratingStarButton}
      >
        <Ionicons
          name={star <= ratingState.userRating ? 'star' : 'star-outline'}
          size={24}
          color="#FFD700"
        />
      </TouchableOpacity>
    ));
  };

  const getStatusInfo = () => {
    if (libraryState.readingStatus === 'reading') {
      return {
        icon: 'book',
        text: 'Currently Reading',
        color: '#4CAF50',
      };
    }

    if (libraryState.readingStatus === 'completed') {
      return {
        icon: 'checkmark-circle',
        text: 'Completed',
        color: '#2196F3',
      };
    }

    if (libraryState.isSaved) {
      return {
        icon: 'bookmark',
        text: 'Saved',
        color: '#FF9800',
      };
    }

    return null;
  };

  const statusInfo = getStatusInfo();

  const hasImmediateAccess =
    book.source === 'gutenberg'
      ? !!book.textUrl
      : !!pickPreviewUrl(book);

  const mainButtonLabel =
    book.source === 'gutenberg'
      ? libraryState.readingStatus === 'reading'
        ? 'Continue Reading'
        : 'Read Full Text'
      : hasImmediateAccess
      ? libraryState.readingStatus === 'reading'
        ? 'Continue Preview'
        : 'Read Preview'
      : 'Find Preview';

  const mainButtonIcon =
    libraryState.readingStatus === 'reading' ? 'play' : 'book-outline';

  const renderStars = (rating) => {
    if (typeof rating !== 'number') return null;

    const stars = [];
    const safeRating = Math.max(0, Math.min(rating, 5));
    const fullStars = Math.floor(safeRating);
    const hasHalfStar = safeRating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Ionicons key={i} name="star" size={18} color="#FFD700" />);
    }

    if (hasHalfStar && fullStars < 5) {
      stars.push(
        <Ionicons key="half" name="star-half" size={18} color="#FFD700" />
      );
    }

    const emptyStars = 5 - Math.ceil(safeRating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Ionicons
          key={`empty-${i}`}
          name="star-outline"
          size={18}
          color="#FFD700"
        />
      );
    }

    return stars;
  };

  const ensureBookRow = async () => {
    const bookRow = {
      google_volume_id: storageKey,
      title: book.title,
      authors: book.author && book.author !== 'Unknown author' ? [book.author] : null,
      cover_url: book.cover,
      page_count: book.pageCount || null,
    };

    const { data, error } = await supabase
      .from('books')
      .upsert(bookRow, { onConflict: 'google_volume_id' })
      .select('id, page_count')
      .single();

    if (error) throw error;
    return data;
  };

  const upsertUserBookReading = async (bookId, pageToUse = 1) => {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;

    const user = authData?.user;
    if (!user) return null;

    const payload = {
      user_id: user.id,
      book_id: bookId,
      status: 'reading',
      current_page: pageToUse,
      finished_at: null,
    };

    const { data, error } = await supabase
      .from('user_books')
      .upsert(payload, { onConflict: 'user_id,book_id' })
      .select('id, status, current_page')
      .single();

    if (error) throw error;
    return data;
  };

  const resolveReadableTarget = async () => {
    if (book.source === 'gutenberg') {
      if (!book.textUrl) return { type: 'none' };
      return { type: 'reader', url: book.textUrl };
    }

    if (book.source === 'google') {
      const url = pickPreviewUrl(book);
      if (!url) return { type: 'none' };
      return { type: 'preview', url };
    }

    if (book.source === 'dataset') {
      const existingPreview = pickPreviewUrl(book);
      if (existingPreview) {
        return { type: 'preview', url: existingPreview };
      }

      const fallbackUrl = await googlePreviewForDatasetBook({
        title: book.title,
        author: book.author,
        isbn: book.isbn !== 'N/A' ? book.isbn : null,
      });

      if (fallbackUrl) {
        return { type: 'preview', url: fallbackUrl };
      }

      return { type: 'none' };
    }

    return { type: 'none' };
  };

  const openReadableTarget = (target, pageToUse) => {
    if (target.type === 'reader') {
      navigation.navigate('ReadingView', {
        book: {
          ...book,
          source: 'gutenberg',
          externalId: book.id,
          currentPage: pageToUse,
        },
        url: target.url,
      });
      return true;
    }

    if (target.type === 'preview') {
      setPreviewUrl(target.url);
      return true;
    }

    return false;
  };

  const handleBeginOrContinueReading = async () => {
    try {
      const pageToUse =
        libraryState.readingStatus === 'reading' && libraryState.currentPage > 0
          ? libraryState.currentPage
          : 1;

      const target = await resolveReadableTarget();

      if (target.type === 'none') {
        Alert.alert(
          'Preview unavailable',
          'This book does not have a readable preview yet.'
        );
        return;
      }

      const opened = openReadableTarget(target, pageToUse);
      if (!opened) return;

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) return;

      let internalBookId = libraryState.internalBookId;
      if (!internalBookId) {
        const createdBook = await ensureBookRow();
        internalBookId = createdBook.id;
      }

      const userBook = await upsertUserBookReading(internalBookId, pageToUse);

      setLibraryState((prev) => ({
        ...prev,
        internalBookId,
        userBookId: userBook?.id ?? prev.userBookId,
        readingStatus: 'reading',
        currentPage: userBook?.current_page ?? pageToUse,
        progress:
          book.pageCount > 0
            ? Math.min(
                100,
                Math.round(
                  ((userBook?.current_page ?? pageToUse) / book.pageCount) * 100
                )
              )
            : prev.progress,
      }));
    } catch (e) {
      Alert.alert('Open failed', e?.message ?? 'Unknown error');
    }
  };

  const saveBookToShelf = async (internalBookId, shelfId, userId) => {
    const { error } = await supabase
      .from('bookshelf_books')
      .upsert(
        {
          shelf_id: shelfId,
          book_id: internalBookId,
          added_by_user_id: userId,
        },
        { onConflict: 'shelf_id,book_id' }
      );

    if (error) throw error;
  };

  const createShelfAndSave = async () => {
    try {
      const trimmed = newShelfName.trim();

      if (!trimmed) {
        Alert.alert('Missing name', 'Please enter a shelf name.');
        return;
      }

      setSavingToShelf(true);

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr) throw authErr;
      if (!user) {
        Alert.alert('Not signed in', 'Please sign in to save books.');
        return;
      }

      const existing = shelves.find(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase()
      );

      let shelfId = existing?.id;

      if (!shelfId) {
        const { data: createdShelf, error: createShelfErr } = await supabase
          .from('bookshelves')
          .insert({
            name: trimmed,
            owner_user_id: user.id,
          })
          .select('id, name, owner_user_id, created_at')
          .single();

        if (createShelfErr) throw createShelfErr;
        shelfId = createdShelf.id;

        const { foundProfiles, missingEmails } = await resolveEmailsToProfiles(friendEmails);

        if (foundProfiles.length > 0) {
          const memberRows = foundProfiles
            .filter((profile) => profile.id !== user.id)
            .map((profile) => ({
              shelf_id: shelfId,
              user_id: profile.id,
              added_by_user_id: user.id,
            }));

          if (memberRows.length > 0) {
            const { error: memberErr } = await supabase
              .from('bookshelf_members')
              .upsert(memberRows, { onConflict: 'shelf_id,user_id' });

            if (memberErr) throw memberErr;
          }
        }

        if (missingEmails.length > 0) {
          Alert.alert(
            'Shelf created',
            `Shelf created, but these emails were not found: ${missingEmails.join(', ')}`
          );
        }
      }

      let internalBookId = libraryState.internalBookId;
      if (!internalBookId) {
        const bookRow = await ensureBookRow();
        internalBookId = bookRow.id;
      }

      await saveBookToShelf(internalBookId, shelfId, user.id);

      setNewShelfName('');
      setFriendEmails('');
      setShelfModalVisible(false);
      await loadShelves();

      Alert.alert('Success', `Saved to "${trimmed}"`);
    } catch (e) {
      Alert.alert('Shelf save failed', e?.message ?? 'Unknown error');
    } finally {
      setSavingToShelf(false);
    }
  };

  const saveToExistingShelf = async (shelfId, shelfName) => {
    try {
      setSavingToShelf(true);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      if (!user) {
        Alert.alert('Not signed in', 'Please sign in first.');
        return;
      }

      let internalBookId = libraryState.internalBookId;
      if (!internalBookId) {
        const bookRow = await ensureBookRow();
        internalBookId = bookRow.id;
      }

      await saveBookToShelf(internalBookId, shelfId, user.id);

      setShelfModalVisible(false);
      Alert.alert('Success', `Saved to "${shelfName}"`);
    } catch (e) {
      Alert.alert('Shelf save failed', e?.message ?? 'Unknown error');
    } finally {
      setSavingToShelf(false);
    }
  };

  const handleAddToLibrary = async () => {
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) {
        Alert.alert('Not signed in', 'Please sign in to save books.');
        return;
      }

      const bookData = libraryState.internalBookId
        ? { id: libraryState.internalBookId }
        : await ensureBookRow();

      if (libraryState.isSaved) {
        const { error } = await supabase
          .from('saved_books')
          .delete()
          .eq('user_id', user.id)
          .eq('book_id', bookData.id);

        if (error) throw error;

        setLibraryState((prev) => ({ ...prev, isSaved: false }));
        Alert.alert('Removed', 'Book removed from your library.');
        return;
      }

      const { error } = await supabase
        .from('saved_books')
        .insert({
          user_id: user.id,
          book_id: bookData.id,
        });

      if (error && error.code !== '23505') throw error;

      setLibraryState((prev) => ({
        ...prev,
        isSaved: true,
        internalBookId: bookData.id,
      }));

      await loadShelves();
      setShelfModalVisible(true);
    } catch (e) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    }
  };

  const handleJoinBookClub = () => {
    navigation.getParent()?.navigate('Community');
  };

  if (!incomingBook) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorStateTitle}>No book selected</Text>
        <Text style={styles.errorStateText}>
          Please go back and choose a book first.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.topBackRow}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('SearchMain');
              }
            }}
            style={styles.topBackButton}
          >
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
            <Text style={styles.topBackText}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.headerSection}>
            <View style={styles.coverContainer}>
              <Image
                source={{ uri: book.cover }}
                style={styles.coverImage}
                resizeMode="cover"
              />

              {statusInfo && (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusInfo.color },
                  ]}
                >
                  <Ionicons name={statusInfo.icon} size={14} color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.headerInfo}>
              <Text style={styles.title}>{book.title}</Text>
              <Text style={styles.author}>by {book.author}</Text>

              {statusInfo && (
                <View style={styles.statusContainer}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusInfo.color },
                    ]}
                  />
                  <Text style={styles.statusText}>{statusInfo.text}</Text>
                </View>
              )}

              <View style={styles.ratingContainer}>
                <View style={styles.ratingBlock}>
                  <Text style={styles.ratingLabel}>Book Rating</Text>
                  {typeof ratingState.sourceAverageRating === 'number' ? (
                    <>
                      <View style={styles.stars}>
                        {renderStars(ratingState.sourceAverageRating)}
                      </View>
                      <Text style={styles.ratingText}>
                        {ratingState.sourceAverageRating.toFixed(2)} (
                        {(ratingState.sourceTotalRatings || 0).toLocaleString()} ratings)
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.ratingText}>No source rating available</Text>
                  )}
                </View>

                <View style={styles.ratingBlock}>
                  <Text style={styles.ratingLabel}>Our Users&apos; Rating</Text>
                  {ratingState.loading ? (
                    <ActivityIndicator size="small" color={colors.buttonPrimary} />
                  ) : typeof ratingState.appAverageRating === 'number' ? (
                    <>
                      <View style={styles.stars}>
                        {renderStars(ratingState.appAverageRating)}
                      </View>
                      <Text style={styles.ratingText}>
                        {ratingState.appAverageRating.toFixed(2)} (
                        {(ratingState.appTotalRatings || 0).toLocaleString()} ratings)
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.ratingText}>No user ratings yet</Text>
                  )}
                </View>

                <View style={styles.userRatingBlock}>
                  <Text style={styles.userRatingLabel}>Your Rating</Text>
                  <View style={styles.userStarsRow}>{renderInteractiveStars()}</View>
                  <Text style={styles.userRatingHint}>
                    {ratingState.userRating > 0
                      ? `You rated this ${ratingState.userRating}/5. Tap a star to change it.`
                      : 'Tap a star to rate this book.'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoPill}>
                  <Ionicons
                    name="book-outline"
                    size={14}
                    color={colors.secondary}
                  />
                  <Text style={styles.infoPillText}>
                    {book.pageCount ? `${book.pageCount} pages` : 'Pages N/A'}
                  </Text>
                </View>

                <View style={styles.infoPill}>
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={colors.secondary}
                  />
                  <Text style={styles.infoPillText}>{book.publishYear}</Text>
                </View>
              </View>
            </View>
          </View>

          {libraryState.readingStatus === 'reading' && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Your Progress</Text>
                <Text style={styles.progressPercentage}>
                  {libraryState.progress}%
                </Text>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${libraryState.progress}%` },
                    ]}
                  />
                </View>
              </View>

              <Text style={styles.progressText}>
                Page {libraryState.currentPage || 1} of {book.pageCount || 'N/A'}
              </Text>
            </View>
          )}

          <View style={styles.actionButtonsBlock}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleBeginOrContinueReading}
              disabled={libraryState.loading}
            >
              {libraryState.loading ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <>
                  <Ionicons
                    name={mainButtonIcon}
                    size={20}
                    color={colors.buttonText}
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.primaryButtonText}>
                    {mainButtonLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleAddToLibrary}
              >
                <Ionicons
                  name={libraryState.isSaved ? 'heart' : 'add-circle-outline'}
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.secondaryButtonText}>
                  {libraryState.isSaved ? 'Saved' : 'Add to Library'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleJoinBookClub}
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.secondaryButtonText}>Join Book Club</Text>
              </TouchableOpacity>
            </View>
          </View>

          {safeGenres.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Genres</Text>
              <View style={styles.genresContainer}>
                {safeGenres.map((genre, index) => (
                  <View key={index} style={styles.genreTag}>
                    <Text style={styles.genreText}>{genre}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this book</Text>
            <Text style={styles.description}>{book.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ISBN</Text>
                <Text style={styles.detailValue}>{book.isbn}</Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pages</Text>
                <Text style={styles.detailValue}>
                  {book.pageCount || 'N/A'}
                </Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Published</Text>
                <Text style={styles.detailValue}>{book.publishYear}</Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Source</Text>
                <Text style={styles.detailValue}>
                  {book.source ? book.source : 'Unknown'}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ height: spacing.xl }} />
        </View>
      </ScrollView>

      <Modal
        visible={!!previewUrl}
        animationType="slide"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          {previewUrl ? (
            <WebView source={{ uri: previewUrl }} style={{ flex: 1 }} />
          ) : null}

          <TouchableOpacity
            onPress={() => setPreviewUrl(null)}
            style={styles.closePreviewButton}
          >
            <Text style={styles.closePreviewText}>✕ Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        visible={shelfModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShelfModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save to Shelf</Text>
            <Text style={styles.modalSubtitle} numberOfLines={2}>
              {book.title}
            </Text>

            {shelves.length > 0 ? (
              <View style={styles.shelfList}>
                {shelves.map((shelf) => (
                  <TouchableOpacity
                    key={shelf.id}
                    style={styles.shelfRow}
                    onPress={() => saveToExistingShelf(shelf.id, shelf.name)}
                    disabled={savingToShelf}
                  >
                    <View style={styles.shelfRowLeft}>
                      <Ionicons
                        name="library-outline"
                        size={18}
                        color={colors.buttonPrimary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shelfRowText}>{shelf.name}</Text>
                        {!shelf.isOwner ? (
                          <Text style={styles.sharedShelfHint}>Shared with you</Text>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.secondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.noShelfText}>No shelves yet. Create one below.</Text>
            )}

            <Text style={styles.createShelfLabel}>Create New Shelf</Text>
            <TextInput
              value={newShelfName}
              onChangeText={setNewShelfName}
              placeholder="Ex: Summer Readers"
              placeholderTextColor={colors.secondary}
              style={styles.input}
            />

            <Text style={styles.createShelfLabel}>Invite Friends by Email</Text>
            <TextInput
              value={friendEmails}
              onChangeText={setFriendEmails}
              placeholder="friend1@email.com, friend2@email.com"
              placeholderTextColor={colors.secondary}
              style={[styles.input, { marginBottom: spacing.sm }]}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.helperText}>
              Separate multiple emails with commas.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShelfModalVisible(false);
                  setNewShelfName('');
                  setFriendEmails('');
                }}
                disabled={savingToShelf}
              >
                <Text style={styles.modalCancelText}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={createShelfAndSave}
                disabled={savingToShelf}
              >
                {savingToShelf ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <Text style={styles.modalSaveText}>Create + Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 0,
  },

  topBackRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  topBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topBackText: {
    marginLeft: spacing.xs,
    color: colors.primary,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },

  errorStateTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  errorStateText: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  headerSection: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  coverContainer: {
    position: 'relative',
  },
  coverImage: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  headerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
    lineHeight: typography.fontSizes.xxl * 1.2,
  },
  author: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    marginBottom: spacing.sm,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },

  ratingContainer: {
    marginBottom: spacing.md,
  },
  ratingBlock: {
    marginBottom: spacing.md,
  },
  ratingLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
    marginBottom: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  ratingText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },
  userRatingBlock: {
    marginTop: spacing.xs,
  },
  userRatingLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
    marginBottom: spacing.xs,
  },
  userStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStarButton: {
    marginRight: spacing.xs,
    paddingVertical: 2,
  },
  userRatingHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: spacing.xs,
  },

  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  infoPillText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },

  progressSection: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  progressPercentage: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.buttonPrimary,
  },
  progressBarContainer: {
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.buttonPrimary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },

  actionButtonsBlock: {
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 52,
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
  primaryButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  secondaryButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
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

  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genreTag: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },

  description: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    lineHeight: typography.lineHeights.relaxed * typography.fontSizes.base,
  },

  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  detailLabel: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },
  detailValue: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
    maxWidth: '55%',
    textAlign: 'right',
  },

  closePreviewButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closePreviewText: {
    color: 'white',
    fontWeight: 'bold',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginBottom: spacing.md,
  },
  shelfList: {
    marginBottom: spacing.md,
  },
  shelfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shelfRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  shelfRowText: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  sharedShelfHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: 2,
  },
  noShelfText: {
    color: colors.secondary,
    marginBottom: spacing.md,
  },
  createShelfLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  helperText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSaveButton: {
    backgroundColor: colors.buttonPrimary,
  },
  modalCancelText: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  modalSaveText: {
    color: colors.buttonText,
    fontWeight: typography.fontWeights.semibold,
  },
});