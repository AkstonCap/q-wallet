// Transaction Approval Screen - Modal for PIN confirmation

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { commonStyles, colors } from '../styles/common';

export default function TransactionApprovalScreen({ route, navigation }) {
  const { transactionData, onApprove } = route.params;
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!pin) {
      Alert.alert('Error', 'Please enter your PIN');
      return;
    }

    setLoading(true);
    try {
      if (onApprove) {
        await onApprove(pin);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[commonStyles.container, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
      <KeyboardAvoidingView 
        style={commonStyles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <View style={[commonStyles.card, { padding: 30 }]}>
            <Text style={[commonStyles.headerTitle, { fontSize: 20, marginBottom: 20 }]}>
              Confirm Transaction
            </Text>

            <View style={[commonStyles.card, { backgroundColor: colors.inputBg }]}>
              <View style={[commonStyles.row, { marginBottom: 10 }]}>
                <Text style={commonStyles.textSecondary}>From:</Text>
                <Text style={commonStyles.text}>{transactionData.from}</Text>
              </View>

              <View style={[commonStyles.row, { marginBottom: 10 }]}>
                <Text style={commonStyles.textSecondary}>To:</Text>
                <Text style={[commonStyles.textSmall, { flex: 1, textAlign: 'right' }]}>
                  {transactionData.to.substring(0, 12)}...{transactionData.to.substring(transactionData.to.length - 8)}
                </Text>
              </View>

              <View style={[commonStyles.row, { marginBottom: 10 }]}>
                <Text style={commonStyles.textSecondary}>Amount:</Text>
                <Text style={[commonStyles.text, { fontWeight: 'bold', color: colors.accent }]}>
                  {transactionData.amount} NXS
                </Text>
              </View>

              {transactionData.reference && (
                <View style={{ marginTop: 10 }}>
                  <Text style={commonStyles.textSecondary}>Reference:</Text>
                  <Text style={commonStyles.textSmall}>{transactionData.reference}</Text>
                </View>
              )}
            </View>

            <Text style={[commonStyles.label, { marginTop: 20 }]}>Enter PIN to Confirm</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="Enter your PIN"
              placeholderTextColor={colors.textSecondary}
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.buttonSecondary, { flex: 1, marginRight: 10 }]}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={commonStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[commonStyles.button, { flex: 1, marginLeft: 10 }, loading && commonStyles.buttonDisabled]}
                onPress={handleConfirm}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={commonStyles.buttonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
