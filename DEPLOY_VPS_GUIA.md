# 🚀 Guia de Deploy na VPS: nossamor.shop/receitasia

Este guia contém o passo a passo exato para subir seu backend Node.js na VPS e configurar o Nginx para servir em **`https://nossamor.shop/receitasia`**, permitindo que o **App Android em Kotlin** e a **Web** funcionem juntos sem erros.

---

## 1. Configuração do Nginx (Reverse Proxy)

No seu servidor VPS (Ubuntu/Debian), abra o arquivo de configuração do seu domínio:
```bash
sudo nano /etc/nginx/sites-available/nossamor.shop
```

Adicione o bloco `location` apontando para a porta do seu servidor Node.js (geralmente `3000`):

```nginx
server {
    server_name nossamor.shop www.nossamor.shop;

    # Demais configurações do seu site principal...

    # ========================================================
    # ROTA DO BACKEND & APP RECEITAS IA
    # ========================================================
    location /receitasia/ {
        # Encaminha as requisições para a porta do seu servidor Node.js
        proxy_pass http://127.0.0.1:3000/;

        # Headers necessários para WebSockets, Streaming e IP real
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Evita timeout durante a geração longa de vídeos com IA
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Limite de upload para payloads de imagem/áudio
        client_max_body_size 50M;
    }
}
```

Teste e recarregue o Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 2. Configuração das Variáveis de Ambiente no Servidor (`.env`)

Na pasta onde você clonar o projeto na VPS:
```bash
nano .env
```

Preencha com suas credenciais:
```ini
PORT=3000
NODE_ENV=production
VITE_BASE_PATH=/receitasia/
APP_URL=https://nossamor.shop/receitasia

# Suas chaves de IA
AGNES_API_KEY=sua_chave_agnes_aqui
GEMINI_API_KEY=sua_chave_gemini_aqui
```

---

## 3. Instalação e Execução Contínua com PM2

No terminal da sua VPS:
```bash
# 1. Instalar dependências
npm install

# 2. Gerar o build de produção do frontend
npm run build

# 3. Instalar o PM2 globalmente (se ainda não tiver)
sudo npm install -g pm2

# 4. Iniciar o servidor Node com PM2
pm2 start "npx tsx server.ts" --name "receitas-ia-backend"

# 5. Salvar para reiniciar automaticamente se a VPS reiniciar
pm2 save
pm2 startup
```

---

## 4. O App Android já está 100% Configurado!

O arquivo `CineForgeApiService.kt` no seu projeto Kotlin já foi atualizado com:
```kotlin
const val BASE_URL = "https://nossamor.shop/receitasia/"
```

Assim que seu Nginx e o PM2 estiverem rodando na VPS, qualquer aparelho com o seu aplicativo Android instalado enviará as receitas diretamente para `https://nossamor.shop/receitasia/api/recipes/pipeline/start` e reproduzirá os vídeos gerados no **ExoPlayer nativo**!
