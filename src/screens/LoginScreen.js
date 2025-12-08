// Login Screen for React Native

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { commonStyles, colors } from '../styles/common';
import WalletService from '../services/wallet';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [apiService, setApiService] = useState('https://api.distordia.com');
  const [customApi, setCustomApi] = useState('');
  const [loading, setLoading] = useState(false);
  const [wallet] = useState(new WalletService());

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    await wallet.initialize();
    
    // Check if already logged in
    if (wallet.isLoggedIn() && !wallet.isLocked) {
      navigation.replace('Wallet');
    }

    // Load saved API URL
    const savedUrl = await wallet.getNodeUrl();
    if (savedUrl) {
      if (savedUrl === 'https://api.distordia.com' || savedUrl === 'http://localhost:8080') {
        setApiService(savedUrl);
      } else {
        setApiService('custom');
        setCustomApi(savedUrl);
      }
    }
  };

  const handleLogin = async () => {
    if (!username || !password || !pin) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Set API URL if changed
      const finalApiUrl = apiService === 'custom' ? customApi : apiService;
      await wallet.setNodeUrl(finalApiUrl);

      // Attempt login
      await wallet.login(username, password, pin);

      // Navigate to wallet screen
      navigation.replace('Wallet');
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const openCreateWallet = () => {
    Linking.openURL('https://nexus.io/wallet');
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <KeyboardAvoidingView 
        style={commonStyles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={commonStyles.header}>
            <Text style={commonStyles.headerTitle}>Distordia Q-Wallet</Text>
            <Text style={commonStyles.headerSubtitle}>
              Quantum resistant web3. Powered by Nexus.io.
            </Text>
          </View>

          <View style={commonStyles.content}>
            <View style={commonStyles.card}>
              <Text style={[commonStyles.headerTitle, { fontSize: 20, marginBottom: 20 }]}>
                Log in with Nexus SigChain
              </Text>

              <Text style={commonStyles.label}>API Service</Text>
              <View style={{ marginBottom: 15 }}>
                <TouchableOpacity
                  style={[commonStyles.input, { flexDirection: 'row', justifyContent: 'space-between' }]}
                  onPress={() => {
                    Alert.alert(
                      'Select API Service',
                      '',
                      [
                        { text: 'api.distordia.com', onPress: () => setApiService('https://api.distordia.com') },
                        { text: 'localhost:8080', onPress: () => setApiService('http://localhost:8080') },
                        { text: 'Custom URL', onPress: () => setApiService('custom') },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <Text style={commonStyles.text}>
                    {apiService === 'custom' ? 'Custom URL' : apiService}
                  </Text>
                  <Text style={commonStyles.textSecondary}>▼</Text>
                </TouchableOpacity>
              </View>

              {apiService === 'custom' && (
                <>
                  <Text style={commonStyles.label}>Custom API URL</Text>
                  <TextInput
                    style={commonStyles.input}
                    placeholder="http://your-node:8080"
                    placeholderTextColor={colors.textSecondary}
                    value={customApi}
                    onChangeText={setCustomApi}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              <Text style={commonStyles.label}>Username</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="Enter username"
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={commonStyles.label}>Password</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="Enter password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={commonStyles.label}>PIN</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="Enter PIN"
                placeholderTextColor={colors.textSecondary}
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={8}
              />

              <TouchableOpacity
                style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={commonStyles.buttonText}>Unlock Wallet</Text>
                )}
              </TouchableOpacity>

              <View style={commonStyles.divider} />

              <View style={{ alignItems: 'center' }}>
                <Text style={commonStyles.textSecondary}>
                  Don't have a Nexus SigChain yet?
                </Text>
                <TouchableOpacity
                  style={[commonStyles.button, commonStyles.buttonSecondary, { marginTop: 15 }]}
                  onPress={openCreateWallet}
                >
                  <Text style={commonStyles.buttonText}>
                    Create SigChain in Nexus.io wallet
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
