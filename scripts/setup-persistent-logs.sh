#!/bin/bash
#
# Script para configurar logging persistente do sistema
# Habilita journald persistente (não apenas em RAM via log2ram)
#
# Uso: sudo ./scripts/setup-persistent-logs.sh
#

set -e

echo "==================================="
echo "Setup Persistent System Logging"
echo "==================================="
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Este script precisa rodar como root (use sudo)"
  exit 1
fi

echo "📁 Criando diretório para journald persistente..."
mkdir -p /var/log/journal

echo "📝 Configurando systemd-tmpfiles..."
systemd-tmpfiles --create --prefix /var/log/journal

echo "🔄 Reiniciando systemd-journald..."
systemctl restart systemd-journald

echo "✅ Verificando configuração..."
journalctl --disk-usage

echo ""
echo "==================================="
echo "✅ Logging persistente configurado!"
echo "==================================="
echo ""
echo "Agora os logs do sistema serão mantidos em disco e não perdidos em reboots."
echo ""
echo "Para visualizar logs de boots anteriores:"
echo "  sudo journalctl --list-boots"
echo "  sudo journalctl -b -1  # Boot anterior"
echo ""
echo "Para visualizar logs persistentes:"
echo "  sudo journalctl --since \"1 day ago\""
echo ""

