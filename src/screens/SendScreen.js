// Send Screen - Send NXS to another address

import React, { useState, useEffect } from 'react';
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

export default function SendScreen({ navigation }) {
  const [wallet] = useState(new WalletService());
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('default');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [availableBalance, setAvailableBalance] = useState('0.00');
  const [loading, setLoading] = useState(false);
  const [validatingRecipient, setValidatingRecipient] = useState(false);
  const [recipientValid, setRecipientValid] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadAccountBalance();
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (recipientAddress) {
      validateRecipient();
    } else {
      setRecipientValid(null);
    }
  }, [recipientAddress]);

  const loadAccounts = async () => {
    try {
      await wallet.initialize();
      const accountsList = await wallet.listAccounts();
      setAccounts(Array.isArray(accountsList) ? accountsList : []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadAccountBalance = async () => {
    try {
      const account = await wallet.getAccount(selectedAccount);
      setAvailableBalance(account.balance.toFixed(2));
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const validateRecipient = async () => {
    setValidatingRecipient(true);
    try {
      const result = await wallet.validateRecipient(recipientAddress);
      setRecipientValid(result !== null);
    } catch (error) {
      setRecipientValid(false);
    } finally {
      setValidatingRecipient(false);
    }
  };

  const handleSend = async () => {
    if (!recipientAddress || !amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (recipientValid === false) {
      Alert.alert('Error', 'Invalid recipient address');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (amountNum > parseFloat(availableBalance)) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    // Show PIN confirmation modal
    navigation.navigate('TransactionApproval', {
      transactionData: {
        from: selectedAccount,
        to: recipientAddress,
        amount: amountNum,
        reference: reference,
      },
      onApprove: async (pin) => {
        setLoading(true);
        try {
          await wallet.sendTransaction(selectedAccount, recipientAddress, amountNum, pin, reference);
          Alert.alert('Success', 'Transaction sent successfully', [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
        } catch (error) {
          Alert.alert('Transaction Failed', error.message);
        } finally {
          setLoading(false);
        }
      }
    });
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
            <Text style={commonStyles.headerTitle}>Send NXS</Text>
            <View style={{ width: 24 }} />
          </View>
        </View>

        <ScrollView style={commonStyles.content}>
          <View style={commonStyles.card}>
            <Text style={commonStyles.label}>From Account</Text>
            <TouchableOpacity
              style={commonStyles.input}
              onPress={() => {
                if (accounts.length > 1) {
                  Alert.alert(
                    'Select Account',
                    '',
                    accounts.map(acc => ({
                      text: acc.name || acc.address,
                      onPress: () => setSelectedAccount(acc.name || 'default')
                    }))
                  );
                }
              }}
            >
              <Text style={commonStyles.text}>{selectedAccount}</Text>
            </TouchableOpacity>

            <View style={commonStyles.row}>
              <Text style={commonStyles.textSecondary}>Available Balance:</Text>
              <Text style={commonStyles.text}>{availableBalance} NXS</Text>
            </View>

            <View style={commonStyles.divider} />

            <Text style={commonStyles.label}>Recipient Address</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="Enter recipient address or name"
              placeholderTextColor={colors.textSecondary}
              value={recipientAddress}
              onChangeText={setRecipientAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {validatingRecipient && (
              <ActivityIndicator size="small" color={colors.accent} style={{ alignSelf: 'flex-start' }} />
            )}
            {recipientValid === true && (
              <Text style={commonStyles.successText}>✓ Valid recipient</Text>
            )}
            {recipientValid === false && (
              <Text style={commonStyles.errorText}>✗ Invalid recipient</Text>
            )}

            <Text style={commonStyles.label}>Amount (NXS)</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <Text style={commonStyles.label}>Reference (Optional)</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="Add a note"
              placeholderTextColor={colors.textSecondary}
              value={reference}
              onChangeText={setReference}
              multiline
              numberOfLines={2}
            />

            <View style={commonStyles.divider} />

            <View style={commonStyles.row}>
              <Text style={commonStyles.text}>Transaction Fee:</Text>
              <Text style={commonStyles.text}>0.01 NXS</Text>
            </View>
            <View style={[commonStyles.row, { marginTop: 10 }]}>
              <Text style={[commonStyles.text, { fontWeight: 'bold' }]}>Total:</Text>
              <Text style={[commonStyles.text, { fontWeight: 'bold' }]}>
                {(parseFloat(amount || 0) + 0.01).toFixed(2)} NXS
              </Text>
            </View>

            <TouchableOpacity
              style={[
                commonStyles.button,
                (loading || !recipientValid || !amount) && commonStyles.buttonDisabled
              ]}
              onPress={handleSend}
              disabled={loading || !recipientValid || !amount}
            >
              {loading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={commonStyles.buttonText}>Send Transaction</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
