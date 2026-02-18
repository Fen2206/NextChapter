import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kiqgmcvsjquxvgmbeuce.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcWdtY3ZzanF1eHZnbWJldWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDgwNzksImV4cCI6MjA4NTcyNDA3OX0.kquBZD24rUDCAT4IaII9bQmvJ31wycum6U5daM2ZoBg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});