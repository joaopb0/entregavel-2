export async function fetchAddress({ latitude, longitude }) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          "User-Agent": "MeuAppIncrível/1.0 (contato@meuemail.com)", // OBRIGATÓRIO
        },
      },
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Erro no Reverse Geocoding:", error);
    return null;
  }
}
