#!/bin/bash

# Script pour générer des certificats SSL auto-signés pour les tests
# Pour la production réelle, utiliser Let's Encrypt certificat commercial

echo "🔐 Génération de certificats SSL auto-signés..."

# Créer le répertoire SSL
mkdir -p ssl

# Générer la clé privée
openssl genrsa -out ssl/private.key 2048

# Générer le certificat auto-signé
openssl req -new -x509 -key ssl/private.key -out ssl/certificate.crt -days 365 -subj "/C=FR/ST=France/L=Paris/O=YourCompany/CN=localhost"

# Définir les permissions
chmod 600 ssl/private.key
chmod 644 ssl/certificate.crt

echo "✅ Certificats SSL générés dans le dossier ssl/" 