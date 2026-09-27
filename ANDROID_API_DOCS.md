# Arquitetura de Integração Android Kotlin com Agnes CineForge Backend

Este backend Express/Node.js foi preparado para suportar nativamente chamadas de aplicativos móveis **Android (Kotlin)** e do **Frontend Web**.

---

## 📡 Endpoints REST Prontos para Android Retrofit / Ktor

### 1. Iniciar Geração de Vídeo de Receita
- **Método**: `POST`
- **URL**: `https://<SEU_BACKEND_URL>/api/recipes/pipeline/start`
- **Headers**:
  - `Content-Type: application/json`
  - `x-agnes-key: <OPCIONAL_CHAVE_AGNES>` (ou configurada no servidor)
- **Body JSON**:
```json
{
  "dishName": "Macarrão com Camarão e Alho",
  "category": "Massa Italiana",
  "aspectRatio": "9:16",
  "fixedAnchors": {
    "hands": "Mãos femininas cuidadas, unhas vermelhas e anel discreto",
    "countertop": "Bancada rústica de carvalho escuro",
    "lighting": "Luz difusa de janela matinal 5600K suave"
  }
}
```
- **Resposta (HTTP 202 Accepted)**:
```json
{
  "ok": true,
  "jobId": "rec_1790400000000_a8bc9",
  "status": "queued",
  "message": "Tarefa de geração iniciada em segundo plano.",
  "statusEndpoint": "/api/recipes/pipeline/status/rec_1790400000000_a8bc9"
}
```

---

### 2. Consultar Progresso do Vídeo (Polling)
- **Método**: `GET`
- **URL**: `https://<SEU_BACKEND_URL>/api/recipes/pipeline/status/{jobId}`
- **Resposta em Andamento**:
```json
{
  "jobId": "rec_1790400000000_a8bc9",
  "status": "processing",
  "progress": 45,
  "message": "Animando tomada 2/5 em vídeo 9:16...",
  "dishName": "Macarrão com Camarão e Alho",
  "currentStepIndex": 1,
  "totalSteps": 5,
  "steps": [
    {
      "stepNumber": 1,
      "actionTitle": "Corte e Mise en Place",
      "station": "cutting_board",
      "imageUrl": "https://...",
      "videoUrl": "https://...",
      "status": "completed"
    }
  ]
}
```
- **Resposta Concluída**:
```json
{
  "jobId": "rec_1790400000000_a8bc9",
  "status": "completed",
  "progress": 100,
  "message": "Vídeo de receita gerado com sucesso!",
  "stitchedVideoUrl": "https://...",
  "steps": [...]
}
```
