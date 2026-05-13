import React, { useContext } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import SleepRecordScreen from '../screens/SleepRecordScreen';
import HistoryScreen from '../screens/HistoryScreen';
import GraphScreen from '../screens/GraphScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ResultsScreen from '../screens/ResultsScreen';
import SleepRecordDetailScreen from '../screens/SleepRecordDetailScreen';
import SleepGoalsScreen from '../screens/SleepGoalsScreen';
import InsightsScreen from '../screens/InsightsScreen';
import TeacherBlockedScreen from '../screens/TeacherBlockedScreen';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const tabIcons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: 'home-variant',
  Registrar: 'weather-night',
  Histórico: 'calendar-month-outline',
  Gráficos: 'chart-bar',
  Perfil: 'account-outline',
};

function StudentTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 12,
          minHeight: 72,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          borderRadius: 24,
          backgroundColor: 'rgba(7,11,24,0.96)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
          elevation: 16,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          marginTop: 2,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <MaterialCommunityIcons
            name={tabIcons[route.name] || 'circle-outline'}
            size={focused ? size + 3 : size + 1}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Registrar" component={SleepRecordScreen} />
      <Tab.Screen name="Histórico" component={HistoryScreen} />
      <Tab.Screen name="Gráficos" component={GraphScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useContext(AuthContext);
  if (user?.profile === 'teacher') return <TeacherBlockedScreen />;
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '900' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Tabs" component={StudentTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Resultado da noite' }} />
      <Stack.Screen name="EditarRegistro" component={SleepRecordScreen} options={{ title: 'Editar sono' }} />
      <Stack.Screen name="DetalheRegistro" component={SleepRecordDetailScreen} options={{ title: 'Detalhe do registro' }} />
      <Stack.Screen name="MetasSono" component={SleepGoalsScreen} options={{ title: 'Metas de sono' }} />
      <Stack.Screen name="Insights" component={InsightsScreen} options={{ title: 'Insights' }} />
    </Stack.Navigator>
  );
}
