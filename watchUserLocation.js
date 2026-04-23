import * as Location from "expo-location";

export async function watchUserLocation(callback) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  return await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 1000,
      distanceInterval: 1,
    },
    callback,
  );
}
