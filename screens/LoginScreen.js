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
  ImageBackground,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const { height } = useWindowDimensions();
  const isCompactHeight = height < 760;
  const isPhone = Platform.OS === 'ios' || Platform.OS === 'android';
  const isWeb = Platform.OS === 'web';

  const [currentView, setCurrentView] = useState('choice'); // 'choice', 'login', 'register', 'forgotEmail', 'forgotOTP', 'forgotNewPassword'
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirm: '' });

  // forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOTP, setForgotOTP] = useState('');

  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const navigation = useNavigation();

  const onLoginChange = (name, value) => setLoginForm((f) => ({ ...f, [name]: value }));
  const onRegisterChange = (name, value) => setRegisterForm((f) => ({ ...f, [name]: value }));

  const resetForms = () => {
    setLoginForm({ email: '', password: '' });
    setRegisterForm({ username: '', email: '', password: '', confirm: '' });
    setForgotEmail('');
    setForgotOTP('');
    setError('');
  };

  const handleLogin = async () => {
    setError('');
    setPending(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });
      if (error) throw error;
      navigation.replace('Main');
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
        options: {
          data: {
            username: registerForm.username,
            display_name: registerForm.username,
          },
        },
      });
      if (signUpError) throw signUpError;

      // 2. Update or create the profile row with the chosen username
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          username: registerForm.username,
          display_name: registerForm.username,
        }, { onConflict: 'id' });
      if (profileError) throw profileError;

      // 3. Send new users to onboarding survey
      navigation.replace('Survey');
    } catch (err) {
      setError(err.message || 'Sign up failed');
    } finally {
      setPending(false);
    }
  };

  // step 1 — send OTP code to email
  const handleSendOTP = async () => {
    setError('');
    if (!forgotEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setPending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: forgotEmail.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: null, // forces OTP code instead of magic link
        },
      });
      if (error) throw error;
      setCurrentView('forgotOTP');
    } catch (err) {
      setError(err.message || 'Could not send code. Check your email and try again.');
    } finally {
      setPending(false);
    }
  };

  // step 2 — verify OTP code
  const handleVerifyOTP = async () => {
    setError('');
    if (!forgotOTP.trim() || forgotOTP.length < 6) {
      setError('Please enter the 6-digit code from your email.');
      return;
    }
    setPending(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: forgotEmail.trim(),
        token: forgotOTP.trim(),
        type: 'email',
      });
      if (error) throw error;
      navigation.navigate('NewPassword');
    } catch (err) {
      setError(err.message || 'Invalid or expired code. Try again.');
    } finally {
      setPending(false);
    }
  };

  // step 3 — set new password

  // ─── Choice Screen ──
  if (currentView === 'choice') {
    return (
      <ImageBackground source={require('../assets/background.png')} style={styles.container} resizeMode="cover">
        <View
          style={[
            styles.welcomeSection,
            isCompactHeight && styles.welcomeSectionCompact,
            isPhone && styles.welcomeSectionPhone,
            isPhone && isCompactHeight && styles.welcomeSectionPhoneCompact,
          ]}
        >
          <Text style={styles.welcomeTitle}>Welcome to</Text>
          <Text style={styles.appName}>Next Chapter</Text>
          <Text style={styles.tagline}>Read. Discover. Connect.</Text>
        </View>
        <View
          style={[
            styles.choiceContainer,
            isWeb && styles.choiceContainerWeb,
            isPhone && styles.choiceContainerPhone,
            isPhone && isCompactHeight && styles.choiceContainerPhoneCompact,
          ]}
        >
          <View style={styles.choiceCard}>
            <TouchableOpacity style={styles.primaryChoice} onPress={() => setCurrentView('register')}>
              <Text style={styles.primaryChoiceText}>I'm New Here</Text>
              <Text style={styles.primaryChoiceSubtext}>Create an account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryChoice} onPress={() => setCurrentView('login')}>
              <Text style={styles.secondaryChoiceText}>I Have an Account</Text>
              <Text style={styles.secondaryChoiceSubtext}>Sign in to continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  }

  // ─── Login Form ───
  if (currentView === 'login') {
    return (
      <ImageBackground source={require('../assets/background.png')} style={styles.container} resizeMode="cover">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContentForm} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue reading</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={loginForm.email}
                onChangeText={(v) => onLoginChange('email', v)}
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
                onChangeText={(v) => onLoginChange('password', v)}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Enter password"
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => { resetForms(); setCurrentView('forgotEmail'); }}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.button, pending && styles.buttonDisabled]} onPress={handleLogin} disabled={pending}>
              <Text style={styles.buttonText}>{pending ? 'Signing in...' : 'Sign In'}</Text>
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
      </ImageBackground>
    );
  }

  // ─── Register Form ────
  if (currentView === 'register') {
    return (
      <ImageBackground source={require('../assets/background.png')} style={styles.container} resizeMode="cover">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContentForm} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.title}>New Reader?</Text>
            <Text style={styles.subtitle}>Join the Next Chapter Community!</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={registerForm.username}
                onChangeText={(v) => onRegisterChange('username', v)}
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
                onChangeText={(v) => onRegisterChange('email', v)}
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
                onChangeText={(v) => onRegisterChange('password', v)}
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
                onChangeText={(v) => onRegisterChange('confirm', v)}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Confirm password"
                placeholderTextColor="#999"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.button, pending && styles.buttonDisabled]} onPress={handleRegister} disabled={pending}>
              <Text style={styles.buttonText}>{pending ? 'Creating account...' : 'Create Account'}</Text>
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
      </ImageBackground>
    );
  }

  // ─── Forgot Password: Step 1 — Enter Email ────
  if (currentView === 'forgotEmail') {
    return (
      <ImageBackground source={require('../assets/background.png')} style={styles.container} resizeMode="cover">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContentForm} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>Enter your email and we'll send you a 6-digit code</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={forgotEmail}
                onChangeText={setForgotEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Enter your email"
                placeholderTextColor="#999"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.button, pending && styles.buttonDisabled]} onPress={handleSendOTP} disabled={pending}>
              <Text style={styles.buttonText}>{pending ? 'Sending...' : 'Send Code'}</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Remember your password? </Text>
              <TouchableOpacity onPress={() => { resetForms(); setCurrentView('login'); }}>
                <Text style={styles.link}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    );
  }

  // ─── Forgot Password: Step 2 — Enter OTP Code ───
  if (currentView === 'forgotOTP') {
    return (
      <ImageBackground source={require('../assets/background.png')} style={styles.container} resizeMode="cover">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContentForm} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{forgotEmail}</Text>
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>6-Digit Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={forgotOTP}
                onChangeText={setForgotOTP}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor="#999"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.button, pending && styles.buttonDisabled]} onPress={handleVerifyOTP} disabled={pending}>
              <Text style={styles.buttonText}>{pending ? 'Verifying...' : 'Verify Code'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendButton} onPress={handleSendOTP} disabled={pending}>
              <Text style={styles.resendText}>Didn't get a code? Resend</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => { setCurrentView('forgotEmail'); setError(''); }}>
                <Text style={styles.link}>← Change email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    );
  }

}

// Kindle style layout
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
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
    top: 250,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  welcomeSectionCompact: {
    top: 185,
  },
  welcomeSectionPhone: {
    top: 280,
  },
  welcomeSectionPhoneCompact: {
    top: 210,
  },
  welcomeTitle: {
    fontSize: 22,
    color: '#581215',
    marginBottom: 5,
    textAlign: 'center',
    fontFamily: 'Georgia',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#581215',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Georgia',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tagline: {
    fontSize: 16,
    color: '#581215',
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: 'Georgia',
    textShadowColor: 'rgba(255, 255, 255, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  choiceContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 240,
    paddingBottom: 70,
  },
  choiceContainerWeb: {
    paddingBottom: 250,
  },
  choiceContainerPhone: {
    paddingBottom: 115,
  },
  choiceContainerPhoneCompact: {
    paddingBottom: 90,
  },
  choiceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
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
    backgroundColor: '#581215',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryChoiceText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    fontFamily: 'Georgia',
  },
  primaryChoiceSubtext: {
    color: 'white',
    fontSize: 13,
    opacity: 0.9,
  },
  secondaryChoice: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#581215',
  },
  secondaryChoiceText: {
    color: '#581215',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    fontFamily: 'Georgia',
  },
  secondaryChoiceSubtext: {
    color: '#581215',
    fontSize: 13,
    opacity: 0.7,
  },
  scrollContentForm: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 120,
    paddingBottom: 100,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
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
    color: '#581215',
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  subtitle: {
    fontSize: 14,
    color: '#581215',
    marginBottom: 25,
    textAlign: 'center',
  },
  emailHighlight: {
    fontWeight: '600',
    color: '#581215',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    color: '#581215',
    fontWeight: '500',
    fontFamily: 'Georgia',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#2C2C2C',
    letterSpacing: 0,
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 12,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#581215',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#581215',
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
    color: '#581215',
    fontSize: 13,
    fontFamily: 'Georgia',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    color: '#581215',
    fontSize: 13,
    textDecorationLine: 'underline',
    fontFamily: 'Georgia',
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
    color: '#581215',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: '#2C2C2C',
    letterSpacing: 0,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  eyeText: {
    fontSize: 13,
    color: '#581215',
    fontWeight: '500',
  },
});