import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, } from 'react-native';
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

const STEPS = ['genres', 'goals', 'format', 'frequency'];

export default function OnboardingScreen({ navigation, route }) {
  const isRetake = route?.params?.retake || false;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // selections
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [selectedFrequency, setSelectedFrequency] = useState(null);

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
    return false;
  };

  const handleNext = () => {
    if (!isLastStep) {
      setStep((s) => s + 1);
    } else {
      handleSave();
    }
  };

  const handleSkip = () => {
    if (isRetake) {
      navigation.goBack();
    } else {
      navigation.replace('Home');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      // fetch existing preferences to merge with
      const { data: profileData } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      const existingPrefs = profileData?.preferences || {};

      const { error } = await supabase
        .from('profiles')
        .update({
          preferences: {
            ...existingPrefs,
            genres: selectedGenres,
            goals: selectedGoals,
            format: selectedFormat,
            frequency: selectedFrequency,
            onboardingComplete: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // go to home or back depending on context
      if (isRetake) {
        navigation.goBack();
      } else {
        navigation.replace('Home');
      }
    } catch (err) {
      console.log('Onboarding save error:', err.message);
      // still navigate even if save fails
      if (isRetake) {
        navigation.goBack();
      } else {
        navigation.replace('Home');
      }
    } finally {
      setSaving(false);
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
                  <Ionicons
                    name={genre.icon}
                    size={18}
                    color={selected ? '#FAFAFA' : '#4A4A4A'}
                  />
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
                  <Ionicons
                    name={goal.icon}
                    size={18}
                    color={selected ? '#FAFAFA' : '#4A4A4A'}
                  />
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
                  <Ionicons
                    name={format.icon}
                    size={24}
                    color={selected ? '#FAFAFA' : '#4A4A4A'}
                  />
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
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>Next Chapter</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>
            {isRetake ? 'Cancel' : 'Skip'}
          </Text>
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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.footer}>
        {step > 0 && (
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
            step === 0 && styles.nextButtonFull,
          ]}
          onPress={handleNext}
          disabled={!canAdvance() || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FAFAFA" />
          ) : (
            <Text style={styles.nextText}>
              {isLastStep ? 'Get Started' : 'Next'}
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