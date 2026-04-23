import * as Location from "expo-location";

export async function getUserLocation() {
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    return null;
  }

  let location = await Location.getCurrentPositionAsync({
    mayShowUserSettingsDialog: false,
  });
  return location;
}
