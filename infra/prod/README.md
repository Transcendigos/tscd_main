# 🚀 Production Docker Setup

## 📋 Checklist Production
- [x] **Nginx** avec HTTPS et optimisations
- [x] **Vite build** optimisé pour la production
- [x] **Ports sécurisés** (seulement 8080/443 exposés)
- [x] **Health checks** sur tous les services
- [x] **Volumes persistants** pour les données
- [x] **Headers de sécurité** dans Nginx
- [x] **Monitoring complet** (Prometheus, Grafana, Kibana)
- [ ] **Backup**

## 📊 **Monitoring de Production**

### Démarrage du monitoring :
```bash
# Démarrer l'application principale
docker-compose up -d

# Démarrer le monitoring séparément
docker-compose -f docker-compose.monitoring.yml up -d
```

### URLs d'accès :
- **🌐 Application** : https://localhost
- **📊 Prometheus** : http://localhost:9090
- **📈 Grafana** : http://localhost:3001 (admin/admin123)
- **📋 Kibana** : http://localhost:5601

### Test du monitoring :
```bash
./test-monitoring.sh
```

### Configuration :
- **Prometheus** : `monitoring/prometheus.yml`
- **Alertes** : `monitoring/alert.rules.yml`
- **Métriques collectées** :
  - CPU, mémoire, disque (Node Exporter)
  - Redis (Redis Exporter)
  - Backend API (si `/metrics` endpoint)
  - Elasticsearch

---

## 🛠️ **Utilisation**

### 1. **Démarrage complet** :
```bash
# Application + Monitoring
docker-compose up -d
docker-compose -f docker-compose.monitoring.yml up -d

# Vérifier que tout fonctionne
./test-monitoring.sh
```

### 2. **Monitoring des alertes** :
- **CPU > 80%** : Warning
- **Mémoire > 85%** : Warning  
- **Disque < 10%** : Critical
- **Service down** : Critical
- **Taux d'erreur > 5%** : Warning

---

## 🔒 **Sécurité**

### Certificats SSL :
```bash
# Générer des certificats auto-signés (tests)
./generate-ssl.sh

# Pour la production : utiliser Let's Encrypt
# 1. Décommenter les lignes SSL dans nginx/default.conf
# 2. Utiliser Certbot ou un certificat commercial
```

---

## 📈 **Performance**

### Optimisations activées :
- ✅ **Gzip compression** (Nginx)
- ✅ **Cache des assets statiques** (1 an)
- ✅ **Vite build optimisé** (minification, tree-shaking)
- ✅ **HTTP/2** (Nginx)
- ✅ **Headers de sécurité** (CSP, HSTS, etc.)

### Monitoring des performances :
- **Temps de réponse** (Grafana)
- **Utilisation des ressources** (Prometheus)
- **Taux d'erreur** (Alertes automatiques)

---

## 🚨 **Maintenance**

### Mise à jour :
```bash
# Rebuild et redémarrage
docker-compose build
docker-compose up -d

# Monitoring
docker-compose -f docker-compose.monitoring.yml build
docker-compose -f docker-compose.monitoring.yml up -d
```

### Logs :
```bash
# Logs de l'application
docker-compose logs -f

# Logs du monitoring
docker-compose -f docker-compose.monitoring.yml logs -f
```

### Troubleshooting :
```bash
# Vérifier l'état des services
docker-compose ps

# Test complet
./test-monitoring.sh
```

---

## 📞 **Support**

### En cas de problème :
1. **Vérifier les logs** : `docker-compose logs [service]`
2. **Tester la connectivité** : `./test-monitoring.sh`
3. **Redémarrer les services** : `docker-compose restart`

### Métriques importantes :
- **Disponibilité** : http://localhost/health
- **Performance** : Grafana dashboards
- **Erreurs** : Kibana logs
- **Ressources** : Prometheus metrics 