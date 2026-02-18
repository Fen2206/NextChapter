import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [currentView, setCurrentView] = useState('choice'); // 'choice', 'login', 'register'
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const navigation = useNavigation();

  const onLoginChange = (name, value) => {
    setLoginForm((f) => ({ ...f, [name]: value }));
  };

  const onRegisterChange = (name, value) => {
    setRegisterForm((f) => ({ ...f, [name]: value }));
  };

  const resetForms = () => {
    setLoginForm({ email: '', password: '' });
    setRegisterForm({ username: '', email: '', password: '', confirm: '' });
    setError('');
  };

  const handleLogin = async () => {
    setError('');
    setPending(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });

      if (error) throw error;

      navigation.replace('Home');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setPending(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setPending(true);

    try {
      if (!registerForm.username || !registerForm.email || !registerForm.password) {
        throw new Error('Please fill out all fields');
      }
      if (registerForm.password !== registerForm.confirm) {
        throw new Error('Passwords do not match.');
      }
      if (registerForm.password.length < 8) {
        throw new Error('Password must be at least 8 characters.');
      }
      if (!/[0-9]/.test(registerForm.password)) {
        throw new Error('Password must contain at least one number.');
      }
      if (!/[A-Z]/.test(registerForm.password)) {
        throw new Error('Password must contain at least one uppercase letter.');
      }

      // 1. Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: registerForm.email,
        password: registerForm.password,
      });

      if (signUpError) throw signUpError;

      // 2. Update profile with username (trigger already created the row)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username: registerForm.username,
          display_name: registerForm.username,
        })
        .eq('id', data.user.id);

      if (profileError) throw profileError;

      navigation.replace('Home');
    } catch (err) {
      setError(err.message || 'Sign up failed');
    } finally {
      setPending(false);
    }
  };

  // Login or Register Screen
  if (currentView === 'choice') {
    return (
      <View style={styles.container}>
        <Image
          source={require('../assets/next-chapter-logo.png')}
          style={styles.logoTopLeft}
          resizeMode="contain"
        />

        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome to</Text>
          <Text style={styles.appName}>Next Chapter</Text>
          <Text style={styles.tagline}>Read. Discover. Connect.</Text>
        </View>

        <View style={styles.choiceContainer}>
          <View style={styles.choiceCard}>
            <TouchableOpacity
              style={styles.primaryChoice}
              onPress={() => setCurrentView('register')}
            >
              <Text style={styles.primaryChoiceText}>I'm New Here</Text>
              <Text style={styles.primaryChoiceSubtext}>Create an account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryChoice}
              onPress={() => setCurrentView('login')}
            >
              <Text style={styles.secondaryChoiceText}>I Have an Account</Text>
              <Text style={styles.secondaryChoiceSubtext}>Sign in to continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Login Form
  if (currentView === 'login') {
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
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue reading</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={loginForm.email}
                onChangeText={(value) => onLoginChange('email', value)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Enter your email"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={loginForm.password}
                onChangeText={(value) => onLoginChange('password', value)}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Enter password"
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, pending && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={pending}
            >
              <Text style={styles.buttonText}>
                {pending ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => { setCurrentView('register'); resetForms(); }}>
                <Text style={styles.link}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Register Form
  if (currentView === 'register') {
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
            <Text style={styles.title}>New Reader?</Text>
            <Text style={styles.subtitle}>Join the Next Chapter Community!</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={registerForm.username}
                onChangeText={(value) => onRegisterChange('username', value)}
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="Enter your name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={registerForm.email}
                onChangeText={(value) => onRegisterChange('email', value)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="email@address.com"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={registerForm.password}
                onChangeText={(value) => onRegisterChange('password', value)}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Password"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={registerForm.confirm}
                onChangeText={(value) => onRegisterChange('confirm', value)}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Confirm password"
                placeholderTextColor="#999"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, pending && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={pending}
            >
              <Text style={styles.buttonText}>
                {pending ? 'Creating account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => { setCurrentView('login'); resetForms(); }}>
                <Text style={styles.link}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
}
//Kindle style layout
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
  welcomeSection: {
    position: 'absolute',
    top: 290,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  welcomeTitle: {
    fontSize: 22,
    color: '#666666',
    marginBottom: 5,
    textAlign: 'center',
  },
  appName: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  choiceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 290,
  },
  choiceCard: {
    backgroundColor: 'white',
    borderRadius: 0,
    padding: 25,
    width: '90%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryChoice: {
    backgroundColor: '#4A4A4A',
    borderRadius: 0,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryChoiceText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  primaryChoiceSubtext: {
    color: 'white',
    fontSize: 13,
    opacity: 0.9,
  },
  secondaryChoice: {
    backgroundColor: 'white',
    borderRadius: 0,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4A4A4A',
  },
  secondaryChoiceText: {
    color: '#4A4A4A',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  secondaryChoiceSubtext: {
    color: '#4A4A4A',
    fontSize: 13,
    opacity: 0.7,
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
    minHeight: 500,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 8,
  },
  forgotText: {
    color: '#4A4A4A',
    fontSize: 13,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    flexWrap: 'wrap',
  },
  footerText: {
    color: '#666666',
    fontSize: 13,
  },
  link: {
    color: '#4A4A4A',
    fontSize: 13,
    fontWeight: '600',
  },
});