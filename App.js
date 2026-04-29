import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  SafeAreaView
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getUserLocation } from './getUserLocation';
import { watchUserLocation } from './watchUserLocation';
import { fetchAddress } from './fetchAddress';
import { fetchRoute } from './fetchRoute';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.04;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const STORAGE_KEY = '@park_history_v1';

export default function App() {
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [mapType, setMapType] = useState('standard');
  const [savedLocations, setSavedLocations] = useState([]);
  const [currentRoute, setCurrentRoute] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [locationNameInput, setLocationNameInput] = useState('');
  const [tempAddressInfo, setTempAddressInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        setIsLoading(true);
        setLoadingMessage('Iniciando aplicativo...');
        
        await loadHistoryFromStorage();

        const initialLoc = await getUserLocation();
        if (isMounted && initialLoc && initialLoc.coords) {
          setUserLocation(initialLoc.coords);
          centerMapOnUser(initialLoc.coords);
        }

        const sub = await watchUserLocation((loc) => {
          if (isMounted && loc && loc.coords) {
            setUserLocation(loc.coords);
          }
        });
        
        if (sub) {
          locationSubscription.current = sub;
        }

      } catch (error) {
        console.error("Erro na inicialização:", error);
        Alert.alert("Erro", "Não foi possível iniciar os serviços de localização.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeApp();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const loadHistoryFromStorage = async () => {
    try {
      const storedData = await AsyncStorage.getItem(STORAGE_KEY);
      let history = [];

      if (storedData !== null) {
        history = JSON.parse(storedData);
      }

      const defaultLocation = {
        id: 'default-sl-001',
        title: 'Teste - Centro, São Leopoldo',
        address: 'R. Independência, 100 - Centro, São Leopoldo - RS, 93010-000',
        coordinate: { latitude: -29.7613, longitude: -51.1517 },
        timestamp: new Date().toISOString(),
      };

      const hasDefault = history.some((h) => h.id === defaultLocation.id);
      if (!hasDefault) {
        history = [defaultLocation, ...history];
        // Atualiza o armazenamento com o default incluído
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      }

      setSavedLocations(history);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      Alert.alert("Erro", "Falha ao ler os dados salvos no dispositivo.");
    }
  };

  const saveHistoryToStorage = async (newHistory) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      setSavedLocations(newHistory);
    } catch (error) {
      console.error("Erro ao salvar histórico:", error);
      Alert.alert("Erro", "Falha ao gravar os dados no dispositivo.");
    }
  };

  const handleInitiateSaveLocation = async () => {
    if (!userLocation) {
      Alert.alert("Atenção", "Localização do GPS ainda não disponível. Aguarde um momento.");
      return;
    }

    try {
      setIsLoading(true);
      setLoadingMessage('Buscando endereço...');
      
      const addressData = await fetchAddress({ 
        latitude: userLocation.latitude, 
        longitude: userLocation.longitude 
      });

      let displayAddress = "Endereço desconhecido";
      if (addressData && addressData.display_name) {
        displayAddress = addressData.display_name;
      }

      setTempAddressInfo({
        address: displayAddress,
        coordinate: { ...userLocation },
      });
      
      const hour = new Date().getHours();
      let greeting = 'Local salvo de ';
      if (hour < 12) greeting += 'Manhã';
      else if (hour < 18) greeting += 'Tarde';
      else greeting += 'Noite';
      
      setLocationNameInput(greeting);
      setIsSaveModalVisible(true);

    } catch (error) {
      console.error("Erro no fluxo de salvar:", error);
      Alert.alert("Erro", "Falha ao obter o endereço. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSaveLocation = async () => {
    if (!locationNameInput.trim()) {
      Alert.alert("Aviso", "Por favor, insira um nome para o local.");
      return;
    }

    const newLocation = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      title: locationNameInput.trim(),
      address: tempAddressInfo.address,
      coordinate: tempAddressInfo.coordinate,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [newLocation, ...savedLocations];
    await saveHistoryToStorage(updatedHistory);
    
    setIsSaveModalVisible(false);
    setTempAddressInfo(null);
    setLocationNameInput('');
    Alert.alert("Sucesso!", "Local salvo com sucesso no seu diário.");
  };

  const handleDeleteLocation = (id) => {
    Alert.alert(
      "Confirmar exclusão",
      "Tem certeza que deseja apagar este local do seu histórico?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Apagar", 
          style: "destructive",
          onPress: async () => {
            const updatedHistory = savedLocations.filter(loc => loc.id !== id);
            await saveHistoryToStorage(updatedHistory);
            
            if (selectedDestination && selectedDestination.id === id) {
              clearCurrentRoute();
            }
          }
        }
      ]
    );
  };

  const handleClearAllHistory = () => {
    Alert.alert(
      "Atenção - Danger Zone",
      "Isso apagará TODO o seu histórico permanentemente. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sim, Apagar Tudo", 
          style: "destructive",
          onPress: async () => {
            await saveHistoryToStorage([]);
            clearCurrentRoute();
            Alert.alert("Limpo", "Seu histórico foi completamente apagado.");
            setIsSettingsModalVisible(false);
          }
        }
      ]
    );
  };

  const handleHistoryItemPress = async (item) => {
    setIsHistoryModalVisible(false);
    
    if (!userLocation) {
      Alert.alert("Aviso", "Aguardando sinal de GPS para traçar a rota.");
      return;
    }

    try {
      setIsLoading(true);
      setLoadingMessage(`Traçando rota para ${item.title}...`);
      
      const routePoints = await fetchRoute(userLocation, item.coordinate);
      
      if (routePoints && routePoints.length > 0) {
        setCurrentRoute(routePoints);
        setSelectedDestination(item);
        
        if (mapRef.current) {
          const coordinatesForFit = routePoints.map(p => ({
            latitude: p.latitude,
            longitude: p.longitude
          }));
          
          coordinatesForFit.push(userLocation);
          coordinatesForFit.push(item.coordinate);

          mapRef.current.fitToCoordinates(coordinatesForFit, {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          });
        }
      } else {
        Alert.alert("Aviso", "Não foi possível traçar uma rota de carro para este local.");
      }
    } catch (error) {
      console.error("Erro ao buscar rota:", error);
      Alert.alert("Erro", "Ocorreu uma falha ao comunicar com o serviço de rotas.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearCurrentRoute = () => {
    setCurrentRoute([]);
    setSelectedDestination(null);
    if (userLocation) {
      centerMapOnUser(userLocation);
    }
  };

  const centerMapOnUser = (coords) => {
    if (mapRef.current && coords) {
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }, 1000);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const LoadingOverlay = () => {
    if (!isLoading) return null;
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  };

  const FloatingHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>🚙 Onde Parei?</Text>
      <Text style={styles.headerSubtitle}>Seu diário de bordo e estacionamento</Text>
    </View>
  );

  const FloatingActions = () => (
    <View style={styles.actionsContainer}>
      <TouchableOpacity 
        style={[styles.actionButton, styles.secondaryButton]} 
        onPress={() => setIsHistoryModalVisible(true)}
      >
        <Text style={styles.actionIcon}>📜</Text>
        <Text style={styles.actionButtonText}>Histórico</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, styles.primaryButton]} 
        onPress={handleInitiateSaveLocation}
      >
        <Text style={styles.actionIcon}>📍</Text>
        <Text style={styles.actionButtonText}>Salvar Local</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, styles.secondaryButton]} 
        onPress={() => setIsSettingsModalVisible(true)}
      >
        <Text style={styles.actionIcon}>⚙️</Text>
        <Text style={styles.actionButtonText}>Ajustes</Text>
      </TouchableOpacity>
    </View>
  );

  const ClearRouteButton = () => {
    if (currentRoute.length === 0) return null;
    return (
      <TouchableOpacity 
        style={styles.clearRouteButton} 
        onPress={clearCurrentRoute}
      >
        <Text style={styles.clearRouteIcon}>❌</Text>
        <Text style={styles.clearRouteText}>Limpar Rota</Text>
      </TouchableOpacity>
    );
  };

  const renderSaveModal = () => (
    <Modal
      visible={isSaveModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setIsSaveModalVisible(false)}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Salvar Localização</Text>
          
          <Text style={styles.inputLabel}>Endereço Detectado:</Text>
          <Text style={styles.addressText} numberOfLines={3}>
            {tempAddressInfo?.address || 'Buscando...'}
          </Text>

          <Text style={styles.inputLabel}>Como deseja chamar este local?</Text>
          <TextInput
            style={styles.textInput}
            value={locationNameInput}
            onChangeText={setLocationNameInput}
            placeholder="Ex: Trabalho, Estacionamento Shopping..."
            placeholderTextColor="#888"
            maxLength={40}
          />

          <View style={styles.modalButtonRow}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]} 
              onPress={() => setIsSaveModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]} 
              onPress={confirmSaveLocation}
            >
              <Text style={styles.confirmButtonText}>Salvar 💾</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderHistoryModal = () => {
    const renderItem = ({ item }) => (
      <TouchableOpacity 
        style={styles.historyCard}
        onPress={() => handleHistoryItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.historyCardContent}>
          <Text style={styles.historyCardTitle}>{item.title}</Text>
          <Text style={styles.historyCardDate}>{formatDate(item.timestamp)}</Text>
          <Text style={styles.historyCardAddress} numberOfLines={2}>
            {item.address}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => handleDeleteLocation(item.id)}
        >
          <Text style={styles.deleteButtonIcon}>🗑️</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );

    return (
      <Modal
        visible={isHistoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsHistoryModalVisible(false)}
      >
        <View style={[styles.modalBackground, styles.fullScreenModalBg]}>
          <SafeAreaView style={styles.fullScreenModalContainer}>
            
            <View style={styles.fullScreenModalHeader}>
              <Text style={styles.fullScreenModalTitle}>Meus Locais Salvos</Text>
              <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
                <Text style={styles.closeIcon}>✖️</Text>
              </TouchableOpacity>
            </View>

            {savedLocations.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateIcon}>🏜️</Text>
                <Text style={styles.emptyStateText}>Nenhum local salvo ainda.</Text>
                <Text style={styles.emptyStateSubtext}>
                  Volte ao mapa e clique em "Salvar Local" para começar seu diário.
                </Text>
              </View>
            ) : (
              <FlatList
                data={savedLocations}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.flatListContent}
                showsVerticalScrollIndicator={false}
              />
            )}
            
          </SafeAreaView>
        </View>
      </Modal>
    );
  };

  const renderSettingsModal = () => (
    <Modal
      visible={isSettingsModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setIsSettingsModalVisible(false)}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <View style={styles.settingsHeaderRow}>
            <Text style={styles.modalTitle}>Configurações</Text>
            <TouchableOpacity onPress={() => setIsSettingsModalVisible(false)}>
              <Text style={styles.closeIconSmall}>✖️</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsContainer}>
            <Text style={styles.statsLabel}>Total de Locais Salvos:</Text>
            <Text style={styles.statsValue}>{savedLocations.length}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Estilo do Mapa</Text>
          <View style={styles.mapTypeContainer}>
            {['standard', 'satellite', 'terrain'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.mapTypeButton,
                  mapType === type && styles.mapTypeButtonActive
                ]}
                onPress={() => setMapType(type)}
              >
                <Text style={[
                  styles.mapTypeText,
                  mapType === type && styles.mapTypeTextActive
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Zona de Perigo</Text>
          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={handleClearAllHistory}
          >
            <Text style={styles.dangerButtonText}>⚠️ Apagar Todo o Histórico</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {userLocation ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          mapType={mapType}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          loadingEnabled={true}
        >
          {selectedDestination && (
            <Marker
              coordinate={selectedDestination.coordinate}
              title={selectedDestination.title}
              description={selectedDestination.address}
              pinColor="#e74c3c"
            />
          )}

          {currentRoute.length > 0 && (
            <Polyline 
              coordinates={currentRoute}
              strokeColor="#3498db"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>
      ) : (
        <View style={styles.initialLoadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.initialLoadingText}>Localizando satélites GPS...</Text>
        </View>
      )}

      <FloatingHeader />
      
      <ClearRouteButton />

      <FloatingActions />
      
      {renderSaveModal()}
      {renderHistoryModal()}
      {renderSettingsModal()}

      <LoadingOverlay />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  map: {
    width: width,
    height: height,
    ...StyleSheet.absoluteFillObject,
  },
  initialLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
  },
  initialLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 10,
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2c3e50',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
    fontWeight: '500',
  },
  clearRouteButton: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  clearRouteIcon: {
    marginRight: 6,
    fontSize: 12,
  },
  clearRouteText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
  },
  actionButton: {
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  primaryButton: {
    backgroundColor: '#2ecc71',
    width: 140,
    height: 70,
    paddingVertical: 12,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    width: 80,
    height: 60,
    paddingVertical: 8,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#34495e',
    textAlign: 'center',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 10,
    marginBottom: 4,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 14,
    color: '#34495e',
    backgroundColor: '#f1f2f6',
    padding: 10,
    borderRadius: 8,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dcdde1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 24,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f2f6',
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#3498db',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#7f8c8d',
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fullScreenModalBg: {
    justifyContent: 'flex-end',
  },
  fullScreenModalContainer: {
    width: '100%',
    height: '90%',
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    elevation: 24,
  },
  fullScreenModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fullScreenModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  closeIcon: {
    fontSize: 20,
    color: '#7f8c8d',
    padding: 5,
  },
  flatListContent: {
    padding: 16,
    paddingBottom: 40,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f2f6',
  },
  historyCardContent: {
    flex: 1,
  },
  historyCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  historyCardDate: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 6,
    fontWeight: '600',
  },
  historyCardAddress: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  deleteButton: {
    padding: 12,
    backgroundColor: '#ffeaa7',
    borderRadius: 50,
    marginLeft: 12,
  },
  deleteButtonIcon: {
    fontSize: 18,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495e',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
  settingsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  closeIconSmall: {
    fontSize: 18,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  statsContainer: {
    backgroundColor: '#f1f2f6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  statsLabel: {
    fontSize: 16,
    color: '#34495e',
    fontWeight: '600',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2ecc71',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    width: '100%',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7f8c8d',
    alignSelf: 'flex-start',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  mapTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  mapTypeButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dcdde1',
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  mapTypeButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#2980b9',
  },
  mapTypeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  mapTypeTextActive: {
    color: '#ffffff',
  },
  dangerButton: {
    backgroundColor: '#ff7675',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d63031',
  },
  dangerButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
