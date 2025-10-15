#!/bin/bash

# Script de Deploy Rápido para Ride App
echo "🚀 Ride App - Deploy Rápido"
echo "=========================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar dependências
echo -e "${YELLOW}📋 Verificando dependências...${NC}"

if ! command_exists git; then
    echo -e "${RED}❌ Git não encontrado${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}❌ Node.js não encontrado${NC}"
    exit 1
fi

if ! command_exists eas; then
    echo -e "${RED}❌ EAS CLI não encontrado. Instalando...${NC}"
    npm install -g @expo/eas-cli
fi

echo -e "${GREEN}✅ Dependências OK${NC}"

# Opções de deploy
echo ""
echo "Escolha uma opção:"
echo "1) 🚀 Deploy rápido (GitHub + EAS Build)"
echo "2) 📱 Build local (mais rápido para teste)"
echo "3) 🔄 Push para GitHub (trigger automático)"
echo "4) 📋 Status do build"
echo "5) ❌ Cancelar"

read -p "Digite sua opção (1-5): " option

case $option in
    1)
        echo -e "${YELLOW}🚀 Iniciando deploy completo...${NC}"
        
        # Commit e push
        git add .
        git commit -m "🚀 Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
        git push origin main
        
        echo -e "${GREEN}✅ Push realizado! Build automático iniciado.${NC}"
        echo -e "${YELLOW}📱 Acesse: https://expo.dev/accounts/ts201328/projects/ride-app/builds${NC}"
        ;;
        
    2)
        echo -e "${YELLOW}📱 Iniciando build local...${NC}"
        cd client
        eas build --platform android --profile preview --local
        ;;
        
    3)
        echo -e "${YELLOW}🔄 Fazendo push para GitHub...${NC}"
        git add .
        git commit -m "🔄 Update: $(date '+%Y-%m-%d %H:%M:%S')"
        git push origin main
        echo -e "${GREEN}✅ Push realizado! GitHub Actions iniciado.${NC}"
        ;;
        
    4)
        echo -e "${YELLOW}📋 Verificando status dos builds...${NC}"
        cd client
        eas build:list --limit=5
        ;;
        
    5)
        echo -e "${YELLOW}❌ Deploy cancelado${NC}"
        exit 0
        ;;
        
    *)
        echo -e "${RED}❌ Opção inválida${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Processo concluído!${NC}"
echo -e "${YELLOW}💡 Dica: Use 'expo start' para desenvolvimento local${NC}"
