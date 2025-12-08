// Receive Screen - Display address and QR code

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { commonStyles, colors } from '../styles/common';
import WalletService from '../services/wallet';

export default function ReceiveScreen({ navigation }) {
  const [wallet] = useState(new WalletService());
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('default');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadAccountAddress();
    }
  }, [selectedAccount]);

  const loadAccounts = async () => {
    try {
      await wallet.initialize();
      const accountsList = await wallet.listAccounts();
      setAccounts(Array.isArray(accountsList) ? accountsList : []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setLoading(false);
    }
  };

  const loadAccountAddress = async () => {
    try {
      const account = await wallet.getAccount(selectedAccount);
      setAddress(account.address);
    } catch (error) {
      console.error('Error loading address:', error);
      Alert.alert('Error', 'Failed to load address');
    }
  };

  const copyAddress = async () => {
    await Clipboard.setStringAsync(address);
    Alert.alert('Success', 'Address copied to clipboard');
  };

  const handleAccountChange = (accountName) => {
    setSelectedAccount(accountName);
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={commonStyles.header}>
        <View style={commonStyles.row}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
          </TouchableOpacity>
          <Text style={commonStyles.headerTitle}>Receive NXS</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <ScrollView style={commonStyles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : (
          <>
            <View style={commonStyles.card}>
              <Text style={commonStyles.label}>Select Account</Text>
              <TouchableOpacity
                style={commonStyles.input}
                onPress={() => {
                  if (accounts.length > 1) {
                    Alert.alert(
                      'Select Account',
                      '',
                      accounts.map(acc => ({
                        text: acc.name || acc.address,
                        onPress: () => handleAccountChange(acc.name || 'default')
                      })).concat([{ text: 'Cancel', style: 'cancel' }])
                    );
                  }
                }}
              >
                <Text style={commonStyles.text}>{selectedAccount}</Text>
              </TouchableOpacity>
            </View>

            <View style={[commonStyles.card, { alignItems: 'center' }]}>
              <Text style={[commonStyles.text, { marginBottom: 20 }]}>
                Scan QR Code or Share Address
              </Text>

              {address && (
                <View style={{ padding: 20, backgroundColor: colors.text, borderRadius: 12 }}>
                  <QRCode value={address} size={200} />
                </View>
              )}

              <View style={commonStyles.divider} />

              <Text style={commonStyles.label}>Your Address</Text>
              <View style={[commonStyles.input, { width: '100%' }]}>
                <Text style={[commonStyles.textSmall, { textAlign: 'center' }]}>
                  {address}
                </Text>
              </View>

              <TouchableOpacity
                style={[commonStyles.button, { width: '100%' }]}
                onPress={copyAddress}
              >
                <Text style={commonStyles.buttonText}>📋 Copy Address</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[commonStyles.button, commonStyles.buttonSecondary]}
              onPress={() => navigation.navigate('CreateAccount')}
            >
              <Text style={commonStyles.buttonText}>+ Create New Account</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
