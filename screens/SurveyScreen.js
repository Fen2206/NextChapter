import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// survey data
const GENRES = [
  { id: 'fiction', label: 'Fiction', icon: 'book' },
  { id: 'nonfiction', label: 'Non-Fiction', icon: 'newspaper' },
  { id: 'mystery', label: 'Mystery', icon: 'search' },
  { id: 'fantasy', label: 'Fantasy', icon: 'planet' },
  { id: 'scifi', label: 'Sci-Fi', icon: 'rocket' },
  { id: 'romance', label: 'Romance', icon: 'heart' },
  { id: 'horror', label: 'Horror', icon: 'skull' },
  { id: 'thriller', label: 'Thriller', icon: 'flash' },
  { id: 'biography', label: 'Biography', icon: 'person' },
  { id: 'selfhelp', label: 'Self-Help', icon: 'sunny' },
  { id: 'history', label: 'History', icon: 'time' },
  { id: 'poetry', label: 'Poetry', icon: 'musical-notes' },
];

const GOALS = [
  { id: 'relax', label: 'Relax & Unwind', icon: 'cafe' },
  { id: 'learn', label: 'Learn Something New', icon: 'school' },
  { id: 'explore', label: 'Explore New Worlds', icon: 'compass' },
  { id: 'challenge', label: 'Challenge Myself', icon: 'trophy' },
  { id: 'social', label: 'Connect with Others', icon: 'people' },
  { id: 'habit', label: 'Build a Reading Habit', icon: 'calendar' },
];

const FORMATS = [
  { id: 'physical', label: 'Physical Books', icon: 'book' },
  { id: 'ebook', label: 'E-Books', icon: 'tablet-portrait' },
  { id: 'audiobook', label: 'Audiobooks', icon: 'headset' },
  { id: 'all', label: 'All Formats', icon: 'layers' },
];

const FREQUENCIES = [
  { id: 'daily', label: 'Every day', sub: 'I read daily' },
  { id: 'few_week', label: 'A few times a week', sub: '3–5 days/week' },
  { id: 'weekly', label: 'Once a week', sub: 'Weekend reader' },
  { id: 'occasional', label: 'Occasionally', sub: 'When I find time' },
];

// map survey genre ids to club genre tags
const GENRE_LABEL_MAP = {
  fiction: 'Fiction',
  nonfiction: 'Non-Fiction',
  mystery: 'Mystery',
  fantasy: 'Fantasy',
  scifi: 'Scifi',
  romance: 'Romance',
  horror: 'Horror',
  thriller: 'Thriller',
  biography: 'Biography',
  selfhelp: 'Self-Help',
  history: 'History',
  poetry: 'Poetry',
};

const STEPS = ['genres', 'goals', 'format', 'frequency', 'clubs'];

export default function SurveyScreen({ navigation, route }) {
  const isRetake = route?.params?.retake || false;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingClubs, setLoadingClubs] = useState(false);

  // selections
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [selectedFrequency, setSelectedFrequency] = useState(null);

  // recommended clubs
  const [recommendedClubs, setRecommendedClubs] = useState([]);
  const [joiningClubId, setJoiningClubId] = useState(null);
  const [joinedClubIds, setJoinedClubIds] = useState([]);

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const toggleGenre = (id) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const toggleGoal = (id) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const canAdvance = () => {
    if (currentStep === 'genres') return selectedGenres.length > 0;
    if (currentStep === 'goals') return selectedGoals.length > 0;
    if (currentStep === 'format') return selectedFormat !== null;
    if (currentStep === 'frequency') return selectedFrequency !== null;
    if (currentStep === 'clubs') return true; // always can finish
    return false;
  };

  const handleNext = async () => {
    if (currentStep === 'frequency') {
      // save prefs and load clubs before showing clubs step
      await handleSavePreferences();
      await fetchRecommendedClubs();
      setStep((s) => s + 1);
    } else if (!isLastStep) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    if (isRetake) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
  };

  // parse author from Python dict string format e.g. {'name': 'Shari Lapena', ...}
  const parseAuthor = (raw) => {
    if (!raw) return 'Unknown';
    const s = String(raw).trim();
    const match = s.match(/'name':\s*'([^']+)'/) || s.match(/"name":\s*"([^"]+)"/);
    if (match) return match[1];
    if (!s.startsWith('{') && !s.startsWith('[')) return s;
    return 'Unknown';
  };

  // fetch recommended books from Gutenberg — fully readable, free, no restrictions
  const fetchRecommendedBooks = async (genreLabels) => {
    try {
      if (!genreLabels || genreLabels.length === 0) return [];

      const results = [];
      const seenIds = new Set();
      const TARGET = 15;

      for (const genre of genreLabels.slice(0, 3)) {
        try {
          const url = 'https://gutendex.com/books?search=' +
            encodeURIComponent(genre) + '&languages=en';

          const res = await fetch(url);
          const data = await res.json().catch(() => null);

          for (const b of data?.results || []) {
            if (seenIds.has(b.id)) continue;
            seenIds.add(b.id);

            const author = b.authors?.[0]?.name || 'Unknown';
            const cover = b.formats?.['image/jpeg'] ||
              'https://via.placeholder.com/140x210?text=No+Cover';

            // prefer html text, fall back to plain text
            const textUrl =
              b.formats?.['text/html; charset=utf-8'] ||
              b.formats?.['text/html'] ||
              b.formats?.['text/plain; charset=utf-8'] ||
              b.formats?.['text/plain'] ||
              null;

            if (!textUrl) continue; // skip books with no readable text

            results.push({
              id: String(b.id),
              source: 'gutenberg',
              title: b.title || 'Untitled',
              author,
              cover: String(cover).replace('http://', 'https://'),
              pages: 0,
              rating: null,
              isbn: null,
              textUrl,
            });

            if (results.length >= TARGET) break;
          }
        } catch (genreErr) {
          console.log('Gutenberg genre fetch error:', genreErr.message);
        }
        if (results.length >= TARGET) break;
      }

      return results.slice(0, TARGET);
    } catch (err) {
      console.log('Fetch recommended books error:', err.message);
      return [];
    }
  };

    // save preferences to supabase (called before clubs step)
  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      const existingPrefs = profileData?.preferences || {};

      // fetch recommended books based on genres
      const genreLabels = selectedGenres.map((id) => GENRE_LABEL_MAP[id]).filter(Boolean);
      const recommendedBooks = await fetchRecommendedBooks(genreLabels);

      await supabase
        .from('profiles')
        .update({
          preferences: {
            ...existingPrefs,
            genres: selectedGenres,
            goals: selectedGoals,
            format: selectedFormat,
            frequency: selectedFrequency,
            onboardingComplete: true,
            recommendedBooks,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    } catch (err) {
      console.log('Survey save error:', err.message);
    } finally {
      setSaving(false);
    }
  };

  // fetch clubs that match user's selected genres
  const fetchRecommendedClubs = async () => {
    setLoadingClubs(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // get clubs user is already a member of
      const { data: memberData } = await supabase
        .from('club_memberships')
        .select('club_id')
        .eq('user_id', user.id);
      const alreadyJoined = (memberData || []).map((m) => m.club_id);

      // map selected genre ids to their label strings for matching
      const genreLabels = selectedGenres.map((id) => GENRE_LABEL_MAP[id]).filter(Boolean);

      // fetch all public clubs
      const { data: clubs } = await supabase
        .from('clubs')
        .select('id, name, description, genres, book_id')
        .eq('is_public', true);

      if (!clubs) { setRecommendedClubs([]); return; }

      // score each club by how many genres overlap
      const scored = clubs
        .filter((c) => !alreadyJoined.includes(c.id))
        .map((c) => {
          const clubGenres = c.genres || [];
          const overlap = genreLabels.filter((g) =>
            clubGenres.some((cg) => cg.toLowerCase() === g.toLowerCase())
          ).length;
          return { ...c, score: overlap };
        })
        .filter((c) => c.score > 0) // only clubs with at least 1 match
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // top 5

      // if no matches, fall back to top 3 public clubs
      if (scored.length === 0) {
        const fallback = clubs
          .filter((c) => !alreadyJoined.includes(c.id))
          .slice(0, 3)
          .map((c) => ({ ...c, score: 0 }));
        setRecommendedClubs(fallback);
      } else {
        setRecommendedClubs(scored);
      }
    } catch (err) {
      console.log('Fetch clubs error:', err.message);
      setRecommendedClubs([]);
    } finally {
      setLoadingClubs(false);
    }
  };

  const handleJoinClub = async (clubId) => {
    setJoiningClubId(clubId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('club_memberships')
        .insert({ club_id: clubId, user_id: user.id, role: 'member' });
      if (!error) {
        setJoinedClubIds((prev) => [...prev, clubId]);
      }
    } catch (err) {
      console.log('Join club error:', err.message);
    } finally {
      setJoiningClubId(null);
    }
  };

  const handleFinish = () => {
    if (isRetake) {
      navigation.goBack();
    } else {
      navigation.replace('Home');
    }
  };

  // render step content
  const renderStep = () => {
    if (currentStep === 'genres') {
      return (
        <>
          <Text style={styles.stepTitle}>What do you love to read?</Text>
          <Text style={styles.stepSubtitle}>Pick as many as you like</Text>
          <View style={styles.chipGrid}>
            {GENRES.map((genre) => {
              const selected = selectedGenres.includes(genre.id);
              return (
                <TouchableOpacity
                  key={genre.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleGenre(genre.id)}
                >
                  <Ionicons name={genre.icon} size={18} color={selected ? '#FAFAFA' : '#4A4A4A'} />
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                    {genre.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      );
    }

    if (currentStep === 'goals') {
      return (
        <>
          <Text style={styles.stepTitle}>Why do you read?</Text>
          <Text style={styles.stepSubtitle}>Select all that apply</Text>
          <View style={styles.chipGrid}>
            {GOALS.map((goal) => {
              const selected = selectedGoals.includes(goal.id);
              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleGoal(goal.id)}
                >
                  <Ionicons name={goal.icon} size={18} color={selected ? '#FAFAFA' : '#4A4A4A'} />
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                    {goal.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      );
    }

    if (currentStep === 'format') {
      return (
        <>
          <Text style={styles.stepTitle}>How do you prefer to read?</Text>
          <Text style={styles.stepSubtitle}>Pick your favorite format</Text>
          <View style={styles.cardList}>
            {FORMATS.map((format) => {
              const selected = selectedFormat === format.id;
              return (
                <TouchableOpacity
                  key={format.id}
                  style={[styles.formatCard, selected && styles.formatCardSelected]}
                  onPress={() => setSelectedFormat(format.id)}
                >
                  <Ionicons name={format.icon} size={24} color={selected ? '#FAFAFA' : '#4A4A4A'} />
                  <Text style={[styles.formatLabel, selected && styles.formatLabelSelected]}>
                    {format.label}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={20} color="#FAFAFA" style={styles.checkmark} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      );
    }

    if (currentStep === 'frequency') {
      return (
        <>
          <Text style={styles.stepTitle}>How often do you read?</Text>
          <Text style={styles.stepSubtitle}>We'll set your goals accordingly</Text>
          <View style={styles.cardList}>
            {FREQUENCIES.map((freq) => {
              const selected = selectedFrequency === freq.id;
              return (
                <TouchableOpacity
                  key={freq.id}
                  style={[styles.freqCard, selected && styles.freqCardSelected]}
                  onPress={() => setSelectedFrequency(freq.id)}
                >
                  <View style={styles.freqText}>
                    <Text style={[styles.freqLabel, selected && styles.freqLabelSelected]}>
                      {freq.label}
                    </Text>
                    <Text style={[styles.freqSub, selected && styles.freqSubSelected]}>
                      {freq.sub}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={22} color="#FAFAFA" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      );
    }

    if (currentStep === 'clubs') {
      return (
        <>
          <Text style={styles.stepTitle}>Clubs picked for you!</Text>
          <Text style={styles.stepSubtitle}>
            Based on your interests — join any that look good!
          </Text>

          {loadingClubs ? (
            <ActivityIndicator size="large" color="#4A4A4A" style={{ marginTop: 40 }} />
          ) : recommendedClubs.length === 0 ? (
            <View style={styles.noClubs}>
              <Ionicons name="people-outline" size={48} color="#CCCCCC" />
              <Text style={styles.noClubsText}>No clubs found yet — check back soon!</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {recommendedClubs.map((club) => {
                const joined = joinedClubIds.includes(club.id);
                const joining = joiningClubId === club.id;
                return (
                  <View key={club.id} style={styles.clubCard}>
                    <View style={styles.clubInfo}>
                      <View style={styles.clubIconContainer}>
                        <Ionicons name="people" size={22} color="#4A4A4A" />
                      </View>
                      <View style={styles.clubText}>
                        <Text style={styles.clubName}>{club.name}</Text>
                        {club.description ? (
                          <Text style={styles.clubDesc} numberOfLines={2}>
                            {club.description}
                          </Text>
                        ) : null}
                        {club.genres?.length > 0 && (
                          <View style={styles.clubGenres}>
                            {club.genres.slice(0, 3).map((g) => (
                              <View key={g} style={styles.genreTag}>
                                <Text style={styles.genreTagText}>{g}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.joinButton, joined && styles.joinButtonDone]}
                      onPress={() => !joined && handleJoinClub(club.id)}
                      disabled={joined || joining}
                    >
                      {joining ? (
                        <ActivityIndicator size="small" color="#FAFAFA" />
                      ) : (
                        <Text style={styles.joinButtonText}>
                          {joined ? '✓ Joined' : 'Join'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>Next Chapter</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>{isRetake ? 'Cancel' : 'Skip'}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress dots */}
      <View style={styles.progressDots}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
          />
        ))}
      </View>

      {/* Step content */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.footer}>
        {step > 0 && currentStep !== 'clubs' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep((s) => s - 1)}
          >
            <Ionicons name="chevron-back" size={20} color="#4A4A4A" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            !canAdvance() && styles.nextButtonDisabled,
            (step === 0 || currentStep === 'clubs') && styles.nextButtonFull,
          ]}
          onPress={handleNext}
          disabled={!canAdvance() || saving}
        >
          {saving || (currentStep === 'frequency' && loadingClubs) ? (
            <ActivityIndicator color="#FAFAFA" />
          ) : (
            <Text style={styles.nextText}>
              {isLastStep ? "Let's Go!" : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
  },
  skipText: {
    fontSize: 14,
    color: '#888',
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDDDDD',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#4A4A4A',
  },
  dotDone: {
    backgroundColor: '#4A4A4A',
    opacity: 0.4,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginTop: 16,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 24,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    backgroundColor: '#4A4A4A',
    borderColor: '#4A4A4A',
  },
  chipLabel: {
    fontSize: 14,
    color: '#4A4A4A',
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: '#FAFAFA',
  },
  cardList: {
    gap: 12,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  formatCardSelected: {
    backgroundColor: '#4A4A4A',
    borderColor: '#4A4A4A',
  },
  formatLabel: {
    fontSize: 16,
    color: '#2C2C2C',
    fontWeight: '500',
    flex: 1,
  },
  formatLabelSelected: {
    color: '#FAFAFA',
  },
  checkmark: {
    marginLeft: 'auto',
  },
  freqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  freqCardSelected: {
    backgroundColor: '#4A4A4A',
    borderColor: '#4A4A4A',
  },
  freqText: {
    flex: 1,
  },
  freqLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 2,
  },
  freqLabelSelected: {
    color: '#FAFAFA',
  },
  freqSub: {
    fontSize: 13,
    color: '#888888',
  },
  freqSubSelected: {
    color: 'rgba(255,255,255,0.7)',
  },

  // Club cards
  clubCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    padding: 16,
    gap: 12,
  },
  clubInfo: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  clubIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubText: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 4,
  },
  clubDesc: {
    fontSize: 13,
    color: '#888888',
    lineHeight: 18,
    marginBottom: 8,
  },
  clubGenres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genreTag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genreTagText: {
    fontSize: 11,
    color: '#4A4A4A',
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: '#4A4A4A',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  joinButtonDone: {
    backgroundColor: '#888888',
  },
  joinButtonText: {
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: '600',
  },
  noClubs: {
    alignItems: 'center',
    marginTop: 48,
    gap: 12,
  },
  noClubsText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: '#FAFAFA',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
  },
  backText: {
    fontSize: 15,
    color: '#4A4A4A',
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4A4A4A',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  nextText: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '600',
  },
});