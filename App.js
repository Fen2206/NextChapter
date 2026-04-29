import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import 'react-native-gesture-handler';
import { Platform, Text, TouchableOpacity } from 'react-native';
import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

// Import all of the screens
import BookDetailsScreen from './screens/BookDetailsScreen';
import CommunityScreen from './screens/CommunityScreen';
import ClubDetailScreen from './screens/ClubDetailScreen';
import DiscussionThreadScreen from './screens/DiscussionThreadScreen';
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
import ReadingViewScreen from './screens/readerScreen';

// Import theme
import theme from './theme';
const colors = theme.colors;

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

const prefix = Linking.createURL('/');

const renderDrawerLabel = (label) => ({ focused, color }) => (
  <Text
    style={{
      fontSize: focused ? 17 : 16,
      fontWeight: focused ? '700' : '500',
      fontFamily: focused ? 'Georgia' : 'System',
      color,
      marginLeft: 1,
    }}
  >
    {label}
  </Text>
);

// Home Stack
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
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
      <Stack.Screen name="Reader" component={ReadingViewScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Search Stack
function SearchStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Search" component={BooksPage} />
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
      <Stack.Screen name="Reader" component={ReadingViewScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// MyBooks Stack
function MyBooksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyBooks" component={MyBooksScreen} />
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
      <Stack.Screen name="Reader" component={ReadingViewScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Profile Stack
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
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

function CommunityStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Community" component={CommunityScreen} />
      <Stack.Screen
        name="ClubDetail"
        component={ClubDetailScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.navBackground },
          headerTintColor: colors.navText,
          headerTitle: 'Book Club',
        }}
      />
      <Stack.Screen
        name="DiscussionThread"
        component={DiscussionThreadScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.navBackground },
          headerTintColor: colors.navText,
          headerTitle: 'Discussion',
        }}
      />
    </Stack.Navigator>
  );
}

function DrawerNavigator() {
  const isPhone = Platform.OS === 'ios' || Platform.OS === 'android';

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.navBackground },
        headerTintColor: colors.navText,
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        headerLeft: isPhone
          ? () => (
              <TouchableOpacity
                onPress={() => navigation.toggleDrawer()}
                style={{ marginLeft: 14, paddingVertical: 4, paddingRight: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Open sidebar"
              >
                <Ionicons name="menu" size={28} color={colors.navText} />
              </TouchableOpacity>
            )
          : undefined,
        drawerStyle: { backgroundColor: colors.sidebarBackground, width: 240 },
        drawerActiveTintColor: '#581215',
        drawerInactiveTintColor: colors.sidebarText,
        drawerActiveBackgroundColor: 'rgba(88, 18, 21, 0.15)',
        drawerLabelStyle: { fontSize: 16, fontWeight: '500', marginLeft: 8 },
        drawerItemStyle: { borderRadius: 8, marginHorizontal: 8, marginVertical: 8, paddingVertical: 4 },
      })}
    >
      <Drawer.Screen
        name="Home"
        component={HomeStack}
        options={{
          drawerLabel: renderDrawerLabel('Home'),
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} style={{ marginRight: 6 }} />
          ),
        }}
      />
      <Drawer.Screen
        name="Search"
        component={SearchStack}
        options={{
          drawerLabel: renderDrawerLabel('Search Books'),
          title: 'Search',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} style={{ marginRight: 6 }} />
          ),
        }}
      />
      <Drawer.Screen
        name="MyBooks"
        component={MyBooksStack}
        options={{
          drawerLabel: renderDrawerLabel('My Books'),
          title: 'My Books',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={size} color={color} style={{ marginRight: 6 }} />
          ),
        }}
      />
      <Drawer.Screen
        name="Community"
        component={CommunityStack}
        options={{
          drawerLabel: renderDrawerLabel('Community'),
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} style={{ marginRight: 6 }} />
          ),
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          drawerLabel: renderDrawerLabel('User Profile'),
          title: 'User Profile',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} style={{ marginRight: 6 }} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

export default function App() {
  const navigationRef = useRef(null);

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
        <Stack.Screen name="Main" component={DrawerNavigator} />
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