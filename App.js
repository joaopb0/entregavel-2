import { useState, useEffect, useRef } from "react";
import MapView, { UrlTile, Polyline, Marker } from "react-native-maps";
import { StyleSheet, View, Text, Image } from "react-native";
import { Dimensions } from "react-native";
import { watchUserLocation } from "./watchUserLocation";
import { getUserLocation } from "./getUserLocation";
import { fetchAddress } from "./fetchAddress";
import { fetchRoute } from "./fetchRoute";

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.04;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function App() {
  const mapRef = useRef();
  const [hell, setHell] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const userCoords = userLocation?.coords;
  const initialRegion = userCoords && {
    latitude: userCoords.latitude,
    longitude: userCoords.longitude,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
    //longitude:-51.114737739999995,
    //latitude:-29.672220324999998
  };

  const hellDisplayName = hell && (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        margin: 24,
        padding: 8,
        borderRadius: 8,
        opacity: 0.5,
        zIndex: 1,
        backgroundColor: "white",
      }}
    >
      <Text style={{ textAlign: "center" }}>{hell.address.display_name}</Text>
    </View>
  );

  const hellPolyline = hell && <Polyline coordinates={hell.route} />;
  const catMarker = hell?.route.length > 0 && (
    <Marker coordinate={hell.route.at(0)} anchor={{ x: 0.5, y: 0.2 }}>
      <View style={{ width: 53, height: 21 }}>
        <Image
          source={{
            uri: "https://i.pinimg.com/originals/ed/35/f8/ed35f861be81be2548e514085fb19385.gif",
          }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </View>
    </Marker>
  );

  const hellMarker = hell?.route.length > 0 && (
    <Marker
      coordinate={hell.route.at(-1)}
      anchor={{
        x: 0.5,
        y: 0.5,
      }}
    >
      <View style={{ width: 48, height: 48 }}>
        <Image
          source={{
            uri: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExejViOGIweWpyZWhwMzdqYThobzE2b2R3cWkyZjI0ZTNoMW9sOTYyMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/hSdQLB8X5BkTJQ8acV/giphy.gif",
          }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </View>
    </Marker>
  );

  // Faz o mapa focar para mostrar toda a rota
  function overviewHellRoute() {
    if (!hell) return;

    const coordsA = hell.route.at(0);
    const coordsB = hell.route.at(-1);

    const latCenter = (coordsA.latitude + coordsB.latitude) / 2;
    const lngCenter = (coordsA.longitude + coordsB.longitude) / 2;

    const latDelta = Math.abs(coordsA.latitude - coordsB.latitude) * 1.5;
    const longDelta = Math.abs(coordsA.longitude - coordsB.longitude) * 1.5;

    mapRef.current.animateToRegion(
      {
        latitude: latCenter,
        longitude: lngCenter,
        latitudeDelta: latDelta,
        longitudeDelta: longDelta,
      },
      1000,
    );
  }

  // Carrega o caminho e o endereço de onde você está até o Pará Lanches
  async function pathToHell() {
    if (!userLocation?.coords) {
      return;
    }

    const hellCoords = {
      latitude: -23.6046474,
      longitude: -46.5977751,
    };

    const hellAddress = await fetchAddress(hellCoords);
    const hellRoute = await fetchRoute(userCoords, hellCoords);

    console.log("hellAddress", hellAddress);
    setHell({ address: hellAddress, route: hellRoute });
  }

  async function loadUserLocation() {
    const userLocationObj = await getUserLocation();
    console.log("loadUserLocation", userLocationObj);
    setUserLocation(userLocationObj);
  }

  function onUserLocationChange(userLocationObj) {
    console.log("location change", userLocationObj);
    setUserLocation(userLocationObj);
  }

  useEffect(() => {
    // Para pegar a localização uma vez só
    loadUserLocation();

    // Para "ouvir" a localização e atualizar sempre que alterar
    /*
    let locationSubscription;
    watchUserLocation(onUserLocationChange).then((sub) => {
      locationSubscription = sub;
    });
    return () => {
      locationSubscription && locationSubscription.remove();
    };
    */
  }, []);

  // Toda vez que a localização do usuário mudar, recalcula o caminho pro inferno
  useEffect(() => {
    pathToHell();
  }, [userLocation]);

  useEffect(() => {
    overviewHellRoute();
  }, [hell]);

  return (
    <View style={styles.container}>
      {hellDisplayName}
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="none"
        initialRegion={initialRegion}
        //showsCompass
        //showsUserLocation
      >
        {/* Se por qualquer motivo o mapa não carregar no teu celular, esse aqui será utilizado */}
        <UrlTile
          urlTemplate="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          maximumZ={19}
          flipY={false}
        />
        {hellPolyline}
        {catMarker}
        {hellMarker}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
});
