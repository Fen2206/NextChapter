import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../theme';

const DEFAULT_SHELF_ID = 'all';
const DEFAULT_SHELF_NAME = 'All Saved';

function normalizeCover(url) {
  if (!url) return 'https://via.placeholder.com/140x210?text=No+Cover';
  return String(url).replace('http://', 'https://');
}

function displayPerson(profile) {
  return (
    profile?.display_name ||
    profile?.username ||
    profile?.email ||
    'Unknown user'
  );
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

async function fetchShelfBookMapForShelves(shelfIds) {
  if (!shelfIds.length) return {};

  const { data, error } = await supabase
    .from('bookshelf_books')
    .select('shelf_id, book_id')
    .in('shelf_id', shelfIds);

  if (error) throw error;

  const map = {};
  (data || []).forEach((row) => {
    const bookId = String(row.book_id);
    if (!map[bookId]) map[bookId] = [];
    map[bookId].push(row.shelf_id);
  });

  return map;
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

export default function MyBooksScreen({ navigation }) {
  const [selectedTab, setSelectedTab] = useState('currentlyReading');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shelfDetailLoading, setShelfDetailLoading] = useState(false);

  const [libraryData, setLibraryData] = useState({
    currentlyReading: [],
    saved: [],
    completed: [],
  });

  const [shelves, setShelves] = useState([
    { id: DEFAULT_SHELF_ID, name: DEFAULT_SHELF_NAME, isOwner: true },
  ]);
  const [selectedShelfId, setSelectedShelfId] = useState(DEFAULT_SHELF_ID);

  const [selectedShelfBooks, setSelectedShelfBooks] = useState([]);
  const [selectedShelfPeople, setSelectedShelfPeople] = useState({
    owner: null,
    members: [],
  });

  const [createShelfModalVisible, setCreateShelfModalVisible] = useState(false);
  const [shelfBookModalVisible, setShelfBookModalVisible] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [friendEmails, setFriendEmails] = useState('');
  const [selectedBookForShelf, setSelectedBookForShelf] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;

      if (!user) {
        setCurrentUserId(null);
        setLibraryData({
          currentlyReading: [],
          saved: [],
          completed: [],
        });
        setShelves([{ id: DEFAULT_SHELF_ID, name: DEFAULT_SHELF_NAME, isOwner: true }]);
        setSelectedShelfId(DEFAULT_SHELF_ID);
        setSelectedShelfBooks([]);
        setSelectedShelfPeople({ owner: null, members: [] });
        return;
      }

      setCurrentUserId(user.id);

      const { data: userBooks, error: userBooksErr } = await supabase
        .from('user_books')
        .select(`
          id,
          status,
          current_page,
          finished_at,
          created_at,
          books (
            id,
            google_volume_id,
            title,
            authors,
            cover_url,
            page_count
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (userBooksErr) throw userBooksErr;

      const { data: savedRows, error: savedErr } = await supabase
        .from('saved_books')
        .select(`
          created_at,
          books:book_id (
            id,
            google_volume_id,
            title,
            authors,
            cover_url,
            page_count
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (savedErr) throw savedErr;

      const accessibleShelves = await fetchAccessibleShelves(user.id);
      const shelfBookMap = await fetchShelfBookMapForShelves(
        accessibleShelves.map((shelf) => shelf.id)
      );

      const formatUserBook = (ub) => {
        const book = ub.books;
        const authors = Array.isArray(book?.authors)
          ? book.authors.join(', ')
          : book?.authors || '';

        const progress =
          book?.page_count && ub.current_page
            ? Math.min(100, Math.round((ub.current_page / book.page_count) * 100))
            : 0;

        const googleVolumeId = book?.google_volume_id || '';
        const gutenbergMatch = googleVolumeId.match(/^gutenberg:(\d+)$/);
        const source = gutenbergMatch ? 'gutenberg' : null;

        return {
          id: ub.id,
          internalBookId: book?.id,
          googleVolumeId,
          title: book?.title || '',
          author: authors,
          cover: normalizeCover(book?.cover_url),
          currentPage: ub.current_page || 0,
          totalPages: book?.page_count || 0,
          pageCount: book?.page_count || 0,
          progress,
          lastRead: 'Continue',
          completedDate: ub.finished_at
            ? new Date(ub.finished_at).toLocaleDateString()
            : null,
          source,
        };
      };

      const formatSavedBook = (row) => {
        const book = row?.books;
        const authors = Array.isArray(book?.authors)
          ? book.authors.join(', ')
          : book?.authors || '';

        const internalBookId = String(book?.id ?? '');

        return {
          id: internalBookId,
          internalBookId: book?.id,
          googleVolumeId: book?.google_volume_id,
          title: book?.title || '',
          author: authors,
          cover: normalizeCover(book?.cover_url),
          totalPages: book?.page_count || 0,
          pageCount: book?.page_count || 0,
          rating: null,
          shelfIds: shelfBookMap[internalBookId] || [],
          source: book?.google_volume_id?.startsWith('gutenberg:')
            ? 'gutenberg'
            : null,
        };
      };

      const currentlyReading = (userBooks || [])
        .filter((b) => b.status === 'reading')
        .map(formatUserBook);

      const completed = (userBooks || [])
        .filter((b) => b.status === 'completed')
        .map(formatUserBook);

      const saved = (savedRows || []).map(formatSavedBook);

      setLibraryData({
        currentlyReading,
        saved,
        completed,
      });

      const normalizedShelves = [
        { id: DEFAULT_SHELF_ID, name: DEFAULT_SHELF_NAME, isOwner: true },
        ...accessibleShelves.filter((s) => s.id !== DEFAULT_SHELF_ID),
      ];

      setShelves(normalizedShelves);

      if (
        selectedShelfId !== DEFAULT_SHELF_ID &&
        !normalizedShelves.some((s) => s.id === selectedShelfId)
      ) {
        setSelectedShelfId(DEFAULT_SHELF_ID);
      }
    } catch (error) {
      console.log('Error loading books:', error);
      Alert.alert('Load failed', error?.message ?? 'Could not load library.');
    } finally {
      setLoading(false);
    }
  }, [selectedShelfId]);

  const loadSelectedShelfDetails = useCallback(async () => {
    if (!selectedShelfId || selectedShelfId === DEFAULT_SHELF_ID) {
      setSelectedShelfBooks([]);
      setSelectedShelfPeople({ owner: null, members: [] });
      return;
    }

    try {
      setShelfDetailLoading(true);

      const { data: shelfRow, error: shelfErr } = await supabase
        .from('bookshelves')
        .select('id, name, owner_user_id')
        .eq('id', selectedShelfId)
        .single();

      if (shelfErr) throw shelfErr;

      const { data: ownerProfile, error: ownerErr } = await supabase
        .from('profiles')
        .select('id, email, username, display_name')
        .eq('id', shelfRow.owner_user_id)
        .single();

      if (ownerErr) throw ownerErr;

      const { data: memberRows, error: memberErr } = await supabase
        .from('bookshelf_members')
        .select('user_id')
        .eq('shelf_id', selectedShelfId);

      if (memberErr) throw memberErr;

      const memberIds = (memberRows || []).map((m) => m.user_id).filter(Boolean);

      let memberProfiles = [];
      if (memberIds.length > 0) {
        const { data: profiles, error: membersProfileErr } = await supabase
          .from('profiles')
          .select('id, email, username, display_name')
          .in('id', memberIds);

        if (membersProfileErr) throw membersProfileErr;
        memberProfiles = profiles || [];
      }

      const { data: shelfBooksRows, error: shelfBooksErr } = await supabase
        .from('bookshelf_books')
        .select(`
          shelf_id,
          book_id,
          added_by_user_id,
          books:book_id (
            id,
            google_volume_id,
            title,
            authors,
            cover_url,
            page_count
          )
        `)
        .eq('shelf_id', selectedShelfId);

      if (shelfBooksErr) throw shelfBooksErr;

      const books = (shelfBooksRows || [])
        .map((row) => {
          const book = row.books;
          if (!book) return null;

          const authors = Array.isArray(book?.authors)
            ? book.authors.join(', ')
            : book?.authors || '';

          return {
            id: String(book.id),
            internalBookId: book.id,
            googleVolumeId: book.google_volume_id,
            title: book.title || '',
            author: authors,
            cover: normalizeCover(book.cover_url),
            totalPages: book.page_count || 0,
            pageCount: book.page_count || 0,
            rating: null,
            shelfIds: [selectedShelfId],
            source: book?.google_volume_id?.startsWith('gutenberg:')
              ? 'gutenberg'
              : null,
            addedByUserId: row.added_by_user_id || null,
          };
        })
        .filter(Boolean);

      setSelectedShelfBooks(books);
      setSelectedShelfPeople({
        owner: ownerProfile || null,
        members: memberProfiles,
      });
    } catch (e) {
      console.log('Shelf details load error:', e);
      Alert.alert('Shelf load failed', e?.message ?? 'Could not load shelf details.');
      setSelectedShelfBooks([]);
      setSelectedShelfPeople({ owner: null, members: [] });
    } finally {
      setShelfDetailLoading(false);
    }
  }, [selectedShelfId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useFocusEffect(
    useCallback(() => {
      loadSelectedShelfDetails();
    }, [loadSelectedShelfDetails])
  );

  const onPressBook = async (book) => {
    navigation.navigate('BookDetails', {
      book: {
        id: book.googleVolumeId || book.internalBookId,
        source: book.source,
        title: book.title,
        author: book.author,
        cover: book.cover,
        pageCount: book.pageCount || book.totalPages || 0,
      },
    });
  };

  const handleBookPress = (book) => {
    onPressBook(book);
  };

  const handleContinueReading = async (book) => {
    try {
      if (book.url) {
        navigation.navigate('ReadingView', {
        book: {
          ...book,
          currentPage: book.currentPage || 1,
          pageCount: book.pageCount || book.totalPages || 0,
        },
        url: book.url,
      });
        return;
      }

      const gvid = book.googleVolumeId || '';
      const m = gvid.match(/^gutenberg:(\d+)$/);

      if (m) {
        const id = m[1];
        const candidate = `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`;

        navigation.navigate('ReadingView', {
          book: {
            title: book.title,
            author: book.author,
            cover: book.cover,
            source: 'gutenberg',
            externalId: id,
            id,
            currentPage: book.currentPage || 1,
            pageCount: book.pageCount || book.totalPages || 0,
          },
          url: candidate,
        });
        return;
      }

      navigation.navigate('BookDetails', {
        book: {
          id: book.googleVolumeId || book.internalBookId,
          source: book.source,
          title: book.title,
          author: book.author,
          cover: book.cover,
          pageCount: book.pageCount || book.totalPages || 0,
        },
      });
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Failed to continue reading.');
    }
  };

  const handleCreateShelf = async () => {
    try {
      const trimmed = newShelfName.trim();

      if (!trimmed) {
        Alert.alert('Missing name', 'Please enter a shelf name.');
        return;
      }

      if (!currentUserId) {
        Alert.alert('Not signed in', 'Please sign in first.');
        return;
      }

      const exists = shelves.some(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (exists) {
        Alert.alert('Shelf exists', 'A shelf with that name already exists.');
        return;
      }

      const { data: createdShelf, error: createErr } = await supabase
        .from('bookshelves')
        .insert({
          name: trimmed,
          owner_user_id: currentUserId,
        })
        .select('id, name, owner_user_id, created_at')
        .single();

      if (createErr) throw createErr;

      const { foundProfiles, missingEmails } = await resolveEmailsToProfiles(friendEmails);

      if (foundProfiles.length > 0) {
        const memberRows = foundProfiles
          .filter((profile) => profile.id !== currentUserId)
          .map((profile) => ({
            shelf_id: createdShelf.id,
            user_id: profile.id,
            added_by_user_id: currentUserId,
          }));

        if (memberRows.length > 0) {
          const { error: memberErr } = await supabase
            .from('bookshelf_members')
            .upsert(memberRows, { onConflict: 'shelf_id,user_id' });

          if (memberErr) throw memberErr;
        }
      }

      setNewShelfName('');
      setFriendEmails('');
      setCreateShelfModalVisible(false);
      setSelectedShelfId(createdShelf.id);

      await fetchData();
      await loadSelectedShelfDetails();

      if (missingEmails.length > 0) {
        Alert.alert(
          'Shelf created',
          `Shelf created, but these emails were not found: ${missingEmails.join(', ')}`
        );
      }
    } catch (e) {
      Alert.alert('Create failed', e?.message ?? 'Could not create shelf.');
    }
  };

  const openShelfPickerForBook = (book) => {
    setSelectedBookForShelf(book);
    setShelfBookModalVisible(true);
  };

  const toggleBookInShelf = async (shelfId) => {
    try {
      if (!selectedBookForShelf) return;
      if (shelfId === DEFAULT_SHELF_ID) return;
      if (!currentUserId) return;

      const bookId = selectedBookForShelf.internalBookId;
      if (!bookId) {
        Alert.alert('Unavailable', 'This book is missing its internal ID.');
        return;
      }

      const alreadyInShelf =
        selectedBookForShelf?.shelfIds?.includes(shelfId) || false;

      if (alreadyInShelf) {
        const { error } = await supabase
          .from('bookshelf_books')
          .delete()
          .eq('shelf_id', shelfId)
          .eq('book_id', bookId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bookshelf_books')
          .upsert(
            {
              shelf_id: shelfId,
              book_id: bookId,
              added_by_user_id: currentUserId,
            },
            { onConflict: 'shelf_id,book_id' }
          );

        if (error) throw error;
      }

      await fetchData();
      if (selectedShelfId === shelfId) {
        await loadSelectedShelfDetails();
      }

      setSelectedBookForShelf((prev) => {
        if (!prev) return null;
        const updatedShelfIds = alreadyInShelf
          ? (prev.shelfIds || []).filter((id) => id !== shelfId)
          : [...(prev.shelfIds || []), shelfId];

        return {
          ...prev,
          shelfIds: updatedShelfIds,
        };
      });
    } catch (e) {
      Alert.alert('Update failed', e?.message ?? 'Could not update shelf.');
    }
  };

  const handleDeleteShelf = (shelf) => {
    if (shelf.id === DEFAULT_SHELF_ID) return;
    if (!shelf.isOwner) {
      Alert.alert('Not allowed', 'Only the shelf owner can delete this shelf.');
      return;
    }

    Alert.alert(
      'Delete shelf',
      `Delete "${shelf.name}"? Books will stay in Saved but be removed from this shelf.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookshelves')
                .delete()
                .eq('id', shelf.id)
                .eq('owner_user_id', currentUserId);

              if (error) throw error;

              if (selectedShelfId === shelf.id) {
                setSelectedShelfId(DEFAULT_SHELF_ID);
              }

              await fetchData();
              await loadSelectedShelfDetails();
            } catch (e) {
              Alert.alert('Delete failed', e?.message ?? 'Could not delete shelf.');
            }
          },
        },
      ]
    );
  };

  const filteredSavedBooks = useMemo(() => {
    if (selectedShelfId === DEFAULT_SHELF_ID) {
      return libraryData.saved;
    }
    return selectedShelfBooks;
  }, [libraryData.saved, selectedShelfId, selectedShelfBooks]);

  const getShelfCount = (shelfId) => {
    if (shelfId === DEFAULT_SHELF_ID) return libraryData.saved.length;
    if (shelfId === selectedShelfId) return filteredSavedBooks.length;

    return libraryData.saved.filter((book) =>
      (book.shelfIds || []).includes(shelfId)
    ).length;
  };

  const CurrentlyReadingCard = ({ book }) => (
    <TouchableOpacity
      style={styles.currentCard}
      onPress={() => handleBookPress(book)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: book.cover }}
        style={styles.currentCover}
        resizeMode="cover"
      />

      <View style={styles.currentInfo}>
        <View style={styles.currentHeader}>
          <View style={styles.currentTitleContainer}>
            <Text style={styles.currentTitle} numberOfLines={2}>
              {book.title}
            </Text>
            <Text style={styles.currentAuthor}>{book.author}</Text>
          </View>

          <View style={styles.progressCircle}>
            <Text style={styles.progressCircleText}>{book.progress}%</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${book.progress}%` }]} />
            </View>
          </View>

          <View style={styles.progressDetails}>
            <View style={styles.progressDetailItem}>
              <Ionicons name="bookmark-outline" size={14} color={colors.secondary} />
              <Text style={styles.progressDetailText}>
                Page {book.currentPage} of {book.totalPages}
              </Text>
            </View>
            <View style={styles.progressDetailItem}>
              <Ionicons name="time-outline" size={14} color={colors.secondary} />
              <Text style={styles.progressDetailText}>{book.lastRead}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={(e) => {
            e.stopPropagation();
            handleContinueReading(book);
          }}
        >
          <Ionicons name="play" size={16} color={colors.buttonText} />
          <Text style={styles.continueButtonText}>Continue Reading</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.buttonText} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const BookCard = ({ book, showDate, savedCard = false }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => handleBookPress(book)}
      activeOpacity={0.8}
    >
      <View style={styles.bookCardContent}>
        <Image
          source={{ uri: book.cover }}
          style={styles.bookCover}
          resizeMode="cover"
        />

        {showDate && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
          </View>
        )}

        {savedCard && selectedShelfId === DEFAULT_SHELF_ID ? (
          <TouchableOpacity
            style={styles.shelfIconButton}
            onPress={(e) => {
              e.stopPropagation();
              openShelfPickerForBook(book);
            }}
          >
            <Ionicons name="library-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          {book.author}
        </Text>

        <View style={styles.bookMeta}>
          {book.rating ? (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{book.rating}</Text>
            </View>
          ) : null}

          {showDate && book.completedDate ? (
            <>
              {book.rating ? <Text style={styles.metaDot}>•</Text> : null}
              <Text style={styles.completedDate}>{book.completedDate}</Text>
            </>
          ) : null}
        </View>

        {savedCard && book.shelfIds?.length > 0 && selectedShelfId === DEFAULT_SHELF_ID ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.inlineShelfTags}
          >
            {book.shelfIds.map((shelfId) => {
              const shelf = shelves.find((s) => s.id === shelfId);
              if (!shelf) return null;

              return (
                <View key={shelfId} style={styles.inlineShelfTag}>
                  <Text style={styles.inlineShelfTagText}>{shelf.name}</Text>
                </View>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const renderShelfPeopleHeader = () => {
    if (selectedShelfId === DEFAULT_SHELF_ID) return null;

    const people = [
      selectedShelfPeople.owner,
      ...selectedShelfPeople.members.filter(
        (member) => member?.id !== selectedShelfPeople.owner?.id
      ),
    ].filter(Boolean);

    return (
      <View style={styles.peopleCard}>
        <Text style={styles.peopleTitle}>People in this shelf</Text>

        {selectedShelfPeople.owner ? (
          <View style={styles.personRow}>
            <Ionicons name="person-circle-outline" size={18} color={colors.buttonPrimary} />
            <Text style={styles.personText}>
              Owner: {displayPerson(selectedShelfPeople.owner)}
            </Text>
          </View>
        ) : null}

        {people.length > 1 ? (
          <View style={styles.peopleWrap}>
            {people
              .filter((person) => person?.id !== selectedShelfPeople.owner?.id)
              .map((person) => (
                <View key={person.id} style={styles.personChip}>
                  <Text style={styles.personChipText}>{displayPerson(person)}</Text>
                </View>
              ))}
          </View>
        ) : (
          <Text style={styles.peopleEmptyText}>No other members yet.</Text>
        )}
      </View>
    );
  };

  const renderSavedContent = () => {
    return (
      <View style={styles.gridContainer}>
        <View style={styles.shelfHeaderRow}>
          <Text style={styles.sectionTitle}>Your Shelves</Text>

          <TouchableOpacity
            style={styles.createShelfButton}
            onPress={() => setCreateShelfModalVisible(true)}
          >
            <Ionicons name="add" size={16} color={colors.buttonText} />
            <Text style={styles.createShelfButtonText}>New Shelf</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfTabsContainer}
        >
          {shelves.map((shelf) => {
            const active = selectedShelfId === shelf.id;

            return (
              <TouchableOpacity
                key={shelf.id}
                style={[styles.shelfChip, active && styles.shelfChipActive]}
                onPress={() => setSelectedShelfId(shelf.id)}
                onLongPress={() => {
                  if (shelf.id !== DEFAULT_SHELF_ID && shelf.isOwner) {
                    handleDeleteShelf(shelf);
                  }
                }}
              >
                <Text style={[styles.shelfChipText, active && styles.shelfChipTextActive]}>
                  {shelf.name} ({getShelfCount(shelf.id)})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {renderShelfPeopleHeader()}

        {shelfDetailLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.buttonPrimary} />
          </View>
        ) : filteredSavedBooks.length > 0 ? (
          <View style={styles.gridContent}>
            {filteredSavedBooks.map((book) => (
              <BookCard key={book.id} book={book} savedCard={true} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="library-outline"
            title="No books in this shelf"
            text={
              selectedShelfId === DEFAULT_SHELF_ID
                ? 'Save books to see them here'
                : 'No one has added books to this shelf yet'
            }
          />
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      );
    }

    if (selectedTab === 'currentlyReading') {
      return (
        <View style={styles.content}>
          {libraryData.currentlyReading.length > 0 ? (
            libraryData.currentlyReading.map((book) => (
              <CurrentlyReadingCard key={book.id} book={book} />
            ))
          ) : (
            <EmptyState
              icon="book-outline"
              title="No books in progress"
              text="Start reading a book to see it here"
            />
          )}
        </View>
      );
    }

    if (selectedTab === 'saved') {
      return renderSavedContent();
    }

    if (selectedTab === 'completed') {
      return (
        <View style={styles.gridContainer}>
          {libraryData.completed.length > 0 ? (
            <View style={styles.gridContent}>
              {libraryData.completed.map((book) => (
                <BookCard key={book.id} book={book} showDate={true} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              title="No completed books"
              text="Finished books will appear here"
            />
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <ImageBackground
      source={require('../assets/background2.png')}
      style={styles.backgroundContainer}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.statBox}>
            <View style={styles.statIconContainer}>
              <Ionicons name="book" size={24} color={colors.buttonPrimary} />
            </View>
            <Text style={styles.statNumber}>{libraryData.currentlyReading.length}</Text>
            <Text style={styles.statLabel}>Reading</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={styles.statIconContainer}>
              <Ionicons name="bookmark" size={24} color="#FF9800" />
            </View>
            <Text style={styles.statNumber}>{libraryData.saved.length}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={styles.statIconContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.statNumber}>{libraryData.completed.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'currentlyReading' && styles.tabActive]}
            onPress={() => setSelectedTab('currentlyReading')}
          >
            <Ionicons
              name="book"
              size={20}
              color={
                selectedTab === 'currentlyReading'
                  ? colors.buttonPrimary
                  : colors.secondary
              }
            />
            <Text
              style={[
                styles.tabText,
                selectedTab === 'currentlyReading' && styles.tabTextActive,
              ]}
            >
              Reading
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, selectedTab === 'saved' && styles.tabActive]}
            onPress={() => setSelectedTab('saved')}
          >
            <Ionicons
              name="bookmark"
              size={20}
              color={selectedTab === 'saved' ? colors.buttonPrimary : colors.secondary}
            />
            <Text
              style={[styles.tabText, selectedTab === 'saved' && styles.tabTextActive]}
            >
              Saved
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, selectedTab === 'completed' && styles.tabActive]}
            onPress={() => setSelectedTab('completed')}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={
                selectedTab === 'completed'
                  ? colors.buttonPrimary
                  : colors.secondary
              }
            />
            <Text
              style={[
                styles.tabText,
                selectedTab === 'completed' && styles.tabTextActive,
              ]}
            >
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderContent()}
        </ScrollView>

        <Modal
          transparent
          animationType="fade"
          visible={createShelfModalVisible}
          onRequestClose={() => setCreateShelfModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Create Shelf</Text>

              <TextInput
                value={newShelfName}
                onChangeText={setNewShelfName}
                placeholder="Ex: Summer Readers"
                placeholderTextColor={colors.secondary}
                style={styles.input}
              />

              <Text style={styles.inviteLabel}>Invite Friends by Email</Text>
              <TextInput
                value={friendEmails}
                onChangeText={setFriendEmails}
                placeholder="friend1@email.com, friend2@email.com"
                placeholderTextColor={colors.secondary}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.inviteHint}>
                Separate multiple emails with commas.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setCreateShelfModalVisible(false);
                    setNewShelfName('');
                    setFriendEmails('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={handleCreateShelf}
                >
                  <Text style={styles.modalSaveText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={shelfBookModalVisible}
          onRequestClose={() => setShelfBookModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add to Shelves</Text>

              {selectedBookForShelf ? (
                <Text style={styles.modalSubtitle} numberOfLines={2}>
                  {selectedBookForShelf.title}
                </Text>
              ) : null}

              <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                {shelves
                  .filter((shelf) => shelf.id !== DEFAULT_SHELF_ID)
                  .map((shelf) => {
                    const inShelf = selectedBookForShelf?.shelfIds?.includes(shelf.id);

                    return (
                      <TouchableOpacity
                        key={shelf.id}
                        style={styles.shelfSelectRow}
                        onPress={() => toggleBookInShelf(shelf.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shelfSelectText}>{shelf.name}</Text>
                          {!shelf.isOwner ? (
                            <Text style={styles.sharedHint}>Shared with you</Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name={inShelf ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={inShelf ? colors.buttonPrimary : colors.secondary}
                        />
                      </TouchableOpacity>
                    );
                  })}

                {shelves.filter((s) => s.id !== DEFAULT_SHELF_ID).length === 0 ? (
                  <Text style={styles.noShelvesText}>
                    No custom shelves yet. Create one first.
                  </Text>
                ) : null}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={() => setShelfBookModalVisible(false)}
                >
                  <Text style={styles.modalSaveText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const EmptyState = ({ icon, title, text }) => (
  <View style={styles.emptyState}>
    <Ionicons name={icon} size={64} color={colors.border} />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

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
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    marginBottom: spacing.xs,
  },
  statNumber: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.buttonPrimary,
  },
  tabText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },
  tabTextActive: {
    color: colors.buttonPrimary,
    fontWeight: typography.fontWeights.semibold,
  },

  scrollContent: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },

  gridContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  gridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  currentCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currentCover: {
    width: 90,
    height: 135,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  currentInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  currentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  currentTitleContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  currentTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  currentAuthor: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },

  progressCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.buttonPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.buttonText,
  },

  progressSection: {
    marginBottom: spacing.sm,
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
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressDetailText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },

  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    gap: spacing.xs,
  },
  continueButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    flex: 1,
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },

  shelfHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  createShelfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.buttonPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    gap: 6,
  },
  createShelfButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },

  shelfTabsContainer: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  shelfChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  shelfChipActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  shelfChipText: {
    color: colors.primary,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
  },
  shelfChipTextActive: {
    color: colors.buttonText,
    fontWeight: typography.fontWeights.semibold,
  },

  peopleCard: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  peopleTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  personText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
  },
  peopleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  personChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  personChipText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },
  peopleEmptyText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },

  bookCard: {
    width: '47%',
    marginBottom: spacing.md,
  },
  bookCardContent: {
    position: 'relative',
  },
  bookCover: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  shelfIconButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookInfo: {
    marginTop: spacing.sm,
  },
  bookTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: 4,
    height: 34,
  },
  bookAuthor: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  bookMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  metaDot: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },
  completedDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },

  inlineShelfTags: {
    paddingTop: spacing.xs,
    gap: 6,
  },
  inlineShelfTag: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  inlineShelfTagText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    textAlign: 'center',
  },

  loadingWrap: {
    paddingTop: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    fontSize: typography.fontSizes.sm,
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
    backgroundColor: '#FFF',
  },
  inviteLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginBottom: spacing.sm,
  },
  inviteHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  modalButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
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
  shelfSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shelfSelectText: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
  },
  sharedHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: 2,
  },
  noShelvesText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});