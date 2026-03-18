import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ReaderProvider } from "@epubjs-react-native/core";
import 'react-native-gesture-handler';

import BookDetailsScreen from './screens/BookDetailsScreen';
import CommunityScreen from './screens/CommunityScreen';
import HomeScreen from './screens/HomeScreen';
import MyBooksScreen from './screens/MyBooksScreen';
import ProfileScreen from './screens/ProfileScreen';
import BooksPage from './screens/BooksPage';
import LoginScreen from './screens/LoginScreen';
import ReadingStatsScreen from './screens/ReadingStatsScreen';
import ReadingViewScreen from './screens/ReadingViewScreen';
import ReaderScreen from "./screens/readerScreen";
import ClubDetailScreen from './screens/ClubDetailScreen';
import DiscussionThreadScreen from './screens/DiscussionThreadScreen';

import theme from './theme';
const colors = theme.colors;

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// Home Stack - includes home and book details

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
      <Stack.Screen
        name="ReadingView"
        component={ReadingViewScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

// Search Stack
function SearchStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="SearchMain" component={BooksPage} />
      <Stack.Screen
        name="BookDetails"
        component={BookDetailsScreen}
        options={{
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.navBackground,
          },
          headerTintColor: colors.navText,
          headerTitle: 'Book Details',
        }}
      />
      <Stack.Screen
        name="ReadingView"
        component={ReadingViewScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

// MyBooks Stack - includes my books and book details
function MyBooksStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MyBooksMain" component={MyBooksScreen} />
      <Stack.Screen
        name="BookDetails"
        component={BookDetailsScreen}
        options={{
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.navBackground,
          },
          headerTintColor: colors.navText,
          headerTitle: 'Book Details',
        }}
      />
      <Stack.Screen
        name="ReadingView"
        component={ReadingViewScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

// Profile Stack - includes profile and reading stats
function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen
        name="ReadingStats"
        component={ReadingStatsScreen}
        options={{
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.navBackground,
          },
          headerTintColor: colors.navText,
          headerTitle: 'Reading Statistics',
        }}
      />
    </Stack.Navigator>
  );
}

// Community Stack - CommunityScreen -> ClubDetailScreen -> DiscussionThreadScreen
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
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.navBackground },
        headerTintColor: colors.navText,
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        drawerStyle: { backgroundColor: colors.sidebarBackground, width: 240 },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.sidebarText,
        drawerActiveBackgroundColor: colors.sidebarActive,
        drawerLabelStyle: { fontSize: 16, fontWeight: '500', marginLeft: -16 },
        drawerItemStyle: {
          borderRadius: 8,
          marginHorizontal: 8,
          marginVertical: 8,
          paddingVertical: 4,
        },
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeStack}
        options={{
          drawerLabel: 'Home',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Drawer.Screen
        name="Search"
        component={SearchStack}
        options={{
          drawerLabel: 'Search Books',
          title: 'Search',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={size}
              color={color}
            />
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
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Drawer.Screen
        name="Community"
        component={CommunityStack}
        options={{
          drawerLabel: 'Community',
          title: 'Community',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={size}
              color={color}
            />
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
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

// Make Login the first screen, then direct user to Home (drawer) once login

export default function App() {
  return (
    <ReaderProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={DrawerNavigator} />


          <Stack.Screen name="Reader" component={ReaderScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ReaderProvider>
  );
}