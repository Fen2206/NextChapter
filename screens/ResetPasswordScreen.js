import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, } from 'react-native';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen({ navigation }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  // update the user's password via Supabase
  const handleResetPassword = async () => {
    setError('');

    if (!password || !confirm) {
      setError('Please fill out all fields.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter.');
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // show success state
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Could not reset password. Try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Image
        source={require('../assets/next-chapter-logo.png')}
        style={styles.logoTopLeft}
        resizeMode="contain"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContentForm}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formCard}>

          {success ? (
            // success state — password was reset
            <>
              <Text style={styles.title}>Password Reset!</Text>
              <Text style={styles.subtitle}>
                Your password has been updated successfully.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.replace('Login')}
              >
                <Text style={styles.buttonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </>
          ) : (
            // input state — enter new password
            <>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>Enter your new password below</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="New password"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="Confirm new password"
                  placeholderTextColor="#999"
                />
              </View>

              {/* password requirements hint */}
              <Text style={styles.hint}>
                Must be 8+ characters with at least one number and one uppercase letter.
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, pending && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={pending}
              >
                <Text style={styles.buttonText}>
                  {pending ? 'Updating...' : 'Update Password'}
                </Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  logoTopLeft: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    width: 150,
    height: 150,
    zIndex: 10,
  },
  scrollContentForm: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 230,
    paddingBottom: 100,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 0,
    padding: 25,
    width: '90%',
    maxWidth: 320,
    minHeight: 400,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2C2C2C',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    color: '#2C2C2C',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 0,
    padding: 12,
    fontSize: 15,
    color: '#2C2C2C',
  },
  hint: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 12,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#4A4A4A',
    borderRadius: 0,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#4A4A4A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#F44336',
    backgroundColor: '#FFE5E9',
    borderWidth: 1,
    borderColor: '#FFCCD5',
    borderRadius: 0,
    padding: 10,
    marginVertical: 8,
    fontSize: 13,
  },
});