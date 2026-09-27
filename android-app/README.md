# CineForge Receitas - Aplicativo Android Nativo (Kotlin & Jetpack Compose)

Este diretório contém o projeto completo do aplicativo Android pronto para abrir no **Android Studio**.

## 📱 Tecnologias Utilizadas no App Android:
- **Linguagem**: Kotlin 2.x
- **UI Toolkit**: Jetpack Compose com Material Design 3
- **Arquitetura**: MVVM com `StateFlow` e `Coroutines`
- **Comunicação de Rede**: Retrofit 2 + Gson Converter + OkHttp Logging
- **Player de Vídeo**: AndroidX Media3 / ExoPlayer (Otimizado para vídeos verticais 9:16)
- **Carregamento de Imagens**: Coil Compose

---

## 📂 Estrutura de Arquivos Criada:
```
/android-app/
├── app/
│   ├── build.gradle.kts (Dependências e SDK 35)
│   └── src/main/
│       ├── AndroidManifest.xml (Permissões de INTERNET)
│       └── java/com/cineforge/recipes/
│           ├── MainActivity.kt (Ponto de entrada)
│           ├── data/
│           │   └── Models.kt (Data classes de Request/Response)
│           ├── network/
│           │   └── CineForgeApiService.kt (Interface Retrofit com baseURL)
│           ├── viewmodel/
│           │   └── RecipeViewModel.kt (Orquestração assíncrona e polling de status)
│           └── ui/
│               ├── RecipeHomeScreen.kt (Tela principal com entrada e barra de progresso)
│               └── VideoPlayerScreen.kt (Player ExoPlayer 9:16 nativo em tela cheia)
```

---

## 🚀 Como Executar no Android Studio:
1. Abra o **Android Studio**.
2. Clique em **File > Open** e selecione a pasta `/android-app`.
3. Aguarde o **Gradle Sync** baixar as dependências.
4. (Opcional) Abra o arquivo `CineForgeApiService.kt` e confira a constante `BASE_URL`:
   - Já vem pré-configurada para apontar para o seu backend na nuvem.
5. Conecte um celular Android ou inicie um Emulador e clique em **Run (Shift + F10)**.
