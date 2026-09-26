#!/bin/bash

# Script de configuration pour Vercel

echo "=========================================="
echo "Configuration Vercel pour EHR-Planning-Agent"
echo "=========================================="
echo ""

# Vérifier que npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js npm n'est pas installé."
    echo "Installation : brew install node"
    exit 1
fi

# Se déplacer dans le répertoire du projet
cd /Users/neobeamon/MistralProjects/ehr-planning-app

echo "📁 Répertoire courant : $(pwd)"
echo ""

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Échec de l'installation des dépendances."
    exit 1
fi

echo "✅ Dépendances installées !"
echo ""

# Test du build
echo "🔨 Test du build..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Échec du build."
    echo "Vérifiez les erreurs ci-dessus."
    exit 1
fi

echo "✅ Build réussi !"
echo ""

# Instructions Vercel
echo "=========================================="
echo "Configuration manuelle Vercel requise"
echo "=========================================="
echo ""
echo "1. Allez sur https://vercel.com/new"
echo "2. Importez le dépôt : neobeamon/ehr-planning-app"
echo "3. Configurez les variables d'environnement :"
echo ""
echo "   Variables requises :"
echo "   - TURSO_DB_URL : URL de votre base de données Turso"
echo "   - TURSO_AUTH_TOKEN : Token d'authentification Turso"
echo ""
echo "4. Déployez le projet"
echo ""
echo "Une fois déployé, notez :"
echo "   - VERCEL_PROJECT_ID : L'ID de votre projet Vercel"
echo "   - VERCEL_ORG_ID : L'ID de votre organisation"
echo ""
echo "Puis configurez ces valeurs comme secrets GitHub :"
echo "   gh secret set VERCEL_TOKEN"
echo "   gh secret set VERCEL_ORG_ID"
echo "   gh secret set VERCEL_PROJECT_ID"
echo ""
