import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import 'react-native-gesture-handler';

// Import all of the screens
import BookDetailsScreen from './screens/BookDetailsScreen';
//import BookSearchScreen from './screens/BookSearchScreen';
import CommunityScreen from './screens/CommunityScreen';
import HomeScreen from './screens/HomeScreen';
import MyBooksScreen from './screens/MyBooksScreen';
import ProfileScreen from './screens/ProfileScreen';
import BooksPage from './Fenoon/BooksPage';
//import ReaderScreen from "./Fenoon/readerScreen";
import LoginScreen from './screens/LoginScreen'; // add login screen

// Import theme
import theme from './theme';
const colors = theme.colors;

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// Home Stack, includes home and book details 
function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
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
    </Stack.Navigator>
  );
}

// Had to make Drawer its own function so we can wrap it with Login
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{
        // Header styling
        headerStyle: {
          backgroundColor: colors.navBackground,
        },
        headerTintColor: colors.navText,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        
        // Drawer style
        drawerStyle: {
          backgroundColor: colors.sidebarBackground,
          width: 240,
        },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.sidebarText,
        drawerActiveBackgroundColor: colors.sidebarActive,
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '500',
          marginLeft: -16,
        },
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
        component={BooksPage}
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
        component={MyBooksScreen}
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
        component={CommunityScreen}
        options={{
          drawerLabel: 'Community',
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
        component={ProfileScreen}
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
// Make Login the first screen, the direct user to Home (drawer) once login
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={DrawerNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
