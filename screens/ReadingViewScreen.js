// ReadingViewScreen.js
// Main reading screen where users read books and create highlights
//load true book content 

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { colors, spacing, typography } from '../theme';
import HighlightColorPicker from '../components/HighlightColorPicker';
import AddNoteModal from '../components/AddNoteModal';
import HighlightsSidebar from '../components/HighlightsSidebar';

export default function ReadingViewScreen({ route, navigation }) {
  const book = route?.params?.book;
  const startPage = route?.params?.startPage || 1;

  const [highlights, setHighlights] = useState([]);
  const [selectedText, setSelectedText] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showHighlightsSidebar, setShowHighlightsSidebar] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [fontSize, setFontSize] = useState(typography.fontSizes.base);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paragraphs, setParagraphs] = useState([]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [error, setError] = useState(null);

  const scrollViewRef = useRef(null);

  const bookTitle = book?.title || 'Unknown Book';
  const bookSource = book?.source || null;
  const textUrl = book?.textUrl || book?.url || null;
  const previewUrl = book?.previewLink || book?.webReaderLink || null;
  const totalPages = book?.pages || book?.page_count || book?.totalPages || 0;

  useEffect(() => {
  console.log('useEffect fired, source:', bookSource, 'textUrl:', textUrl);
    if (!book) return;
    if (bookSource === 'gutenberg' && textUrl) {
      fetchGutenbergText();
    } else if (bookSource !== 'google' && !previewUrl) {
      setError('no_preview');
    }
  }, []);

  // extract book ID and fetch plain text from Gutenberg
  
  const fetchGutenbergText = async () => {
  console.log('fetchGutenbergText called, textUrl:', textUrl);
    setLoading(true);
    setError(null);
    try {
      // extract numeric book ID from URL
      // e.g. https://www.gutenberg.org/ebooks/30254.html.images -> 30254
      const idMatch = textUrl.match(/\/(\d+)/);
      if (!idMatch) throw new Error('Could not parse book ID');

      const bookId = idMatch[1];
      const plainTextUrl = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`;

      const res = await fetch(plainTextUrl);
      if (!res.ok) throw new Error('Failed to fetch book text');
      const raw = await res.text();
      processText(raw);
    } catch (err) {
      console.log('Gutenberg fetch error:', err.message);
      setError('fetch_failed');
    } finally {
      setLoading(false);
    }
  };

  const processText = (raw) => {
    // skip Project Gutenberg header
    const startMarkers = ['*** START OF', '***START OF'];
    let startIdx = 0;
    for (const marker of startMarkers) {
      const idx = raw.indexOf(marker);
      if (idx !== -1) {
        // skip past the marker line
        startIdx = raw.indexOf('\n', idx) + 1;
        break;
      }
    }

    // skip Project Gutenberg footer
    const endMarkers = ['*** END OF', '***END OF', 'End of Project Gutenberg'];
    let endIdx = raw.length;
    for (const marker of endMarkers) {
      const idx = raw.lastIndexOf(marker);
      if (idx > raw.length * 0.5) {
        endIdx = idx;
        break;
      }
    }

    const content = raw.slice(startIdx, endIdx);

    // find a chapter title from early lines
    const firstLines = content.split('\n').slice(0, 15);
    const titleLine = firstLines.find(
      (l) => l.trim().length > 3 && l.trim().length < 100 && l.trim() === l.trim().toUpperCase()
    );
    setChapterTitle(titleLine?.trim() || bookTitle);

    // split into readable paragraphs
    const paras = content
      .split(/\n\n+/)
      .map((l) => l.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 50 && !l.startsWith('***') && !l.startsWith('_'));
    console.log('content length:', content.length);
    console.log('first 500 chars:', content.substring(0, 500));
    console.log('paragraphs found:', paras.length);
    setParagraphs(paras.slice(0, 80).map((text, i) => ({ id: `p${i}`, text }))); 
  };

  // highlight handlers
  const handleTextPress = (paragraphId, text) => {
    setSelectedText({ paragraphId, text });
    setShowColorPicker(true);
    setPickerPosition({ x: 20, y: 300 });
  };

  const handleSelectColor = (colorOption) => {
    if (selectedText) {
      setHighlights([...highlights, {
        id: Date.now().toString(),
        paragraphId: selectedText.paragraphId,
        text: selectedText.text,
        color: colorOption.color,
        colorName: colorOption.name,
        timestamp: new Date().toISOString(),
        note: null,
      }]);
      setShowColorPicker(false);
      setSelectedText(null);
    }
  };

  const handleAddNote = () => {
    setShowColorPicker(false);
    setShowAddNote(true);
  };

  const handleSaveNote = (noteText) => {
    if (selectedText) {
      setHighlights([...highlights, {
        id: Date.now().toString(),
        paragraphId: selectedText.paragraphId,
        text: selectedText.text,
        color: '#FFF59D',
        colorName: 'Yellow',
        timestamp: new Date().toISOString(),
        note: noteText,
      }]);
      setShowAddNote(false);
      setSelectedText(null);
    }
  };

  const handleDeleteHighlight = (highlightId) => {
    setHighlights(highlights.filter((h) => h.id !== highlightId));
  };

  const isHighlighted = (paragraphId) => highlights.find((h) => h.paragraphId === paragraphId);

  const adjustFontSize = (direction) => {
    if (direction === 'increase' && fontSize < 24) setFontSize(fontSize + 2);
    else if (direction === 'decrease' && fontSize > 14) setFontSize(fontSize - 2);
  };

  // ── Google Books WebView ──────────────────────────────────────────────────────
  if (bookSource === 'google') {
    if (!previewUrl) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>Preview Not Available</Text>
            <Text style={styles.emptyText}>
              Google Books doesn't have a preview for this title.{'\n'}
              Try searching for it in the Search tab.
            </Text>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
            <Text style={styles.headerSubtitle}>Google Books Preview</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <WebView source={{ uri: previewUrl }} style={{ flex: 1 }} />
      </View>
    );
  }

  // ── No Preview Available ──────────────────────────────────────────────────────
  if (error === 'no_preview' || (!textUrl && bookSource !== 'google')) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>Preview Not Available</Text>
          <Text style={styles.emptyText}>
            Full text reading is available for public domain books in the Search tab.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Gutenberg Text Reader ─────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
          <Text style={styles.headerSubtitle}>Public Domain</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowHighlightsSidebar(true)} style={styles.headerButton}>
            <Ionicons name="bookmark" size={24} color={colors.primary} />
            {highlights.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{highlights.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(!showSettings)} style={styles.headerButton}>
            <Ionicons name="settings-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Panel */}
      {showSettings && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Font Size</Text>
            <View style={styles.fontControls}>
              <TouchableOpacity onPress={() => adjustFontSize('decrease')} style={styles.fontButton}>
                <Ionicons name="remove" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.fontSizeText}>{fontSize}pt</Text>
              <TouchableOpacity onPress={() => adjustFontSize('increase')} style={styles.fontButton}>
                <Ionicons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
          <Text style={styles.loadingText}>Loading book content...</Text>
        </View>
      ) : error === 'fetch_failed' ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>Could Not Load Book</Text>
          <Text style={styles.emptyText}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.backButton} onPress={fetchGutenbergText}>
            <Text style={styles.backButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.chapterTitle}>{chapterTitle}</Text>

          {paragraphs.map((paragraph) => {
            const highlight = isHighlighted(paragraph.id);
            return (
              <Pressable
                key={paragraph.id}
                onLongPress={() => handleTextPress(paragraph.id, paragraph.text)}
                style={styles.paragraphContainer}
              >
                <Text
                  style={[
                    styles.paragraph,
                    { fontSize },
                    highlight && {
                      backgroundColor: highlight.color,
                      paddingHorizontal: spacing.xs,
                      borderRadius: 4,
                    },
                  ]}
                >
                  {paragraph.text}
                </Text>
                {highlight?.note && (
                  <TouchableOpacity style={styles.noteIndicator}>
                    <Ionicons name="chatbox" size={16} color={colors.secondary} />
                  </TouchableOpacity>
                )}
              </Pressable>
            );
          })}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}

      {/* Highlight components */}
      <HighlightColorPicker
        visible={showColorPicker}
        position={pickerPosition}
        onSelectColor={handleSelectColor}
        onAddNote={handleAddNote}
        onCancel={() => { setShowColorPicker(false); setSelectedText(null); }}
      />
      <AddNoteModal
        visible={showAddNote}
        selectedText={selectedText?.text}
        onSave={handleSaveNote}
        onCancel={() => { setShowAddNote(false); setSelectedText(null); }}
      />
      <HighlightsSidebar
        visible={showHighlightsSidebar}
        highlights={highlights}
        onClose={() => setShowHighlightsSidebar(false)}
        onJumpToHighlight={(h) => console.log('Jump to:', h.paragraphId)}
        onDeleteHighlight={handleDeleteHighlight}
      />

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
          <Text style={styles.bottomButtonText}>Previous</Text>
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min((startPage / (totalPages || 1)) * 100, 100)}%` }]} />
          </View>
        </View>
        <TouchableOpacity style={styles.bottomButton}>
          <Text style={styles.bottomButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: { padding: spacing.sm, position: 'relative' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: colors.buttonPrimary,
    borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: typography.fontWeights.bold, color: colors.buttonText },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.md },
  headerTitle: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  headerSubtitle: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 2 },
  settingsPanel: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border, padding: spacing.md,
  },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { fontSize: typography.fontSizes.base, color: colors.primary, fontWeight: typography.fontWeights.medium },
  fontControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fontButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  fontSizeText: { fontSize: typography.fontSizes.sm, color: colors.primary, fontWeight: typography.fontWeights.medium, minWidth: 40, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: typography.fontSizes.base, color: colors.secondary },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  emptyTitle: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, color: colors.primary, textAlign: 'center' },
  emptyText: { fontSize: typography.fontSizes.base, color: colors.secondary, textAlign: 'center', lineHeight: 22 },
  backButton: { backgroundColor: colors.buttonPrimary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: 8, marginTop: spacing.md },
  backButtonText: { color: colors.buttonText, fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold },
  scrollView: { flex: 1 },
  contentContainer: { padding: spacing.lg, paddingTop: spacing.xl },
  chapterTitle: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, color: colors.primary, marginBottom: spacing.xl, textAlign: 'center' },
  paragraphContainer: { position: 'relative', marginBottom: spacing.lg },
  paragraph: {
    fontSize: typography.fontSizes.base,
    lineHeight: typography.lineHeights?.relaxed
      ? typography.lineHeights.relaxed * typography.fontSizes.base
      : 26,
    color: colors.primary,
  },
  noteIndicator: { position: 'absolute', right: -spacing.md, top: 0, padding: spacing.xs },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  bottomButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bottomButtonText: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium, color: colors.primary },
  progressContainer: { flex: 1, paddingHorizontal: spacing.md },
  progressBar: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.buttonPrimary, borderRadius: 2 },
});