// Wallet Screen - Main dashboard for React Native

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { commonStyles, colors } from '../styles/common';
import WalletService from '../services/wallet';

export default function WalletScreen({ navigation }) {
  const [wallet] = useState(new WalletService());
  const [balance, setBalance] = useState('0.00');
  const [address, setAddress] = useState('Loading...');
  const [accountName, setAccountName] = useState('Default Account');
  const [transactions, setTransactions] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [activeTab, setActiveTab] = useState('transactions');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initializeWallet();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWalletData();
    }, [])
  );

  const initializeWallet = async () => {
    await wallet.initialize();
    
    if (!wallet.isLoggedIn()) {
      navigation.replace('Login');
      return;
    }

    await loadWalletData();
  };

  const loadWalletData = async () => {
    setLoading(true);
    try {
      // Get default account info
      const account = await wallet.getAccount('default');
      setBalance(account.balance.toFixed(2));
      setAddress(account.address);
      setAccountName(account.name || 'Default Account');

      // Get transactions
      const txs = await wallet.getTransactions('default', 20);
      setTransactions(Array.isArray(txs) ? txs : []);

      // Get tokens (placeholder - would need to implement in API)
      setTokens([]);
    } catch (error) {
      console.error('Error loading wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
  };

  const copyAddress = async () => {
    await Clipboard.setStringAsync(address);
    Alert.alert('Success', 'Address copied to clipboard');
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

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const renderTransaction = (tx) => {
    const isDebit = tx.type === 'debit' || tx.op === 'DEBIT';
    const amount = tx.amount || 0;
    
    return (
      <View key={tx.txid} style={[commonStyles.card, { marginBottom: 10 }]}>
        <View style={commonStyles.row}>
          <View style={{ flex: 1 }}>
            <Text style={commonStyles.text}>
              {isDebit ? '↑ Sent' : '↓ Received'}
            </Text>
            <Text style={commonStyles.textSmall}>
              {formatDate(tx.timestamp)}
            </Text>
          </View>
          <Text style={[
            commonStyles.text,
            { color: isDebit ? colors.error : colors.success, fontWeight: 'bold' }
          ]}>
            {isDebit ? '-' : '+'}{amount.toFixed(2)} NXS
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={commonStyles.header}>
        <View style={commonStyles.row}>
          <Text style={commonStyles.headerTitle}>Distordia Q-Wallet</Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={handleRefresh} style={{ marginRight: 15 }}>
              <Text style={{ fontSize: 20 }}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
              <Text style={{ fontSize: 20 }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={{ marginTop: 15 }}>
          <Text style={commonStyles.textSecondary}>{accountName}</Text>
          <TouchableOpacity onPress={copyAddress} style={{ marginTop: 5 }}>
            <Text style={[commonStyles.textSmall, { color: colors.primary }]}>
              {address.substring(0, 12)}...{address.substring(address.length - 8)} 📋
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
        }
      >
        {/* Balance Section */}
        <View style={[commonStyles.card, { margin: 20, alignItems: 'center', padding: 30 }]}>
          <Text style={commonStyles.textSecondary}>Total Balance</Text>
          <Text style={[commonStyles.headerTitle, { fontSize: 36, marginVertical: 10 }]}>
            {balance}
          </Text>
          <Text style={commonStyles.text}>NXS</Text>
        </View>

        {/* Action Buttons */}
        <View style={[commonStyles.row, { paddingHorizontal: 20, marginBottom: 20 }]}>
          <TouchableOpacity
            style={[commonStyles.button, { flex: 1, marginRight: 10 }]}
            onPress={() => navigation.navigate('Send')}
          >
            <Text style={{ fontSize: 24, marginBottom: 5 }}>↑</Text>
            <Text style={commonStyles.buttonText}>Send</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[commonStyles.button, { flex: 1, marginLeft: 10 }]}
            onPress={() => navigation.navigate('Receive')}
          >
            <Text style={{ fontSize: 24, marginBottom: 5 }}>↓</Text>
            <Text style={commonStyles.buttonText}>Receive</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[commonStyles.row, { paddingHorizontal: 20, marginBottom: 20 }]}>
          <TouchableOpacity
            style={[
              commonStyles.button,
              commonStyles.buttonSecondary,
              { flex: 1, marginRight: 5 },
              activeTab === 'transactions' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setActiveTab('transactions')}
          >
            <Text style={commonStyles.buttonText}>Transactions</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              commonStyles.button,
              commonStyles.buttonSecondary,
              { flex: 1, marginLeft: 5 },
              activeTab === 'tokens' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setActiveTab('tokens')}
          >
            <Text style={commonStyles.buttonText}>Tokens</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.accent} />
          ) : activeTab === 'transactions' ? (
            transactions.length > 0 ? (
              transactions.map(renderTransaction)
            ) : (
              <View style={commonStyles.emptyState}>
                <Text style={commonStyles.emptyStateText}>No transactions yet</Text>
              </View>
            )
          ) : (
            <View style={commonStyles.emptyState}>
              <Text style={commonStyles.emptyStateText}>No tokens yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
