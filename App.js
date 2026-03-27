import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

// Import all of the screens
import BookDetailsScreen from './screens/BookDetailsScreen';
import CommunityScreen from './screens/CommunityScreen';
import HomeScreen from './screens/HomeScreen';
import MyBooksScreen from './screens/MyBooksScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import SurveyScreen from './screens/SurveyScreen';
import NewPasswordScreen from './screens/NewPasswordScreen';
import BooksPage from './screens/BooksPage';
import LoginScreen from './screens/LoginScreen';
import ReadingStatsScreen from './screens/ReadingStatsScreen';
import ReadingViewScreen from './screens/ReadingViewScreen';

// Import theme
import theme from './theme';
const colors = theme.colors;

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

const prefix = Linking.createURL('/');

// Home Stack
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen
        name="BookDetails"
        component={BookDetailsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.navBackground },
          headerTintColor: colors.navText,
          headerTitle: 'Book Details',
        }}
      />
      <Stack.Screen name="ReadingView" component={ReadingViewScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Search Stack
function SearchStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchMain" component={BooksPage} />
      <Stack.Screen
        name="BookDetails"
        component={BookDetailsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.navBackground },
          headerTintColor: colors.navText,
          headerTitle: 'Book Details',
        }}
      />
      <Stack.Screen name="ReadingView" component={ReadingViewScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// MyBooks Stack
function MyBooksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyBooksMain" component={MyBooksScreen} />
      <Stack.Screen
        name="BookDetails"
        component={BookDetailsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.navBackground },
          headerTintColor: colors.navText,
          headerTitle: 'Book Details',
        }}
      />
      <Stack.Screen name="ReadingView" component={ReadingViewScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Profile Stack
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen
        name="ReadingStats"
        component={ReadingStatsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.navBackground },
          headerTintColor: colors.navText,
          headerTitle: 'Reading Statistics',
        }}
      />
    </Stack.Navigator>
  );
}

function DrawerNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        drawerStyle: { backgroundColor: colors.sidebarBackground, width: 240 },
        drawerActiveTintColor: '#FFFFFF',
        drawerInactiveTintColor: colors.sidebarText,
        drawerActiveBackgroundColor: colors.sidebarActive,
        drawerLabelStyle: { fontSize: 16, fontWeight: '500', marginLeft: 1 },
        drawerItemStyle: { borderRadius: 8, marginHorizontal: 8, marginVertical: 8, paddingVertical: 4 },
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeStack}
        options={{
          drawerLabel: 'Home',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Search"
        component={SearchStack}
        options={{
          drawerLabel: 'Search Books',
          title: 'Search Books',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="MyBooks"
        component={MyBooksStack}
        options={{
          drawerLabel: 'My Books',
          title: 'My Books',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          drawerLabel: 'Community',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          drawerLabel: 'User Profile',
          title: 'User Profile',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

export default function App() {
  const navigationRef = useRef(null);

  // handle deep links for any future use
  useEffect(() => {
    const subscription = Linking.addEventListener('url', () => {});
    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={{ prefixes: [prefix, 'nextchapter://'] }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen
          name="NewPassword"
          component={NewPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Survey"
          component={SurveyScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Home" component={DrawerNavigator} />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.navBackground },
            headerTintColor: colors.navText,
            headerTitle: 'Edit Profile',
            headerBackTitle: 'Profile',
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.navBackground },
            headerTintColor: colors.navText,
            headerTitle: 'Settings',
            headerBackTitle: 'Profile',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}