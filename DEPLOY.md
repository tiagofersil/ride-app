# 🚀 Ride App - Guia de Deploy

## ⚡ Deploy Rápido (Recomendado)

### 1. **GitHub Actions (Automático)**
```bash
# Fazer push para GitHub
git add .
git commit -m "🚀 Deploy: $(date)"
git push origin main

# Build automático iniciado!
# APK disponível em: https://expo.dev/accounts/ts201328/projects/ride-app/builds
```

### 2. **Script de Deploy**
```bash
# Tornar executável
chmod +x deploy.sh

# Executar
./deploy.sh
```

## 📱 Alternativas Mais Rápidas

### **Expo Go (Instantâneo)**
```bash
cd client
npx expo start
# Escaneie QR code com Expo Go
```

### **Development Build (Local)**
```bash
cd client
eas build --platform android --profile development --local
```

### **Preview Build (Rápido)**
```bash
cd client
eas build --platform android --profile preview --local
```

## 🔧 Configuração Inicial

### 1. **Configurar GitHub Secrets**
- `EXPO_TOKEN`: Token do Expo (obtenha em expo.dev)
- `GITHUB_TOKEN`: Token do GitHub (automático)

### 2. **Configurar EAS**
```bash
cd client
eas login
eas build:configure
```

## 📊 Comparação de Métodos

| Método | Velocidade | Facilidade | Automático |
|--------|------------|------------|------------|
| **GitHub Actions** | ⭐⭐⭐ | ⭐⭐⭐ | ✅ |
| **Expo Go** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ |
| **Local Build** | ⭐⭐ | ⭐⭐ | ❌ |
| **EAS Build Manual** | ⭐ | ⭐ | ❌ |

## 🎯 Workflow Recomendado

### **Desenvolvimento:**
1. Use `expo start` para desenvolvimento
2. Teste com Expo Go no celular
3. Commit frequente no GitHub

### **Deploy:**
1. Push para GitHub
2. Build automático via GitHub Actions
3. APK disponível em 5-10 minutos
4. QR code para download direto

## 🔗 Links Úteis

- **Builds**: https://expo.dev/accounts/ts201328/projects/ride-app/builds
- **GitHub Actions**: https://github.com/seu-usuario/ride-app/actions
- **Expo Dashboard**: https://expo.dev/accounts/ts201328/projects/ride-app

## 🚨 Troubleshooting

### **Build Falha:**
```bash
# Limpar cache
cd client
eas build --clear-cache

# Verificar logs
eas build:list --limit=1
```

### **GitHub Actions Falha:**
- Verificar `EXPO_TOKEN` nas secrets
- Verificar permissões do repositório
- Verificar logs em Actions tab

### **Expo Go Não Conecta:**
- Verificar se ngrok está ativo
- Verificar URL em `config.tsx`
- Reiniciar servidor backend
