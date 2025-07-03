#!/bin/bash

# Script de test du monitoring en production
# Usage: ./test-monitoring.sh

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions de logging
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Test de connectivité
test_connectivity() {
    log_step "Test de connectivité des services..."
    
    # Test Nginx
    if curl -f http://localhost/health >/dev/null 2>&1; then
        log_info "✅ Nginx fonctionne"
    else
        log_error "❌ Nginx ne répond pas"
        return 1
    fi
    
    # Test Backend
    if curl -f http://localhost/api/health >/dev/null 2>&1; then
        log_info "✅ Backend fonctionne"
    else
        log_error "❌ Backend ne répond pas"
        return 1
    fi
    
    # Test Redis
    if docker exec redis_chat_prod redis-cli ping >/dev/null 2>&1; then
        log_info "✅ Redis fonctionne"
    else
        log_error "❌ Redis ne répond pas"
        return 1
    fi
}

# Test Prometheus
test_prometheus() {
    log_step "Test de Prometheus..."
    
    if curl -f http://localhost:9090/-/healthy >/dev/null 2>&1; then
        log_info "✅ Prometheus fonctionne"
        
        # Test des métriques
        if curl -s http://localhost:9090/api/v1/targets | grep -q "up"; then
            log_info "✅ Métriques collectées"
        else
            log_warn "⚠️  Aucune métrique collectée"
        fi
    else
        log_error "❌ Prometheus ne répond pas"
        return 1
    fi
}

# Test Grafana
test_grafana() {
    log_step "Test de Grafana..."
    
    if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
        log_info "✅ Grafana fonctionne"
        log_info "📊 Dashboard disponible sur: http://localhost:3001"
        log_info "   Login: admin / admin123"
    else
        log_error "❌ Grafana ne répond pas"
        return 1
    fi
}

# Test Node Exporter
test_node_exporter() {
    log_step "Test de Node Exporter..."
    
    if curl -f http://localhost:9101/metrics >/dev/null 2>&1; then
        log_info "✅ Node Exporter fonctionne"
        
        # Vérifier quelques métriques importantes
        METRICS=$(curl -s http://localhost:9101/metrics)
        if echo "$METRICS" | grep -q "node_cpu_seconds_total"; then
            log_info "✅ Métriques CPU disponibles"
        fi
        if echo "$METRICS" | grep -q "node_memory_MemTotal_bytes"; then
            log_info "✅ Métriques mémoire disponibles"
        fi
    else
        log_error "❌ Node Exporter ne répond pas"
        return 1
    fi
}

# Test Redis Exporter
test_redis_exporter() {
    log_step "Test de Redis Exporter..."
    
    if curl -f http://localhost:9121/metrics >/dev/null 2>&1; then
        log_info "✅ Redis Exporter fonctionne"
        
        # Vérifier les métriques Redis
        METRICS=$(curl -s http://localhost:9121/metrics)
        if echo "$METRICS" | grep -q "redis_up"; then
            log_info "✅ Métriques Redis disponibles"
        fi
    else
        log_error "❌ Redis Exporter ne répond pas"
        return 1
    fi
}

# Test Elasticsearch
test_elasticsearch() {
    log_step "Test d'Elasticsearch..."
    
    if curl -f http://localhost:9200/_cluster/health >/dev/null 2>&1; then
        log_info "✅ Elasticsearch fonctionne"
        
        # Vérifier le statut du cluster
        STATUS=$(curl -s http://localhost:9200/_cluster/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        log_info "📊 Statut du cluster: $STATUS"
    else
        log_error "❌ Elasticsearch ne répond pas"
        return 1
    fi
}

# Test Kibana
test_kibana() {
    log_step "Test de Kibana..."
    
    if curl -f http://localhost:5601/api/status >/dev/null 2>&1; then
        log_info "✅ Kibana fonctionne"
        log_info "📊 Interface disponible sur: http://localhost:5601"
    else
        log_error "❌ Kibana ne répond pas"
        return 1
    fi
}

# Test des alertes
test_alerts() {
    log_step "Test des alertes Prometheus..."
    
    # Vérifier que les règles d'alerte sont chargées
    if curl -s http://localhost:9090/api/v1/rules | grep -q "alerting"; then
        log_info "✅ Règles d'alerte chargées"
    else
        log_warn "⚠️  Aucune règle d'alerte trouvée"
    fi
}

# Affichage des URLs
show_urls() {
    log_step "URLs d'accès:"
    echo ""
    echo "🌐 Application:"
    echo "   - HTTP:  http://localhost"
    echo "   - HTTPS: https://localhost"
    echo ""
    echo "📊 Monitoring:"
    echo "   - Prometheus: http://localhost:9090"
    echo "   - Grafana:    http://localhost:3001 (admin/admin123)"
    echo "   - Kibana:     http://localhost:5601"
    echo ""
    echo "🔧 Métriques:"
    echo "   - Node Exporter: http://localhost:9101/metrics"
    echo "   - Redis Exporter: http://localhost:9121/metrics"
    echo ""
}

# Test principal
main() {
    log_info "🔍 Début des tests de monitoring..."
    echo ""
    
    local failed=0
    
    # Tests de base
    test_connectivity || failed=1
    echo ""
    
    # Tests de monitoring
    test_prometheus || failed=1
    test_grafana || failed=1
    test_node_exporter || failed=1
    test_redis_exporter || failed=1
    echo ""
    
    # Tests optionnels (logs)
    test_elasticsearch || log_warn "Elasticsearch non disponible"
    test_kibana || log_warn "Kibana non disponible"
    echo ""
    
    # Tests avancés
    test_alerts
    echo ""
    
    # Affichage des URLs
    show_urls
    
    # Résumé
    if [ $failed -eq 0 ]; then
        log_info "🎉 Tous les tests de monitoring sont passés !"
    else
        log_error "❌ Certains tests ont échoué"
        exit 1
    fi
}

# Exécution
main "$@" 