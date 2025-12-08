// Create Account Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { commonStyles, colors } from '../styles/common';
import WalletService from '../services/wallet';

export default function CreateAccountScreen({ navigation }) {
  const [wallet] = useState(new WalletService());
  const [accountName, setAccountName] = useState('');
  const [token, setToken] = useState('NXS');
  const [loading, setLoading] = useState(false);

  const handleCreateAccount = async () => {
    if (!accountName) {
      Alert.alert('Error', 'Please enter an account name');
      return;
    }

    // Show PIN modal
    Alert.prompt(
      'Enter PIN',
      'Enter your PIN to create the account',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (pin) => {
            if (!pin) {
              Alert.alert('Error', 'PIN is required');
              return;
            }

            setLoading(true);
            try {
              await wallet.initialize();
              await wallet.createAccount(accountName, token, pin);
              Alert.alert('Success', 'Account created successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ],
      'secure-text'
    );
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <KeyboardAvoidingView 
        style={commonStyles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={commonStyles.header}>
          <View style={commonStyles.row}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
            </TouchableOpacity>
            <Text style={commonStyles.headerTitle}>Create Account</Text>
            <View style={{ width: 24 }} />
          </View>
        </View>

        <ScrollView style={commonStyles.content}>
          <View style={commonStyles.card}>
            <Text style={[commonStyles.headerTitle, { fontSize: 20, marginBottom: 20 }]}>
              New Account Details
            </Text>

            <Text style={commonStyles.label}>Account Name</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="Enter account name"
              placeholderTextColor={colors.textSecondary}
              value={accountName}
              onChangeText={setAccountName}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={commonStyles.label}>Token Type</Text>
            <TouchableOpacity
              style={commonStyles.input}
              onPress={() => {
                Alert.alert(
                  'Select Token',
                  '',
                  [
                    { text: 'NXS', onPress: () => setToken('NXS') },
                    { text: 'Cancel', style: 'cancel' }
                  ]
                );
              }}
            >
              <Text style={commonStyles.text}>{token}</Text>
            </TouchableOpacity>

            <View style={[commonStyles.card, { backgroundColor: colors.inputBg, marginTop: 20 }]}>
              <Text style={commonStyles.textSecondary}>
                ℹ️ Creating a new account will generate a unique address for receiving and storing tokens.
              </Text>
            </View>

            <TouchableOpacity
              style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
              onPress={handleCreateAccount}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={commonStyles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
