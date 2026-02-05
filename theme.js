// NextChapter Theme
//Inspired by Kindle

export const colors = {
  // Primary colors
  primary: '#2C2C2C',
  secondary: '#666666',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  
  // UI element colors
  border: '#CCCCCC',        // for borders
  divider: '#E0E0E0',       //for dividers
  
  // Interactive elements
  buttonPrimary: '#4A4A4A', //for primary buttons
  buttonText: '#FFFFFF',    // White text on dark buttons
  
  // Navigation
  navBackground: '#2C2C2C',
  navText: '#FFFFFF',
  sidebarBackground: '#E8E8E8',
  sidebarText: '#2C2C2C',
  sidebarActive: '#CCCCCC',
  
  // Reading view
  pageBackground: '#FAFAFA',
  highlight: '#FFE082',      
  annotation: '#90CAF9',  
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
};

export const typography = {
  fonts: {
    regular: 'System',      // Default font
    serif: 'Georgia',       // FOr the eading view
    heading: 'System',      // For headings
  },
  
  // Font sizes
  fontSizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  
  // Font weights
  fontWeights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  // Line heights for readability
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
    reading: 2.0, // Extra spacing for the reading view
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};