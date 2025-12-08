// Settings Screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { commonStyles, colors } from '../styles/common';
import WalletService from '../services/wallet';

export default function SettingsScreen({ navigation }) {
  const [wallet] = useState(new WalletService());
  const [nodeUrl, setNodeUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      await wallet.initialize();
      const url = await wallet.getNodeUrl();
      
      if (url === 'https://api.distordia.com' || url === 'http://localhost:8080') {
        setNodeUrl(url);
      } else {
        setNodeUrl('custom');
        setCustomUrl(url);
      }

      const sessionInfo = wallet.getSessionInfo();
      if (sessionInfo) {
        setUsername(sessionInfo.username);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSaveNode = async () => {
    try {
      const finalUrl = nodeUrl === 'custom' ? customUrl : nodeUrl;
      
      if (!finalUrl) {
        Alert.alert('Error', 'Please enter a valid URL');
        return;
      }

      setLoading(true);
      await wallet.setNodeUrl(finalUrl);
      Alert.alert('Success', 'Node URL updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAllConnections = () => {
    Alert.alert(
      'Revoke All Connections',
      'This will disconnect all dApp connections. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke All',
          style: 'destructive',
          onPress: async () => {
            try {
              await wallet.storage.revokeAllConnections();
              Alert.alert('Success', 'All connections revoked');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await wallet.logout();
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={commonStyles.header}>
        <View style={commonStyles.row}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
          </TouchableOpacity>
          <Text style={commonStyles.headerTitle}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <ScrollView style={commonStyles.content}>
        {/* Account Info */}
        <View style={commonStyles.card}>
          <Text style={commonStyles.label}>Logged in as</Text>
          <Text style={commonStyles.text}>{username}</Text>
        </View>

        {/* Node Configuration */}
        <View style={commonStyles.card}>
          <Text style={[commonStyles.headerTitle, { fontSize: 18, marginBottom: 15 }]}>
            Node Configuration
          </Text>

          <Text style={commonStyles.label}>API Service</Text>
          <TouchableOpacity
            style={commonStyles.input}
            onPress={() => {
              Alert.alert(
                'Select Node',
                '',
                [
                  { text: 'api.distordia.com', onPress: () => setNodeUrl('https://api.distordia.com') },
                  { text: 'localhost:8080', onPress: () => setNodeUrl('http://localhost:8080') },
                  { text: 'Custom URL', onPress: () => setNodeUrl('custom') },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            <Text style={commonStyles.text}>
              {nodeUrl === 'custom' ? 'Custom URL' : nodeUrl}
            </Text>
          </TouchableOpacity>

          {nodeUrl === 'custom' && (
            <>
              <Text style={commonStyles.label}>Custom Node URL</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="http://your-node:8080"
                placeholderTextColor={colors.textSecondary}
                value={customUrl}
                onChangeText={setCustomUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}

          <TouchableOpacity
            style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
            onPress={handleSaveNode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={commonStyles.buttonText}>Save Node Settings</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* dApp Connections (Placeholder) */}
        <View style={commonStyles.card}>
          <Text style={[commonStyles.headerTitle, { fontSize: 18, marginBottom: 15 }]}>
            dApp Connections
          </Text>
          <Text style={commonStyles.textSecondary}>
            No dApp connections (mobile app)
          </Text>
        </View>

        {/* Account Actions */}
        <View style={commonStyles.card}>
          <Text style={[commonStyles.headerTitle, { fontSize: 18, marginBottom: 15 }]}>
            Account
          </Text>

          <TouchableOpacity
            style={[commonStyles.button, { backgroundColor: colors.error }]}
            onPress={handleLogout}
          >
            <Text style={commonStyles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
