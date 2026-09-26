#!/bin/bash

# Script d'installation pour EHR-Planning-Agent
# Ce script crée le dépôt GitHub et configure tout

echo "=========================================="
echo "Configuration de EHR-Planning-Agent"
echo "=========================================="
echo ""

# Vérifier que gh est installé
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) n'est pas installé."
    echo "Installation : brew install gh"
    exit 1
fi

# Vérifier l'authentification GitHub
if ! gh auth status &> /dev/null; then
    echo "⚠️  Authentification GitHub requise."
    gh auth login
fi

# Se déplacer dans le répertoire du projet
cd /Users/neobeamon/MistralProjects/ehr-planning-app

echo "📁 Répertoire courant : $(pwd)"
echo ""

# Créer le dépôt GitHub
echo "🚀 Création du dépôt GitHub..."
if gh repo view neobeamon/ehr-planning-app &> /dev/null; then
    echo "✅ Le dépôt ehr-planning-app existe déjà."
else
    echo "🆕 Création du dépôt 'ehr-planning-app'..."
    gh repo create ehr-planning-app \
        --public \
        --description "Application pour gérer le planning des matchs de l'Entente Hettange Rodemack" \
        --source=. \
        --push
    
    if [ $? -eq 0 ]; then
        echo "✅ Dépôt créé avec succès !"
    else
        echo "❌ Échec de la création du dépôt."
        exit 1
    fi
fi

echo ""

# Configurer les secrets GitHub (optionnel)
echo "🔐 Configuration des secrets GitHub..."
echo "Pour que GitHub Actions puisse déployer sur Vercel, vous devez configurer ces secrets :"
echo ""
echo "1. VERCEL_TOKEN"
echo "   - Obtenez-le depuis : https://vercel.com/account/tokens"
echo "   - Commande : gh secret set VERCEL_TOKEN"
echo ""
echo "2. VERCEL_ORG_ID"
echo "   - Trouvez votre Org ID sur : https://vercel.com/neobeamon/settings"
echo "   - Commande : gh secret set VERCEL_ORG_ID"
echo ""
echo "3. VERCEL_PROJECT_ID"
echo "   - Trouvez votre Project ID sur : https://vercel.com/neobeamon"
echo "   - Commande : gh secret set VERCEL_PROJECT_ID"
echo ""
echo "Souhaitez-vous configurer ces secrets maintenant ? (oui/non)"
read -r response

if [[ "$response" =~ ^([oO][uU][iI]|[yY][eE][sS])$ ]]; then
    echo ""
    echo "Entrez votre VERCEL_TOKEN :"
    read -r vercel_token
    gh secret set VERCEL_TOKEN -b "$vercel_token"
    
    echo "Entrez votre VERCEL_ORG_ID :"
    read -r vercel_org_id
    gh secret set VERCEL_ORG_ID -b "$vercel_org_id"
    
    echo "Entrez votre VERCEL_PROJECT_ID :"
    read -r vercel_project_id
    gh secret set VERCEL_PROJECT_ID -b "$vercel_project_id"
    
    echo "✅ Secrets configurés !"
else
    echo "⏭️  Configuration des secrets annulée. Vous pouvez le faire manuellement plus tard."
fi

echo ""
echo "=========================================="
echo "✅ Configuration terminée !"
echo "=========================================="
echo ""
echo "Prochaines étapes :"
echo "1. Poussez vos modifications : git push origin main"
echo "2. Configurez Vercel : https://vercel.com/new"
echo "3. Importez le dépôt GitHub"
echo "4. Activez l'agent : / skill EHR-Planning-Agent"
echo ""
