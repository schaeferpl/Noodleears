import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator,
  SafeAreaView, Platform, Alert, TextInput
} from 'react-native';
import { initContext } from 'whisper.rn';
import { pick, types } from '@react-native-documents/picker';
import Clipboard from '@react-native-clipboard/clipboard';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Upload, Copy, Share2, Check, Save, Search, X, History, FileText, Mic } from 'lucide-react-native';

const COLORS = {
  purpleDark: '#3B0764',
  purpleMain: '#6B21A8',
  purpleLight: '#F3E8FF',
  goldMain: '#D4AF37',
  goldLight: '#FEF08A',
  textDark: '#1F2937',
  white: '#FFFFFF',
};

export default function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState([]);
  const [copied, setCopied] = useState(false);
  const [whisperContext, setWhisperContext] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [currentTab, setCurrentTab] = useState('NEW');

  useEffect(() => {
    const initWhisper = async () => {
      try {
        const ctx = await initContext({ filePath: 'ggml-base.bin', isModelInAssets: true });
        setWhisperContext(ctx);
      } catch (error) {
        Alert.alert("Błąd", "Nie udało się załadować modelu ggml-base.bin");
      }
    };
    initWhisper();
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('@noodleEars_history');
      if (saved !== null) setHistory(JSON.parse(saved));
    } catch (e) {}
  };

  const saveToHistory = async (newTranscription, fileName) => {
    try {
      const newItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        name: fileName,
        data: newTranscription
      };
      const updatedHistory = [newItem, ...history];
      setHistory(updatedHistory);
      await AsyncStorage.setItem('@noodleEars_history', JSON.stringify(updatedHistory));
    } catch (e) {}
  };

  const loadFromHistory = (item) => {
    setTranscription(item.data);
    setAudioFile({ name: item.name, uri: null });
    setCurrentTab('NEW');
  };

  const clearHistory = async () => {
    Alert.alert("Uwaga", "Czy na pewno chcesz usunąć całą historię?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Usuń", style: "destructive", onPress: async () => {
          await AsyncStorage.removeItem('@noodleEars_history');
          setHistory([]);
      }}
    ]);
  };

  const handleFileSelect = async () => {
    try {
      const [res] = await pick({ type: [types.audio] });
      setAudioFile({ uri: res.uri, name: res.name }); 
      setTranscription([]);
    } catch (err) {}
  };

  const startTranscription = async () => {
    if (!audioFile || !audioFile.uri || !whisperContext) return;
    setIsTranscribing(true); setTranscription([]);
    try {
      const fileUri = Platform.OS === 'android' ? audioFile.uri : audioFile.uri.replace('file://', '');
      const { promise } = whisperContext.transcribe(fileUri, { language: 'pl', maxLen: 1 });
      const result = await promise;
      if (result && result.segments) {
        setTranscription(result.segments);
        saveToHistory(result.segments, audioFile.name);
      }
    } catch (error) { Alert.alert("Błąd", "Wystąpił problem podczas transkrypcji."); } 
    finally { setIsTranscribing(false); }
  };

  const handleCopyText = () => {
    if (transcription.length === 0) return;
    Clipboard.setString(transcription.map(s => s.text.trim()).join('\n'));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (transcription.length === 0) return;
    try { await Share.open({ message: transcription.map(s => s.text.trim()).join('\n') }); } catch (error) {}
  };

  const handleSaveToFile = async () => {
    if (transcription.length === 0) return;
    const textToSave = transcription.map(s => `[${formatTime(s.start/1000)}] ${s.text.trim()}`).join('\n');
    try {
      const fileName = `noodleEars_${new Date().getTime()}.txt`;
      const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      await RNFS.writeFile(path, textToSave, 'utf8');
      Alert.alert("Sukces", `Zapisano w folderze Pobrane:\n${fileName}`);
    } catch (error) { Alert.alert("Błąd", "Nie udało się zapisać pliku."); }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderHighlightedText = (text, query) => {
    if (!query.trim()) return <Text style={styles.segmentText}>{text}</Text>;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return (
      <Text style={styles.segmentText}>
        {parts.map((part, index) => 
          regex.test(part) ? <Text key={index} style={styles.highlightedWord}>{part}</Text> : <Text key={index}>{part}</Text>
        )}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>noodleEars</Text>
          <Text style={styles.headerDot}>.</Text>
        </View>
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tab, currentTab === 'NEW' && styles.activeTab]} onPress={() => setCurrentTab('NEW')}>
            <Mic size={16} color={currentTab === 'NEW' ? COLORS.goldMain : COLORS.purpleLight} />
            <Text style={[styles.tabText, currentTab === 'NEW' && styles.activeTabText]}>Studio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, currentTab === 'HISTORY' && styles.activeTab]} onPress={() => setCurrentTab('HISTORY')}>
            <History size={16} color={currentTab === 'HISTORY' ? COLORS.goldMain : COLORS.purpleLight} />
            <Text style={[styles.tabText, currentTab === 'HISTORY' && styles.activeTabText]}>Archiwum</Text>
          </TouchableOpacity>
        </View>
      </View>

      {currentTab === 'NEW' ? (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          
          <TouchableOpacity style={styles.mainUploadBox} onPress={handleFileSelect}>
            <Upload size={36} color={COLORS.purpleMain} />
            <Text style={styles.inputText}>Wgraj plik audio do transkrypcji</Text>
          </TouchableOpacity>

          {audioFile && (
            <View style={styles.optionsCard}>
              <Text style={styles.fileNameText}>{audioFile.name}</Text>
              
              {!transcription.length > 0 && (
                <TouchableOpacity style={styles.primaryButton} onPress={startTranscription} disabled={isTranscribing}>
                  {isTranscribing ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color={COLORS.white} style={{marginRight: 10}} />
                      <Text style={styles.buttonText}>AI nasłuchuje...</Text>
                    </View>
                  ) : <Text style={styles.buttonText}>Rozpocznij Transkrypcję</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}

          {transcription.length > 0 && (
            <View style={styles.resultsCard}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Twój tekst</Text>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButton} onPress={handleSaveToFile}><Save size={20} color={COLORS.purpleDark} /></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={handleCopyText}>
                    {copied ? <Check size={20} color="#10b981" /> : <Copy size={20} color={COLORS.purpleDark} />}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.shareBtn]} onPress={handleShare}>
                    <Share2 size={20} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.searchContainer}>
                <Search size={20} color={COLORS.purpleMain} style={styles.searchIcon}/>
                <TextInput 
                  style={styles.searchInput}
                  placeholder="Znajdź cytat..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery !== '' && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={{padding: 4}}><X size={16} color="#9CA3AF" /></TouchableOpacity>
                )}
              </View>

              <View style={styles.transcriptionContainer}>
                {transcription.map((segment, index) => (
                  <View key={index} style={styles.segmentRow}>
                    <Text style={styles.timestampText}>{formatTime(segment.start / 1000)}</Text>
                    {renderHighlightedText(segment.text.trim(), searchQuery)}
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Zapisane Wywiady</Text>
            {history.length > 0 && (
              <TouchableOpacity onPress={clearHistory}><Text style={styles.clearHistoryText}>Wyczyść</Text></TouchableOpacity>
            )}
          </View>
          {history.length === 0 ? (
            <Text style={styles.emptyHistory}>Twoje archiwum jest puste.</Text>
          ) : (
            history.map((item) => (
              <TouchableOpacity key={item.id} style={styles.historyItem} onPress={() => loadFromHistory(item)}>
                <FileText size={24} color={COLORS.goldMain} />
                <View style={styles.historyItemTexts}>
                  <Text style={styles.historyItemName}>{item.name}</Text>
                  <Text style={styles.historyItemDate}>{item.date}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { backgroundColor: COLORS.purpleDark, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 10, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 },
  headerTitle: { color: COLORS.white, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  headerDot: { color: COLORS.goldMain, fontSize: 34, fontWeight: '900', lineHeight: 30 },
  tabsContainer: { flexDirection: 'row', gap: 20 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 6, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: COLORS.goldMain },
  tabText: { color: COLORS.purpleLight, fontSize: 15, fontWeight: '600' },
  activeTabText: { color: COLORS.goldMain },
  scrollContainer: { padding: 20, gap: 16 },
  
  mainUploadBox: { backgroundColor: COLORS.purpleLight, borderWidth: 2, borderStyle: 'dashed', borderColor: '#D8B4FE', borderRadius: 16, padding: 30, alignItems: 'center', justifyContent: 'center' },
  inputText: { fontSize: 16, fontWeight: '700', color: COLORS.purpleDark, marginTop: 12 },
  
  optionsCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  fileNameText: { fontSize: 14, color: '#6B7280', marginBottom: 16, textAlign: 'center', fontWeight: '500' },
  primaryButton: { backgroundColor: COLORS.goldMain, borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: COLORS.goldMain, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  buttonText: { color: COLORS.purpleDark, fontSize: 16, fontWeight: '800' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center' },
  
  resultsCard: { backgroundColor: COLORS.white, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginBottom: 40 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FAFAFA', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  resultsTitle: { fontSize: 16, fontWeight: '800', color: COLORS.purpleDark },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionButton: { backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8 },
  shareBtn: { backgroundColor: COLORS.purpleMain },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', margin: 16, borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.textDark },
  transcriptionContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  segmentRow: { flexDirection: 'row', marginBottom: 12, padding: 8, borderRadius: 8, gap: 10 },
  timestampText: { fontSize: 12, color: COLORS.purpleMain, backgroundColor: '#E9D5FF', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', fontWeight: '700' },
  segmentText: { flex: 1, fontSize: 15, color: COLORS.textDark, lineHeight: 24 },
  highlightedWord: { backgroundColor: COLORS.goldLight, fontWeight: 'bold' },
  
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 },
  historyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.purpleDark },
  clearHistoryText: { color: COLORS.red, fontWeight: '600' },
  emptyHistory: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontStyle: 'italic' },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  historyItemTexts: { marginLeft: 16, flex: 1 },
  historyItemName: { fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 4 },
  historyItemDate: { fontSize: 12, color: '#6B7280' },
});