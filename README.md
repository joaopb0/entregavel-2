# 🚙 Onde Parei?

Uma aplicação móvel desenvolvida em React Native com Expo, criada para ser o seu diário de bordo e estacionamento. O app ajuda a guardar a localização exata de onde você deixou o seu veículo e a traçar facilmente a rota de volta.

## ✨ Funcionalidades

* **Localização em Tempo Real:** Acompanhe sua posição atual no mapa com alta precisão utilizando o GPS do dispositivo.
* **Salvar Locais Personalizados:** Registre o local onde estacionou, atribuindo um nome personalizado (ex: "Trabalho", "Estacionamento do Shopping").
* **Geocodificação Reversa:** O sistema converte automaticamente as coordenadas de GPS em um endereço de rua legível antes de salvar o local.
* **Traçado de Rotas:** Trace uma rota no mapa desde a sua localização atual até o ponto onde o veículo foi salvo.
* **Histórico de Estacionamento:** Acesse a lista completa dos locais salvos anteriormente, com opção de gerenciar ou apagar o histórico.
* **Armazenamento Local:** Os dados do histórico são salvos no próprio dispositivo através do `AsyncStorage`, garantindo privacidade e rapidez.
* **Personalização do Mapa:** Alterne entre os modos de visualização Padrão, Satélite e Terreno.

## 🛠️ Tecnologias Utilizadas

* **[React Native](https://reactnative.dev/)**
* **[Expo](https://expo.dev/)** (SDK ~54.0)
* **[React Native Maps](https://github.com/react-native-maps/react-native-maps)**
* **[Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)**
* **[Async Storage](https://react-native-async-storage.github.io/async-storage/)**

## 📂 Estrutura Principal

* `App.js`: Componente principal que gerencia o estado, renderiza o mapa e os modais.
* `getUserLocation.js`: Obtém a coordenada inicial do usuário.
* `watchUserLocation.js`: Atualiza a localização em tempo real.
* `fetchAddress.js`: Integração com serviço de geocodificação para obter o nome da rua.
* `fetchRoute.js`: Obtém os pontos (polilinhas) da rota até o destino.

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
* Node.js instalado
* App **Expo Go** instalado no seu smartphone (iOS ou Android)

### Instalação

1. Clone este repositório

2. Acesse a pasta do projeto:
cd SEU_REPOSITORIO

3. Instale as dependências:
npm install

4. Inicie o servidor do Expo:
npx expo start

5. Leia o QR Code gerado no terminal utilizando o aplicativo Expo Go no seu dispositivo físico para testar o app com as funcionalidades de GPS ativas.
